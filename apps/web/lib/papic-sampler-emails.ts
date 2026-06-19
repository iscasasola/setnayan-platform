import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelScheduledEmail, isEmailConfigured, sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';

// Free Papic sampler — cron-free expiry-warning emails.
//
// Called from the capture after() hook on EVERY sampler capture, but self-guards
// to fire ONCE per event (the papic_sampler_email_log PK is the lock). On the
// first sampler photo we hand Resend two future-dated emails — ~7 days and ~1
// day before the 30-day expiry — and Resend delivers them at that time. No cron,
// no scheduler on our side; the provider does the time-triggering (Resend allows
// scheduling up to 30 days out, so T-7 ≈ 23 days and T-1 ≈ 29 days both fit).
//
// The copy is worded so it's correct even if a reminder slips through after the
// couple keeps the photos ("ignore this if you've already connected Drive or
// upgraded"). On top of that, cancelSamplerExpiryWarnings() actively pulls the
// two scheduled Resend emails the moment the couple converts (Drive-connect or
// paid upgrade), using the stored message ids. Never throws: a hiccup here must
// never break a capture or a conversion.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');
const DAY_MS = 86_400_000;

export async function scheduleSamplerExpiryWarnings(
  eventId: string,
  expiresAtIso: string,
): Promise<void> {
  try {
    // No Resend key configured → nothing can actually send. Return BEFORE
    // claiming the once-per-event lock below: otherwise the first sampler
    // capture made while email is unconfigured would burn the lock with zero
    // emails, and the day the owner keys Resend those events stay permanently
    // locked out of their reminders. Skipping here means a later capture (once
    // the key is live) still schedules them.
    if (!isEmailConfigured()) return;

    const expiresAt = new Date(expiresAtIso).getTime();
    if (!Number.isFinite(expiresAt)) return;
    const now = Date.now();
    const t7 = expiresAt - 7 * DAY_MS;
    const t1 = expiresAt - 1 * DAY_MS;
    // Nothing to schedule if both windows are already in the past.
    if (t7 <= now + 60_000 && t1 <= now + 60_000) return;

    const admin = createAdminClient();

    // Resolve the couple's email FIRST — no email, nothing to schedule (and we
    // avoid burning the once-per-event lock on an unreachable couple).
    const { data: coupleRow } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .limit(1)
      .maybeSingle();
    const coupleUserId = coupleRow?.user_id as string | undefined;
    if (!coupleUserId) return;

    const { data: userRow } = await admin
      .from('users')
      .select('email, display_name')
      .eq('id', coupleUserId)
      .maybeSingle();
    const to = ((userRow?.email as string | null) ?? '').trim();
    if (!to) return;
    const name = ((userRow?.display_name as string | null) ?? '').trim();

    // The PK insert is the idempotency lock: if a second capture already claimed
    // it (23505) or the table is absent, bail — we never double-schedule.
    const { error: lockErr } = await admin
      .from('papic_sampler_email_log')
      .insert({ event_id: eventId });
    if (lockErr) return;

    const link = `${APP_URL}/dashboard/${eventId}/studio/papic`;
    // Distinct subjects per send so the urgent T-1 doesn't collapse under the
    // T-7 in the couple's inbox thread (Gmail threads on subject).
    const subjectT7 = 'Your free Papic photos — keep them before they roll off';
    const subjectT1 = 'Last day — your free Papic photos roll off tomorrow';
    const body = (whenPhrase: string) =>
      `${name ? `Hi ${name},\n\n` : ''}Heads up — your free Papic sampler photos roll off Setnayan's free storage ${whenPhrase}.\n\n` +
      `Already connected Google Drive or upgraded to full Papic? You're all set — every original is safe, so you can ignore this.\n\n` +
      `If not, connect Google Drive (free) or upgrade to keep every photo forever:\n${link}\n\n— Setnayan`;
    // Branded HTML half — same content as the plain-text `body`, mirrored into
    // the v2.1 paper palette. sendEmail sends both; HTML-capable clients render
    // this, the rest fall back to `body`.
    const htmlBody = (whenPhrase: string) =>
      renderBrandedEmail({
        heading: 'Keep your free Papic photos',
        paragraphs: [
          `${name ? `Hi ${name} — ` : ''}your free Papic sampler photos roll off Setnayan's free storage ${whenPhrase}.`,
          `Already connected Google Drive or upgraded to full Papic? You're all set — every original is safe, so you can ignore this.`,
        ],
        ctaLabel: 'Keep my photos',
        ctaHref: link,
        footnote:
          'Connect Google Drive (free) or upgrade to full Papic to keep every photo forever.',
      });

    let t7Id: string | null = null;
    let t1Id: string | null = null;
    if (t7 > now + 60_000) {
      const r = await sendEmail({
        to,
        subject: subjectT7,
        text: body('in about a week'),
        html: htmlBody('in about a week'),
        scheduledAt: new Date(t7).toISOString(),
      });
      if (r.ok) t7Id = r.id;
    }
    if (t1 > now + 60_000) {
      const r = await sendEmail({
        to,
        subject: subjectT1,
        text: body('tomorrow'),
        html: htmlBody('tomorrow'),
        scheduledAt: new Date(t1).toISOString(),
      });
      if (r.ok) t1Id = r.id;
    }

    if (t7Id || t1Id) {
      await admin
        .from('papic_sampler_email_log')
        .update({ t7_email_id: t7Id, t1_email_id: t1Id })
        .eq('event_id', eventId);
    } else {
      // Key was present but both sends failed (e.g. a transient Resend error) —
      // nothing got scheduled, so release the lock we claimed above. A later
      // capture then retries; with no message ids there's nothing to double-
      // cancel, and a possible duplicate reminder beats zero reminders.
      await admin
        .from('papic_sampler_email_log')
        .delete()
        .eq('event_id', eventId);
    }
  } catch {
    /* best-effort — never breaks a capture */
  }
}

/**
 * Cancel the scheduled T-7/T-1 expiry warnings for an event after the couple
 * converts (connected Drive or upgraded to paid Papic → their sampler photos are
 * now permanent, so the "your free photos roll off" reminder would be wrong).
 * Reads the two Resend message ids from papic_sampler_email_log and cancels each,
 * then nulls the ids so a re-run is a no-op. Best-effort — never throws, so it
 * can sit safely inside a payment-activation or Drive-connect path.
 */
export async function cancelSamplerExpiryWarnings(eventId: string): Promise<void> {
  try {
    if (!eventId || !isEmailConfigured()) return;
    const admin = createAdminClient();
    const { data } = await admin
      .from('papic_sampler_email_log')
      .select('t7_email_id, t1_email_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!data) return;
    let cancelledAny = false;
    for (const id of [data.t7_email_id as string | null, data.t1_email_id as string | null]) {
      if (id && (await cancelScheduledEmail(id))) cancelledAny = true;
    }
    if (cancelledAny) {
      await admin
        .from('papic_sampler_email_log')
        .update({ t7_email_id: null, t1_email_id: null })
        .eq('event_id', eventId);
    }
  } catch {
    /* best-effort — must never break a conversion */
  }
}
