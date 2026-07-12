import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { buildAnniversaryEmail, anniversaryUnsubscribeHeaders } from '@/lib/anniversary-emails';
import {
  buildRenewalReminderEmail,
  renewalUnsubscribeHeaders,
} from '@/lib/subscription-renewal-emails';
import { eventSkuActive } from '@/lib/entitlements';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';

/**
 * CRON-FREE daily email jobs — the anniversary digest, subscription-renewal
 * reminders, and the Papic full-res drop warning, extracted VERBATIM from the
 * retired /api/cron/{anniversary-digest,renewal-reminders,papic-fullres-drop-
 * warning} routes (their post-auth bodies were `req`-free). Each keeps its own
 * atomic idempotency lock (email_log unique / warned_at stamp), so a double-fire
 * can never double-send. Driven by PUBLIC-surface `after()` traffic (app/page +
 * explore) so they run daily even when no admin/vendor is online — same reason
 * digest-flush picks public traffic.
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

// ── Anniversary "on this day" digest ─────────────────────────────────────────
const ANNIVERSARY_MAX_BATCH = 200;

/** Today's date as YYYY-MM-DD in Asia/Manila (UTC+8, no DST). */
function manilaTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type AnniversaryCandidate = {
  event_id: string;
  display_name: string | null;
  slug: string | null;
  event_date: string;
  years_ago: number;
  couple_user_id: string;
  couple_email: string;
  couple_name: string | null;
};

export async function runAnniversaryDigest(): Promise<{ scanned: number; sent: number }> {
  const pToday = manilaTodayIso();
  const anniversaryYear = Number(pToday.slice(0, 4));
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('couples_with_anniversary_today', { p_today: pToday });
  if (error) {
    console.error('[anniversary-digest] rpc failed:', error.message);
    return { scanned: 0, sent: 0 };
  }
  const candidates = ((data ?? []) as AnniversaryCandidate[]).slice(0, ANNIVERSARY_MAX_BATCH);

  let sent = 0;
  for (const c of candidates) {
    try {
      // Claim the per-anniversary lock FIRST. A unique-violation (23505) means
      // it's already been sent this year — skip without sending.
      const { error: lockErr } = await admin
        .from('anniversary_email_log')
        .insert({ event_id: c.event_id, anniversary_year: anniversaryYear });
      if (lockErr) continue;

      const to = (c.couple_email ?? '').trim();
      if (!to) continue; // no reachable address; lock already claimed → no retry

      const { subject, text, html } = buildAnniversaryEmail({
        coupleName: (c.couple_name ?? '').trim() || (c.display_name ?? '').trim(),
        eventName: (c.display_name ?? '').trim(),
        yearsAgo: c.years_ago,
        ctaHref: `${APP_URL}/dashboard/library?tab=photos`,
      });

      const result = await sendEmail({ to, subject, text, html, headers: anniversaryUnsubscribeHeaders() });
      if (result.ok) {
        sent += 1;
        await admin
          .from('anniversary_email_log')
          .update({ resend_id: result.id })
          .eq('event_id', c.event_id)
          .eq('anniversary_year', anniversaryYear);
      } else {
        // Send failed / Resend unconfigured — release the lock so a later run
        // retries. A possible duplicate beats a silently-dropped anniversary.
        await admin
          .from('anniversary_email_log')
          .delete()
          .eq('event_id', c.event_id)
          .eq('anniversary_year', anniversaryYear);
      }
    } catch (e) {
      console.error('[anniversary-digest] candidate failed:', c.event_id, e);
    }
  }
  return { scanned: candidates.length, sent };
}

// ── Subscription renewal reminders ───────────────────────────────────────────
const REMINDER_DAYS = 7;

function productTitleFor(serviceKey: string): string {
  if (serviceKey === 'EVENT_SUBDOMAIN' || serviceKey === 'vendor_subdomain') return 'Custom Subdomain';
  return 'Setnayan subscription';
}

type RenewalCandidate = {
  order_id: string;
  service_key: string;
  expires_at: string;
  buyer_email: string;
  buyer_name: string | null;
};

