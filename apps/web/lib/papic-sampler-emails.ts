import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';

// Free Papic sampler — cron-free expiry-warning emails.
//
// Called from the capture after() hook on EVERY sampler capture, but self-guards
// to fire ONCE per event (the papic_sampler_email_log PK is the lock). On the
// first sampler photo we hand Resend two future-dated emails — ~7 days and ~1
// day before the 30-day expiry — and Resend delivers them at that time. No cron,
// no scheduler on our side; the provider does the time-triggering (Resend allows
// scheduling up to 30 days out, so T-7 ≈ 23 days and T-1 ≈ 29 days both fit).
//
// The copy is worded so it's correct whether or not the couple later keeps the
// photos ("ignore this if you've already connected Drive or upgraded"), so we
// don't need to cancel on Drive-connect / upgrade — the stored message ids leave
// that as an optional future refinement. Never throws: a hiccup here must never
// break a capture.

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

    const link = `${APP_URL}/dashboard/${eventId}/add-ons/papic`;
    const subject = 'Your free Papic photos — keep them before they roll off';
    const body = (whenPhrase: string) =>
      `${name ? `Hi ${name},\n\n` : ''}Heads up — your free Papic sampler photos roll off Setnayan's free storage ${whenPhrase}.\n\n` +
      `Already connected Google Drive or upgraded to full Papic? You're all set — every original is safe, so you can ignore this.\n\n` +
      `If not, connect Google Drive (free) or upgrade to keep every photo forever:\n${link}\n\n— Setnayan`;

    let t7Id: string | null = null;
    let t1Id: string | null = null;
    if (t7 > now + 60_000) {
      const r = await sendEmail({
        to,
        subject,
        text: body('in about a week'),
        scheduledAt: new Date(t7).toISOString(),
      });
      if (r.ok) t7Id = r.id;
    }
    if (t1 > now + 60_000) {
      const r = await sendEmail({
        to,
        subject,
        text: body('tomorrow'),
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
