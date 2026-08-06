import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { sendVendorGhostWarningEmail } from '@/lib/vendor-email-triggers';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Login-driven ghosting check (owner directive 2026-06-07 — NO cron).
 *
 * Runs lazily, ONCE per login, from the dashboard layouts via Next's after()
 * (post-response, so it never delays a render). It uses the actor's login
 * moment (users.last_login_at) as the "now" and detects inquiries that have sat
 * unanswered past the threshold:
 *   • role='couple'  → inquiries the couple SENT that no vendor has answered →
 *                      nudge the couple toward alternatives.
 *   • role='vendor'  → inquiries the vendor RECEIVED but hasn't answered → nudge
 *                      the vendor to reply (response-rate hygiene).
 *
 * "Unanswered" = chat_threads.inquiry_status='pending' (the accept-gate makes a
 * pending thread definitionally unanswered — a vendor cannot even reply before
 * accepting). The (vendor_profile_id, inquiry_status) index keeps the vendor-
 * side query cheap at 250k-vendor scale.
 *
 * Once-per-login is enforced by comparing last_login_at to last_ghost_check_at
 * (added in migration 20260909000000): we only do work when the current login
 * is newer than the last check, then stamp last_ghost_check_at = last_login_at.
 * Everything is service-role + fail-soft — a hiccup never affects the page.
 */

const GHOST_THRESHOLD_HOURS = 48;

export async function runLoginGhostingCheck(
  userId: string,
  role: 'couple' | 'vendor',
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Gate: only run once per login.
    const { data: u } = await admin
      .from('users')
      .select('last_login_at, last_ghost_check_at')
      .eq('user_id', userId)
      .maybeSingle();
    const lastLoginAt = u?.last_login_at as string | null | undefined;
    if (!lastLoginAt) return; // never logged-in-stamped yet
    const lastCheckAt = u?.last_ghost_check_at as string | null | undefined;
    if (lastCheckAt && new Date(lastCheckAt) >= new Date(lastLoginAt)) {
      return; // already checked for this login
    }

    const loginTs = new Date(lastLoginAt);
    const cutoffIso = new Date(
      loginTs.getTime() - GHOST_THRESHOLD_HOURS * 3600 * 1000,
    ).toISOString();

    if (role === 'couple') {
      const { data: members } = await admin
        .from('event_members')
        .select('event_id')
        .eq('user_id', userId)
        .eq('member_type', 'couple');
      const eventIds = (members ?? []).map((m) => m.event_id as string);
      if (eventIds.length > 0) {
        const { data: stale } = await admin
          .from('chat_threads')
          .select('thread_id')
          .in('event_id', eventIds)
          .eq('inquiry_status', 'pending')
          .lt('created_at', cutoffIso);
        const n = (stale ?? []).length;
        if (n > 0) {
          await emitNotification({
            userId,
            type: 'inquiry_no_response',
            title:
              n === 1
                ? 'A vendor hasn’t replied yet'
                : `${n} of your inquiries haven’t been answered`,
            body: 'Some inquiries are still waiting on a vendor reply. Explore similar matches so your plans keep moving.',
            relatedUrl: '/dashboard',
          });
        }
      }
    } else {
      const { data: profiles } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .eq('user_id', userId);
      const vpIds = (profiles ?? []).map((p) => p.vendor_profile_id as string);
      if (vpIds.length > 0) {
        const { data: stale } = await admin
          .from('chat_threads')
          .select('thread_id')
          .in('vendor_profile_id', vpIds)
          .eq('inquiry_status', 'pending')
          .lt('created_at', cutoffIso);
        const n = (stale ?? []).length;
        if (n > 0) {
          await emitNotification({
            userId,
            type: 'inquiry_awaiting_reply',
            title:
              n === 1
                ? 'An inquiry is awaiting your reply'
                : `${n} inquiries are awaiting your reply`,
            body: 'Couples are waiting to hear from you. Answering keeps your response rate high — one answer covers all your services for that wedding.',
            relatedUrl: '/vendor-dashboard/messages',
          });
        }

        // Confirmed-booking ghost warning (Phase B · 2026-06-19): revive the
        // previously-dead sendVendorGhostWarningEmail. Detect any confirmed
        // booking whose event is within the next 7 days — the vendor needs to
        // confirm they're ready. The login gate above already bounds this to
        // once per login, so we don't re-warn on every page load. Best-effort.
        // events.event_date is a DATE — compare against date-only strings so
        // the 7-day window is inclusive on both ends with no timestamp
        // boundary ambiguity.
        const todayDate = loginTs.toISOString().slice(0, 10);
        const sevenDaysOutDate = new Date(
          loginTs.getTime() + 7 * 24 * 3600 * 1000,
        )
          .toISOString()
          .slice(0, 10);
        // ⚠ `marketplace_vendor_id`, NOT `vendor_profile_id` — public.event_vendors
        // has no `vendor_profile_id`; the marketplace-vendor link is
        // `marketplace_vendor_id` (the same column every other vendor-side read
        // uses, e.g. lib/vendor-overview.ts and vendor-dashboard/clients).
        // Naming it in BOTH the select and the .in() filter 42703'd the whole
        // query, so `confirmed` was always null and the T-7-days
        // "confirm you're ready" ghost-warning email NEVER sent to anyone.
        const { data: confirmed, error: confirmedError } = await admin
          .from('event_vendors')
          .select(
            // ⚠ THE FOREIGN KEY IS NAMED ON PURPOSE. A bare `events!inner`
            // is AMBIGUOUS: PostgREST finds two ways to reach `events` from
            // `event_vendors` — the direct `event_vendors_event_id_fkey`, and a
            // many-to-many through `event_build_picks` — and refuses the whole
            // query with PGRST201 rather than guessing. `confirmed` then came
            // back null and the T-7-days "confirm you're ready" email sent to
            // NOBODY. That is the SECOND time this exact query has been killed
            // by a silent query error (see the 42703 note above), and both times
            // the only symptom was an email that never arrived.
            'event_id, marketplace_vendor_id, status, event:events!event_vendors_event_id_fkey!inner(event_id, event_date)',
          )
          .in('marketplace_vendor_id', vpIds)
          .in('status', ['contracted', 'deposit_paid'])
          .gte('event.event_date', todayDate)
          .lte('event.event_date', sevenDaysOutDate);
        if (confirmedError) {
          logQueryError('ghosting:upcomingConfirmedBookings', confirmedError, {
            userId,
            vendorProfileCount: vpIds.length,
          });
        }
        const upcoming = (confirmed ?? []) as Array<{
          event_id: string | null;
          marketplace_vendor_id: string | null;
        }>;
        // De-dup per (vendor_profile, event) so a multi-service vendor on one
        // wedding gets a single warning for that event.
        const warnedKeys = new Set<string>();
        for (const row of upcoming) {
          const eventId = row.event_id;
          const vpId = row.marketplace_vendor_id;
          if (!eventId || !vpId) continue;
          const key = `${vpId}:${eventId}`;
          if (warnedKeys.has(key)) continue;
          warnedKeys.add(key);
          await sendVendorGhostWarningEmail(vpId, eventId).catch((e) =>
            console.error('[ghosting] vendor ghost-warning email failed:', e),
          );
        }
      }
    }

    // Mark this login as checked (idempotent across the rest of this session).
    await admin
      .from('users')
      .update({ last_ghost_check_at: loginTs.toISOString() })
      .eq('user_id', userId);
  } catch (e) {
    // Lazy, best-effort — never let a ghosting hiccup affect the dashboard.
    console.error('[ghosting] login check failed:', e);
  }
}
