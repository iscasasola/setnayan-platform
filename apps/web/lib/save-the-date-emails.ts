import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/social/urls';
import {
  buildInvitationGuestEmail,
  buildSaveTheDateGuestEmail,
  isSendableEmail,
  resolveCoupleName,
  type StdEventContext,
  type StdGuestRow,
} from '@/lib/save-the-date-emails-core';

// Save-the-Date → guest-list email fan-out (iterations 0024 + 0001 + 0028).
//
// When a couple LAUNCHES their Save-the-Date (launchSaveTheDate flips the
// public /[slug] page out of its private state), we now actively EMAIL each
// guest who has an email address their save-the-date — a "push" that augments
// the existing shared-link "pull" model. PH weddings often DON'T collect guest
// emails, so this gracefully covers ONLY guests WITH an email; the shared join
// link stays the fallback for everyone else.
//
// Design:
//   • runs inside a Next 15 after() hook (CRON-FREE — no scheduler on our side)
//   • best-effort — one failure never blocks the launch or the other guests
//   • idempotent — each guest's guests.std_sent_at stamp guards re-launch from
//     re-spamming a guest who already received theirs
//   • never throws — a hiccup here must never break the launch action
//
// This is relationship/transactional mail the couple actively initiates to
// their own invited guest list (not platform marketing), so — matching the
// existing notification-emit posture — it does not gate on users.marketing_opt_in.
// It DOES carry an RFC 8058 one-click List-Unsubscribe header (mailto-based, so
// no new token table/endpoint is needed) for compliance + good deliverability.
//
// The pure content shaping lives in save-the-date-emails-core.ts (unit-tested).

/**
 * Fan out the save_the_date_sent email to every guest of an event that has a
 * usable email AND hasn't been sent yet (guests.std_sent_at IS NULL). Stamps
 * std_sent_at per guest on success so a re-launch never re-emails them. Reads
 * via the admin client (the after() hook runs without a request session).
 *
 * Best-effort + never-throws: any individual send/DB failure is swallowed and
 * the rest continue. Returns a small summary for logging/testing.
 */

/**
 * SEND TO EACH GUEST, AND STAMP ONLY WHAT WAS ACTUALLY ACCEPTED.
 *
 * Extracted 2026-09-22 (CTRL-B4 build 2) so the invitation fan-out reuses this
 * mechanism instead of becoming a second copy of it. **Two mechanisms for one
 * fact is a defect this repo has been bitten by before** — and the fact here is
 * the load-bearing one: *was this email accepted?*
 *
 * 🔑 THE STAMP IS THE PROPERTY. `sendEmail()` returns
 * `{ok:false, reason:'not_configured'}` and NO-OPS when the Resend key is
 * missing — so stamping before, or regardless of, `res.ok` would mark every
 * guest as contacted on a day nothing left the building, permanently, with the
 * couple told their invitations went out. Stamp only on `res.ok`, so a
 * transient failure retries on the next run instead of being swallowed forever.
 *
 * Per-guest try/catch: one bad address must not stop the fan-out reaching the
 * rest.
 *
 * @param column the guests column to stamp — `std_sent_at` or `invitation_sent_at`
 * @returns how many sends were ACCEPTED, never how many were attempted
 */
async function sendAndStamp<T extends { guest_id: string; email?: string | null }>(
  admin: ReturnType<typeof createAdminClient>,
  recipients: readonly T[],
  column: 'std_sent_at' | 'invitation_sent_at',
  build: (g: T) => { subject: string; text: string; html: string; headers?: Record<string, string> },
): Promise<number> {
  let sent = 0;
  for (const g of recipients) {
    const to = (g.email ?? '').trim();
    try {
      const mail = build(g);
      const res = await sendEmail({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      });
      if (res.ok) {
        await admin
          .from('guests')
          .update({ [column]: new Date().toISOString() })
          .eq('guest_id', g.guest_id);
        sent += 1;
      }
    } catch {
      /* best-effort per guest — keep fanning out */
    }
  }
  return sent;
}