export async function runRenewalReminders(): Promise<{ scanned: number; sent: number }> {
  const admin = createAdminClient();
  const window = `${REMINDER_DAYS}d`;

  const { data, error } = await admin.rpc('subscriptions_due_for_renewal_reminder', {
    p_days: REMINDER_DAYS,
  });
  if (error) {
    console.error('[renewal-reminders] rpc failed:', error.message);
    return { scanned: 0, sent: 0 };
  }
  const candidates = (data ?? []) as RenewalCandidate[];
  let sent = 0;

  for (const c of candidates) {
    try {
      // Atomic idempotency lock — insert first; a duplicate (already reminded
      // this window) trips UNIQUE (order_id, reminder_window) → skip.
      const { error: lockErr } = await admin
        .from('renewal_reminder_log')
        .insert({ order_id: c.order_id, reminder_window: window });
      if (lockErr) continue;

      const email = buildRenewalReminderEmail({
        name: c.buyer_name,
        productTitle: productTitleFor(c.service_key),
        expiresAt: new Date(c.expires_at),
        renewUrl: `${APP_URL}/pricing`,
      });
      await sendEmail({
        to: c.buyer_email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: renewalUnsubscribeHeaders(),
      });
      sent += 1;
    } catch {
      // Release the lock so a later run can retry this candidate.
      await admin
        .from('renewal_reminder_log')
        .delete()
        .eq('order_id', c.order_id)
        .eq('reminder_window', window);
    }
  }
  return { scanned: candidates.length, sent };
}

// ── Papic full-res drop warning ──────────────────────────────────────────────
const WARN_LEAD_DAYS = 14;

function retentionDays(): number {
  const n = Number(process.env.PAPIC_FULLRES_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}

export async function runPapicDropWarning(): Promise<{ candidates: number; sent: number }> {
  const admin = createAdminClient();
  const days = retentionDays();
  const cutoff = new Date(Date.now() - (days - WARN_LEAD_DAYS) * 86_400_000).toISOString();

  const [seat, guest] = await Promise.all([
    admin
      .from('papic_photos')
      .select('event_id')
      .eq('photo_type', 'photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoff)
      .limit(4000),
    admin
      .from('papic_guest_captures')
      .select('event_id')
      .or('media_type.is.null,media_type.eq.photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoff)
      .limit(4000),
  ]);
  const eventIds = [
    ...new Set([...(seat.data ?? []), ...(guest.data ?? [])].map((r) => r.event_id as string)),
  ];
  if (eventIds.length === 0) return { candidates: 0, sent: 0 };

  const { data: events } = await admin
    .from('events')
    .select('event_id, display_name, full_res_drop_warned_at')
    .in('event_id', eventIds)
    .is('full_res_drop_warned_at', null);

  let sent = 0;
  for (const ev of events ?? []) {
    const eventId = ev.event_id as string;
    // Keep-Full-Res owners keep their originals — no drop, no warning.
    if (await eventSkuActive(admin, eventId, 'HIGH_RES_ARCHIVE').catch(() => false)) continue;

    const { data: member } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .limit(1)
      .maybeSingle();
    if (!member?.user_id) continue;

    const { data: user } = await admin
      .from('users')
      .select('email')
      .eq('id', member.user_id as string)
      .maybeSingle();
    const email = (user?.email as string | null) ?? null;
    if (!email) continue;

    const name = (ev.display_name as string | null) ?? 'your wedding';
    const res = await sendEmail({
      to: email,
      subject: `Your ${name} full-resolution photos — a quick heads-up`,
      text: `Hi! Your ${name} gallery on Setnayan stays online forever, free.\n\nIn about two weeks, we compress the copies we host to keep them light — your full-resolution originals live in your own Google Drive (if you connected it). Two things you can do before then:\n\n• Download your full-res photos any time from your gallery ("Download all").\n• Connect Google Drive so every original is saved to your own account automatically.\n• Or add Keep Full-Res so we hold every pristine original for you (₱999/year).\n\nEither way, nothing is lost — your online gallery keeps every photo. This is just a heads-up so you can grab the full-res if you'd like.\n\n— Setnayan`,
    });
    // Only mark warned when the email actually went (or the address is dead) —
    // if Resend isn't configured yet, leave it unwarned so it retries later.
    if (res.ok || res.reason === 'placeholder_recipient') {
      await admin
        .from('events')
        .update({ full_res_drop_warned_at: new Date().toISOString() })
        .eq('event_id', eventId);
      if (res.ok) sent += 1;
    }
  }
  return { candidates: events?.length ?? 0, sent };
}

// ── Grouped public runner ────────────────────────────────────────────────────
/**
 * Fire the daily email jobs off PUBLIC-surface traffic. Each is claim-gated to
 * ~once/day (so exactly one visitor's request per day does the work) and keeps
 * its own send-idempotency lock. Best-effort, never throws.
 */
export async function runDailyEmailJobs(): Promise<void> {
  try {
    if (await claimPeriodicJob('anniversary-digest', DAILY_GAP_MS)) await runAnniversaryDigest();
  } catch {
    /* best-effort */
  }
  try {
    if (await claimPeriodicJob('renewal-reminders', DAILY_GAP_MS)) await runRenewalReminders();
  } catch {
    /* best-effort */
  }
  try {
    if (await claimPeriodicJob('papic-fullres-drop-warning', DAILY_GAP_MS)) await runPapicDropWarning();
  } catch {
    /* best-effort */
  }
}
