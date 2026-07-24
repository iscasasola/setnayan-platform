import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import { ANON_EMAIL_DOMAIN } from '@/lib/anon-onboarding';

/**
 * Abandoned anonymous-draft cleanup (RA 10173 data-minimization).
 *
 * anon-draft onboarding (NEXT_PUBLIC_ANON_ONBOARDING_ENABLED) lets a visitor
 * commit a real account + event as a Supabase native anonymous user; many never
 * secure it. Those drafts hold third-party guest PII under an unidentifiable
 * controller and — with no sweep — persist forever. `public.events` has NO owner
 * FK, so deleting the anon auth user alone would ORPHAN the event (its
 * event_members row cascades away, leaving a member-less, invisible, permanent
 * row). This deletes an abandoned draft in the only safe order:
 *   1. delete the event(s)  → cascades every event-scoped child AND the
 *      NO-ACTION user-FK children (e.g. event_playlist_picks.created_by_user_id)
 *      that would otherwise make admin.auth.admin.deleteUser() throw, and
 *   2. delete the auth user → cascades public.users.
 *
 * Best-effort, batched, idempotent, and a no-op until a real abandoned draft
 * ages past the TTL — safe to drive from admin request traffic.
 */

// ⚠ DPO / counsel sign-off item — retention window for UNCONVERTED anon drafts.
// 30 days is a conservative default for third-party PII held under an
// unidentifiable controller (data-minimization argues for aggressive deletion).
// Tighten as directed before enabling the feature in production.
const ANON_DRAFT_TTL_DAYS = 30;

// Bounded per run so a single admin request never does unbounded work; the
// daily claim keeps chewing through the backlog across subsequent requests.
const BATCH = 50;

export async function runAnonDraftSweep(): Promise<{ scanned: number; deleted: number }> {
  const admin = createAdminClient();
  const cutoffIso = new Date(
    Date.now() - ANON_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Candidates: public.users rows still carrying the non-routable placeholder
  // email (the convert flow overwrites it with the real email), created before
  // the cutoff. This is a cheap pre-filter — is_anonymous is re-confirmed below.
  const { data: candidates, error } = await admin
    .from('users')
    .select('user_id')
    .like('email', `%${ANON_EMAIL_DOMAIN}`)
    .lt('created_at', cutoffIso)
    // Cursor (gap audit · anti-wedge): least-recently-skipped first (NULL = never
    // skipped → sorts first), THEN oldest. Every skip below re-stamps the row so
    // it rotates to the back of the window instead of permanently occupying the
    // head and blocking deletable drafts behind it.
    .order('anon_sweep_skipped_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error('[anon-draft-sweep] candidate query failed:', error.message);
    return { scanned: 0, deleted: 0 };
  }

  const rows = candidates ?? [];
  let deleted = 0;

  // Stamp a SKIPPED candidate so the next run orders it behind never-/less-
  // recently-skipped rows (see the query ORDER above). Best-effort — a failed
  // stamp just means the row is re-considered next run; the cursor is
  // ordering-only and never gates deletion, so nothing is deleted unsafely.
  const markSkipped = async (id: string): Promise<void> => {
    try {
      await admin
        .from('users')
        .update({ anon_sweep_skipped_at: new Date().toISOString() })
        .eq('user_id', id);
    } catch {
      /* ordering-only — safe to retry next run */
    }
  };

  for (const row of rows) {
    const uid = (row as { user_id: string }).user_id;
    try {
      // Authoritative converted-marker is auth.users.is_anonymous. The placeholder
      // email can linger on a CONVERTED account if the best-effort profile-email
      // update failed (signup/actions.ts), so re-confirm before ANY delete —
      // deleting a converted (real) account would be data loss.
      const { data: got, error: getErr } = await admin.auth.admin.getUserById(uid);
      if (getErr || got?.user?.is_anonymous !== true) {
        // Converted (real) account with a lingering placeholder email, or a
        // transient lookup error — either way don't delete. Stamp so a permanent
        // converted-account row can't wedge the window.
        await markSkipped(uid);
        continue;
      }

      // Events this draft created — an anon user is only ever a 'couple' member
      // of its own event.
      const { data: memberships } = await admin
        .from('event_members')
        .select('event_id')
        .eq('user_id', uid)
        .eq('member_type', 'couple');
      const eventIds = (memberships ?? [])
        .map((m) => (m as { event_id: string }).event_id)
        .filter(Boolean);

      if (eventIds.length > 0) {
        // Legal hold: never delete an event carrying a payment record (BIR /
        // contract floor). An abandoned draft never paid (checkout is gated for
        // anonymous principals), so this is defensive.
        const { data: paid } = await admin
          .from('orders')
          .select('order_id')
          .in('event_id', eventIds)
          .limit(1);
        if (paid && paid.length > 0) {
          // Legal hold (BIR / contract floor). Stamp so a held draft rotates back.
          await markSkipped(uid);
          continue;
        }

        const { error: delEventsErr } = await admin
          .from('events')
          .delete()
          .in('event_id', eventIds);
        if (delEventsErr) {
          console.error(`[anon-draft-sweep] event delete failed (${uid}):`, delEventsErr.message);
          await markSkipped(uid);
          continue;
        }
      }

      // Hard-delete the auth user → cascades public.users. Skip-on-throw so one
      // stubborn row never aborts the batch.
      const { error: delUserErr } = await admin.auth.admin.deleteUser(uid);
      if (delUserErr) {
        console.error(`[anon-draft-sweep] auth delete failed (${uid}):`, delUserErr.message);
        await markSkipped(uid);
        continue;
      }
      deleted++;
    } catch (e) {
      console.error(`[anon-draft-sweep] unexpected error (${uid}):`, e);
      // Unresolved this pass — stamp so it can't wedge the head of the window.
      await markSkipped(uid);
    }
  }

  return { scanned: rows.length, deleted };
}

/**
 * CRON-FREE daily anon-draft sweep — fired from admin-layout after(); a DAILY DB
 * claim guarantees it runs ~once/day across the fleet and survives deploys.
 * Best-effort, never throws.
 */
export async function maybeRunAnonDraftSweep(): Promise<void> {
  try {
    if (await claimPeriodicJob('anon-draft-sweep', DAILY_GAP_MS)) await runAnonDraftSweep();
  } catch {
    /* best-effort — a missed day retries on the next eligible admin request */
  }
}
