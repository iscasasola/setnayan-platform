import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { PASSED_AWAY, type GuestRole } from '@/lib/guests';
import { readGuestReminders, resolveReplyBy } from '@/lib/rsvp-ask';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { hasReplied } from '@/lib/venue-disclosure';
import { buildInvitationUrl } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { fetchPublicScheduleBlocks, formatBlockTimeRange } from '@/lib/schedule';
import { loadVenueBookings, resolveEventVenues, firstVenue } from '@/lib/event-venues';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { sanitizeTicks, daysUntil } from '@/lib/guest-checklist';
import { guestChecklistItems } from '@/app/[slug]/_lib/guest-checklist-facts';
import { isSendableEmail, resolveCoupleName, type StdGuestRow } from '@/lib/save-the-date-emails-core';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  buildGuestReminderEmail,
  dueMilestone,
  reminderEventDates,
  replyByLine,
  todayInZone,
  untickedItems,
  type ReminderMilestone,
} from '@/lib/guest-reminder-emails-core';

/**
 * GUEST REMINDER EMAILS — 30 · 7 · 1 DAYS BEFORE THE EVENT. The sender.
 *
 * Owner 2026-09-26 (DECISION_LOG "THE LAST 30 DAYS: EACH GUEST GETS YOUR
 * CHECKLIST"): optional reminder emails at 30 / 7 / 1 days to identified guests
 * who have an email; the couple can switch them off; each links to the guest's
 * own page and lists only the checklist items they have NOT ticked; an
 * unreplied guest gets "Reply by <date>" first. No SMS in V1.
 *
 * ── MECHANISM ──────────────────────────────────────────────────────────────
 * Cron-free, like every other periodic job: `runDailyEmailJobs` claims the
 * `guest-reminder-emails` window every ~6 hours off public traffic
 * (`GUEST_REMINDER_GAP_MS`, declared in the registry). This body then:
 *
 *   1. asks for events whose `event_date` is one of the seven days that could
 *      owe a reminder today (`reminderEventDates`) — one indexed lookup, and
 *      on most days it returns nothing;
 *   2. per event, re-decides the milestone in the EVENT'S OWN calendar
 *      (`events.timezone` → venue coordinates → Manila), reads the couple's
 *      switch from the LIVE `rsvp_ask_config`, and gathers the checklist facts
 *      once (first schedule block, venues, tables, ticks);
 *   3. per guest, claims the lock FIRST — an insert into
 *      `guest_reminder_email_log` keyed (guest, milestone, event date). Two
 *      requests racing the same window both insert; exactly one wins (23505 for
 *      the other), so the same reminder can never go twice. Only then does it
 *      send, and a refused send deletes the lock so a later window retries.
 *
 * ── WHO IS NEVER EMAILED ───────────────────────────────────────────────────
 *   · a guest with no (or a junk) email — the 141 of 146 on one live wedding;
 *     they are the shared link's audience, not this job's;
 *   · a guest marked Passed away, or deleted;
 *   · a guest who DECLINED — "what to wear" to someone who said no is a nudge
 *     nobody asked for;
 *   · a guest with no invite key (`qr_token`) — the email must link THEIR page,
 *     and without a key there is no such page to link;
 *   · a guest whose checklist is fully ticked and who has replied — there is
 *     nothing left to remind them of, so nothing is sent (and no lock claimed,
 *     so a later untick still earns the next milestone).
 *
 * ── THE TWO GATES THAT SEND NOTHING, SILENTLY, ON PURPOSE ─────────────────
 *   · no Resend key → return before touching a lock, so the day the owner keys
 *     Resend the due reminders still go (mirrors `fanOutSaveTheDateEmails`);
 *   · the couple's switch off (`readGuestReminders` false) → that event is
 *     skipped whole. Absent means ON.
 *
 * ⚠ THE EMAIL ALLOWLIST (`lib/notification-emit.ts`) DOES NOT APPLY HERE, and
 * saying so is the point of this paragraph: that allowlist gates emails to
 * ACCOUNTS through `emitNotification`. A guest is not an account. Guest mail
 * goes through `sendEmail` directly, exactly as the save-the-date and the
 * invitation do, and carries the same RFC 8058 List-Unsubscribe header and the
 * same "reply unsubscribe" line. There is no per-guest email opt-out column
 * today (`guests.scan_tracking_opt_out` is about QR scans, not mail) — the
 * couple's switch and the unsubscribe header are the two levers that exist.
 *
 * ── WHAT THE VENUE SAYS ────────────────────────────────────────────────────
 * Directions (the address, the Maps link) are passed to the checklist facts
 * ONLY for a guest who has replied — the same `hasReplied` rule the page uses
 * before it un-withholds the venue (`lib/venue-disclosure.ts`). An unreplied
 * guest's email names the venue and no more.
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');
const EVENTS_MAX_BATCH = 200;
const GUESTS_MAX_BATCH = 1000;
const IANA_TZ = /^[A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$/;

type ReminderEventRow = {
  event_id: string;
  slug: string | null;
  display_name: string | null;
  bride_name: string | null;
  groom_name: string | null;
  event_date: string | null;
  timezone: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | string | null;
  venue_longitude: number | string | null;
  std_film_ceremony_name: string | null;
  std_film_venue_name: string | null;
  dress_code_config: unknown;
  role_palette: unknown;
  guest_list_edit_deadline: string | null;
  guest_count_locked_at: string | null;
  rsvp_ask_config: unknown;
};

type ReminderGuestRow = StdGuestRow & {
  role: GuestRole | null;
  rsvp_status: string | null;
  qr_token: string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export type GuestReminderRunSummary = { events: number; scanned: number; sent: number };

export async function runGuestReminderEmails(now: Date = new Date()): Promise<GuestReminderRunSummary> {
  // No Resend key → nothing can send. Return BEFORE any lock is claimed, so the
  // day Resend is keyed the reminders that are due still go out.
  if (!(await isEmailConfigured())) return { events: 0, scanned: 0, sent: 0 };

  const admin = createAdminClient();
  const dates = reminderEventDates(todayInZone(null, now));

  const { data: events, error: eventsErr } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, bride_name, groom_name, event_date, timezone, venue_name, venue_address, venue_latitude, venue_longitude, std_film_ceremony_name, std_film_venue_name, dress_code_config, role_palette, guest_list_edit_deadline, guest_count_locked_at, rsvp_ask_config',
    )
    .in('event_date', dates)
    .not('slug', 'is', null)
    .limit(EVENTS_MAX_BATCH);
  if (eventsErr) {
    logQueryError('guest-reminder-emails: events.select', eventsErr);
    return { events: 0, scanned: 0, sent: 0 };
  }

  let scanned = 0;
  let sent = 0;
  let touched = 0;
  for (const ev of (events ?? []) as ReminderEventRow[]) {
    try {
      const r = await remindOneEvent(admin, ev, now);
      if (!r) continue;
      touched += 1;
      scanned += r.scanned;
      sent += r.sent;
    } catch (e) {
      console.error('[guest-reminder-emails] event failed:', ev.event_id, e);
    }
  }
  return { events: touched, scanned, sent };
}

async function remindOneEvent(
  admin: ReturnType<typeof createAdminClient>,
  ev: ReminderEventRow,
  now: Date,
): Promise<{ scanned: number; sent: number } | null> {
  // 🔘 THE COUPLE'S SWITCH — read from the LIVE column. Off → this event sends nothing.
  if (!readGuestReminders(ev.rsvp_ask_config)) return null;
  if (!ev.slug || !ev.event_date) return null;

  // The event's own calendar decides which day it is.
  const lat = num(ev.venue_latitude);
  const lng = num(ev.venue_longitude);
  const tz = IANA_TZ.test((ev.timezone ?? '').trim()) ? (ev.timezone as string).trim() : eventTimezoneFromCoords(lat, lng);
  const today = todayInZone(tz, now);
  const milestone = dueMilestone({ eventDate: ev.event_date, today });
  if (milestone == null) return null;
  const daysLeft = daysUntil({ eventDate: ev.event_date, today }) ?? milestone;

  const { data: guestsRaw, error: guestsErr } = await admin
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, email, role, rsvp_status, qr_token')
    .eq('event_id', ev.event_id)
    .is('deleted_at', null)
    // 🕯 Never to a guest the couple marked "Passed away".
    .eq(PASSED_AWAY, false)
    .neq('rsvp_status', 'declined')
    .not('email', 'is', null)
    .not('qr_token', 'is', null)
    .limit(GUESTS_MAX_BATCH);
  if (guestsErr) {
    logQueryError('guest-reminder-emails: guests.select', guestsErr, { event_id: ev.event_id });
    return { scanned: 0, sent: 0 };
  }
  const guests = ((guestsRaw ?? []) as ReminderGuestRow[]).filter((g) => isSendableEmail(g.email) && g.qr_token);
  if (guests.length === 0) return { scanned: 0, sent: 0 };

  // ── The facts every guest's checklist shares, gathered ONCE per event ──
  const [blocks, bookings, ownerSlug, ticksRes, seatsRes] = await Promise.all([
    fetchPublicScheduleBlocks(admin, ev.event_id, true),
    loadVenueBookings(admin, ev.event_id),
    resolveEventOwnerSlug(admin, ev.event_id),
    admin.from('guest_checklist_ticks').select('guest_id, ticks').eq('event_id', ev.event_id),
    admin.from('event_seat_assignments').select('guest_id, table_id').eq('event_id', ev.event_id),
  ]);
  if (ticksRes.error) logQueryError('guest-reminder-emails: guest_checklist_ticks.select', ticksRes.error, { event_id: ev.event_id });
  if (seatsRes.error) logQueryError('guest-reminder-emails: event_seat_assignments.select', seatsRes.error, { event_id: ev.event_id });

  // The FIRST block of the day, read with the programme's own formatter (the
  // schedule stores the venue's wall clock parked in UTC — never re-zone it).
  const firstBlock = blocks[0] ?? null;
  const arriveBy = firstBlock?.start_at ? formatBlockTimeRange(firstBlock.start_at, null) || null : null;
  const place = firstVenue({ venues: resolveEventVenues(bookings, ev) });
  const venueName = place ? place.name : ev.venue_name;
  const venueAddress = place ? place.address : ev.venue_address;
  const venueLat = place ? place.latitude : lat;
  const venueLng = place ? place.longitude : lng;

  const ticksByGuest = new Map<string, string[]>();
  for (const row of (ticksRes.data ?? []) as { guest_id: string; ticks: unknown }[]) {
    ticksByGuest.set(row.guest_id, sanitizeTicks(row.ticks));
  }

  const tableIdByGuest = new Map<string, string>();
  for (const row of (seatsRes.data ?? []) as { guest_id: string; table_id: string | null }[]) {
    if (row.table_id) tableIdByGuest.set(row.guest_id, row.table_id);
  }
  const tableLabelById = new Map<string, string>();
  const tableIds = [...new Set(tableIdByGuest.values())];
  if (tableIds.length > 0) {
    const { data: tables, error: tablesErr } = await admin
      .from('event_tables')
      .select('table_id, table_label, link_group_label')
      .in('table_id', tableIds);
    if (tablesErr) logQueryError('guest-reminder-emails: event_tables.select', tablesErr, { event_id: ev.event_id });
    for (const t of (tables ?? []) as { table_id: string; table_label: string; link_group_label: string | null }[]) {
      // The linked group ("VIP Section") over the single table, as the hub card does.
      tableLabelById.set(t.table_id, t.link_group_label ?? t.table_label);
    }
  }

  const coupleName = resolveCoupleName(ev);
  const listClosed = guestListIsClosed({
    lockedAt: ev.guest_count_locked_at,
    editDeadline: ev.guest_list_edit_deadline,
    eventDate: ev.event_date,
    nowMs: now.getTime(),
  });
  const replyBy = resolveReplyBy({ deadline: ev.guest_list_edit_deadline, eventDate: ev.event_date });

  let sent = 0;
  for (const g of guests) {
    try {
      const replied = hasReplied(g.rsvp_status as 'pending' | 'attending' | 'declined' | 'maybe' | null);
      const items = guestChecklistItems({
        role: g.role,
        dressCodeConfig: ev.dress_code_config ?? null,
        rolePalette: ev.role_palette,
        arriveBy,
        venueName,
        // Directions open only once they have replied — the page's own rule.
        venueAddress: replied ? venueAddress : null,
        venueLatitude: replied ? venueLat : null,
        venueLongitude: replied ? venueLng : null,
        tableLabel: tableLabelById.get(tableIdByGuest.get(g.guest_id) ?? '') ?? null,
      });
      const pending = untickedItems(items, ticksByGuest.get(g.guest_id) ?? []);
      const replyLine = replyByLine({ rsvpStatus: g.rsvp_status, replyBy, today, listClosed });
      // Nothing left to say → no email, and no lock (an untick later still earns the next one).
      if (pending.length === 0 && !replyLine) continue;

      const sendResult = await sendOne(admin, {
        eventId: ev.event_id,
        guest: g,
        milestone,
        eventDate: ev.event_date,
        build: () =>
          buildGuestReminderEmail({
            guest: g,
            coupleName,
            eventDateIso: ev.event_date as string,
            daysLeft,
            milestone,
            pending,
            replyBy: replyLine,
            pageUrl: buildInvitationUrl({ appUrl: APP_URL, slug: ev.slug as string, qrToken: g.qr_token as string, ownerSlug }),
          }),
      });
      if (sendResult === 'sent') sent += 1;
    } catch (e) {
      console.error('[guest-reminder-emails] guest failed:', g.guest_id, e);
    }
  }
  return { scanned: guests.length, sent };
}

/**
 * Claim the lock, then send. The ORDER is the idempotency: the insert is the
 * only thing two racing windows can both attempt, and the PRIMARY KEY lets one
 * through. 'already' = another run owns this reminder; 'sent'; 'failed' = the
 * lock was released for a later retry.
 */