export async function fanOutSaveTheDateEmails(
  eventId: string,
): Promise<{ attempted: number; sent: number; skipped: 'no_email_config' | null }> {
  try {
    if (!eventId) return { attempted: 0, sent: 0, skipped: null };
    // No Resend key → nothing can send. Bail WITHOUT stamping any guest, so the
    // day the owner keys Resend a re-launch still reaches them.
    if (!(await isEmailConfigured())) {
      return { attempted: 0, sent: 0, skipped: 'no_email_config' };
    }

    const admin = createAdminClient();

    const { data: ev } = await admin
      .from('events')
      .select(
        'display_name, bride_name, groom_name, event_date, slug, venue_name, landing_page_visibility',
      )
      .eq('event_id', eventId)
      .maybeSingle();
    // Only fan out once the page is actually public (launch already flipped it).
    if (!ev || !ev.slug || ev.landing_page_visibility !== 'public') {
      return { attempted: 0, sent: 0, skipped: null };
    }

    const ctx: StdEventContext = {
      coupleName: resolveCoupleName({
        display_name: (ev.display_name as string | null) ?? null,
        bride_name: (ev.bride_name as string | null) ?? null,
        groom_name: (ev.groom_name as string | null) ?? null,
      }),
      weddingDateIso: (ev.event_date as string | null) ?? null,
      pageUrl: `${siteUrl().replace(/\/$/, '')}/${ev.slug as string}`,
      venue: ((ev.venue_name as string | null) ?? '').trim() || null,
    };

    // Unsent guests with an email. RLS is bypassed by the admin client; we scope
    // explicitly on event_id + not-deleted + unsent + has-email.
    const { data: guests } = await admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, email')
      .eq('event_id', eventId)
      .is('std_sent_at', null)
      .is('deleted_at', null)
      .not('email', 'is', null);

    const recipients = ((guests ?? []) as StdGuestRow[]).filter((g) =>
      isSendableEmail(g.email),
    );

    const sent = await sendAndStamp(admin, recipients, 'std_sent_at', (g) =>
      buildSaveTheDateGuestEmail(g, ctx),
    );

    return { attempted: recipients.length, sent, skipped: null };
  } catch {
    /* best-effort — never breaks the launch */
    return { attempted: 0, sent: 0, skipped: null };
  }
}

/**
 * FAN OUT THE INVITATION — CTRL-B4 build 2.
 *
 * ── THE MEASURED PROBLEM ───────────────────────────────────────────────────
 * Production 2026-09-22: **146 guests, 0 with `invitation_sent_at`.** There was
 * no send path of any kind, so the couple's Invite step could never complete —
 * "N to send" had no way to reach zero.
 *
 * ── ONE MECHANISM, TWO MESSAGES ────────────────────────────────────────────
 * Shares `sendAndStamp` with the save-the-date, deliberately. The MESSAGE
 * differs — a save-the-date asks you to hold a day, an invitation asks you to
 * come — but the fact that matters is the same one: *was this email accepted?*
 * Two mechanisms for one fact is a defect this repo has met before.
 *
 * 🔑 THE THREE REFUSALS, EACH NAMED RATHER THAN SILENT:
 *   · no Resend key → send NOTHING and stamp NOTHING. `sendEmail()` returns
 *     `{ok:false, reason:'not_configured'}` and no-ops, so fanning out anyway
 *     would mark every guest invited on a day nothing left the building — and
 *     `invitation_sent_at` is what the couple's screen counts.
 *   · a guest already stamped is skipped, so a re-run never re-emails anyone.
 *   · a guest with no address is not a failure, it is the 141. They are
 *     reported by `invitationReach`, not silently dropped here.
 *
 * ⚠ UNLIKE THE SAVE-THE-DATE, THIS DOES NOT REQUIRE A PUBLIC PAGE. The STD
 * refuses until `landing_page_visibility` is public because it links a page a
 * stranger must be able to open. An invitation carries the guest's own link and
 * a couple may well invite before going public, so gating it on that would
 * refuse the common case. Different rule, stated rather than copied.
 */
export async function fanOutInvitationEmails(
  eventId: string,
): Promise<{ attempted: number; sent: number; skipped: 'no_email_config' | 'no_event' | null }> {
  try {
    if (!eventId) return { attempted: 0, sent: 0, skipped: null };
    if (!(await isEmailConfigured())) {
      return { attempted: 0, sent: 0, skipped: 'no_email_config' };
    }

    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('display_name, bride_name, groom_name, event_date, slug, venue_name')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!ev) return { attempted: 0, sent: 0, skipped: 'no_event' };

    const ctx: StdEventContext = {
      coupleName: resolveCoupleName({
        display_name: (ev.display_name as string | null) ?? null,
        bride_name: (ev.bride_name as string | null) ?? null,
        groom_name: (ev.groom_name as string | null) ?? null,
      }),
      weddingDateIso: (ev.event_date as string | null) ?? null,
      pageUrl: `${siteUrl().replace(/\/$/, '')}/${ev.slug as string}`,
      venue: ((ev.venue_name as string | null) ?? '').trim() || null,
    };

    const { data: guests } = await admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, email')
      .eq('event_id', eventId)
      .is('invitation_sent_at', null)
      .is('deleted_at', null)
      .not('email', 'is', null);

    const recipients = ((guests ?? []) as StdGuestRow[]).filter((g) => isSendableEmail(g.email));
    const sent = await sendAndStamp(admin, recipients, 'invitation_sent_at', (g) =>
      buildInvitationGuestEmail(g, ctx),
    );
    return { attempted: recipients.length, sent, skipped: null };
  } catch {
    return { attempted: 0, sent: 0, skipped: null };
  }
}
