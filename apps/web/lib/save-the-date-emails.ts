import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/social/urls';
import {
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
// Design mirrors lib/papic-sampler-emails.ts:
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

    let sent = 0;
    for (const g of recipients) {
      const to = (g.email ?? '').trim();
      try {
        const mail = buildSaveTheDateGuestEmail(g, ctx);
        const res = await sendEmail({
          to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          headers: mail.headers,
        });
        if (res.ok) {
          // Stamp ONLY on a confirmed send so a transient failure retries on the
          // next launch instead of being silently swallowed forever.
          await admin
            .from('guests')
            .update({ std_sent_at: new Date().toISOString() })
            .eq('guest_id', g.guest_id);
          sent += 1;
        }
      } catch {
        /* best-effort per guest — keep fanning out */
      }
    }

    return { attempted: recipients.length, sent, skipped: null };
  } catch {
    /* best-effort — never breaks the launch */
    return { attempted: 0, sent: 0, skipped: null };
  }
}