async function sendOne(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    eventId: string;
    guest: ReminderGuestRow;
    milestone: ReminderMilestone;
    eventDate: string;
    build: () => { subject: string; text: string; html: string; headers: Record<string, string> };
  },
): Promise<'sent' | 'already' | 'failed'> {
  const key = { guest_id: input.guest.guest_id, milestone_days: input.milestone, event_date: input.eventDate };
  const { error: lockErr } = await admin
    .from('guest_reminder_email_log')
    .insert({ ...key, event_id: input.eventId });
  if (lockErr) {
    // 23505 = this guest's reminder for this milestone and date already went —
    // the lock doing its job. Anything else is a dropped reminder and must not
    // stay silent.
    if (lockErr.code !== '23505') {
      logQueryError('guest-reminder-emails: guest_reminder_email_log.insert', lockErr, { guest_id: input.guest.guest_id });
      return 'failed';
    }
    return 'already';
  }

  const mail = input.build();
  const res = await sendEmail({
    to: (input.guest.email ?? '').trim(),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: mail.headers,
    kind: 'guest-reminder',
  });
  if (res.ok) {
    const { error: stampErr } = await admin
      .from('guest_reminder_email_log')
      .update({ resend_id: res.id })
      .eq('guest_id', key.guest_id)
      .eq('milestone_days', key.milestone_days)
      .eq('event_date', key.event_date);
    if (stampErr) logQueryError('guest-reminder-emails: guest_reminder_email_log.update', stampErr, { guest_id: input.guest.guest_id });
    return 'sent';
  }
  // Send refused (Resend down, 429, address dead) — release the lock so a
  // later window retries. A possible duplicate beats a reminder nobody got.
  const { error: releaseErr } = await admin
    .from('guest_reminder_email_log')
    .delete()
    .eq('guest_id', key.guest_id)
    .eq('milestone_days', key.milestone_days)
    .eq('event_date', key.event_date);
  if (releaseErr) logQueryError('guest-reminder-emails: guest_reminder_email_log.delete', releaseErr, { guest_id: input.guest.guest_id });
  return 'failed';
}
