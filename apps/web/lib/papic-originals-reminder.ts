import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { eventSkuActive } from '@/lib/entitlements';
import { FULL_RES_POST_EVENT_GRACE_DAYS } from '@/lib/papic-fullres-drop-core';
import {
  ORIGINALS_REMINDER_DAYS,
  addDays,
  dueOriginalsReminder,
  manilaToday,
  originalsReminderBody,
  originalsReminderTitle,
} from '@/lib/papic-originals-reminder-core';

/**
 * 📸 The photo rule's in-app reminders (owner 2026-11-03): day 60 / 80 / 89 after the event's last day, to every host
 * of an event whose originals are still kept. Rides the daily runner (`runDailyEmailJobs`, claim
 * `papic-originals-reminders`). IN-APP ONLY — `papic_originals_reminder` is not on the email allowlist.
 *
 * ONCE PER STAGE PER HOST, with no new column: a stage is done for a host when they already hold a
 * `papic_originals_reminder` for this event created at or after that stage's day. A missed run therefore sends the
 * LATEST due stage once, never a backlog of three.
 *
 * Fails soft and fails QUIET: any read error skips that event this pass (a reminder a day late is recoverable; a
 * wrong one is not), and nothing here can delete or change a photo.
 */

/** Bound one pass — the claim runs daily, so the remainder is picked up tomorrow. */
const MAX_EVENTS_PER_RUN = 300;
const KEEP_FULL_RES_SKU = 'HIGH_RES_ARCHIVE';

async function eventHasKeptOriginals(admin: ReturnType<typeof createAdminClient>, eventId: string): Promise<boolean> {
  // Two literal reads (never `.from(table)` — the select-column scan cannot check a table held in a variable).
  const seat = await admin
    .from('papic_photos')
    .select('event_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('full_res_dropped_at', null);
  if (seat.error) throw seat.error;
  if ((seat.count ?? 0) > 0) return true;
  const guest = await admin
    .from('papic_guest_captures')
    .select('event_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('full_res_dropped_at', null);
  if (guest.error) throw guest.error;
  return (guest.count ?? 0) > 0;
}

export async function runPapicOriginalsReminders(nowMs: number = Date.now()): Promise<{ events: number; sent: number }> {
  const admin = createAdminClient();
  const today = manilaToday(nowMs);
  // The last day of an event in the reminder window lies between (today − 91) and (today − 60).
  const earliest = addDays(today, -(FULL_RES_POST_EVENT_GRACE_DAYS - 1));
  const latest = addDays(today, -ORIGINALS_REMINDER_DAYS[0]);

  // Two reads because the last day is COALESCE(event_end_date, event_date): one for multi-day events (end date in
  // range), one for single-day events (no end date, start in range). `dueOriginalsReminder` re-checks every row.
  const [multi, single] = await Promise.all([
    admin
      .from('events')
      .select('event_id, display_name, event_date, event_end_date')
      .gte('event_end_date', earliest)
      .lte('event_end_date', latest)
      .limit(MAX_EVENTS_PER_RUN),
    admin
      .from('events')
      .select('event_id, display_name, event_date, event_end_date')
      .is('event_end_date', null)
      .gte('event_date', earliest)
      .lte('event_date', latest)
      .limit(MAX_EVENTS_PER_RUN),
  ]);
  if (multi.error) console.error('[supabase-error] lib/papic-originals-reminder.ts · events (multi-day)', multi.error);
  if (single.error) console.error('[supabase-error] lib/papic-originals-reminder.ts · events (one day)', single.error);

  type Ev = { event_id: string; display_name: string | null; event_date: string | null; event_end_date: string | null };
  const events = [...((multi.data ?? []) as Ev[]), ...((single.data ?? []) as Ev[])];
  let sent = 0;
  for (const ev of events) {
    const due = dueOriginalsReminder(ev.event_date, ev.event_end_date, nowMs);
    if (!due) continue;
    try {
      if (!(await eventHasKeptOriginals(admin, ev.event_id))) continue;
      // Keep-Full-Res owners keep their originals — nothing to remind (same skip as the drop and its warning).
      if (await eventSkuActive(admin, ev.event_id, KEEP_FULL_RES_SKU).catch(() => false)) continue;

      const { data: hosts, error: hostErr } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', ev.event_id)
        .eq('member_type', 'couple');
      if (hostErr) throw hostErr;
      const recipients = (hosts ?? []).map((h) => h.user_id as string | null).filter((id): id is string => Boolean(id));
      if (recipients.length === 0) continue;

      const { data: already, error: doneErr } = await admin
        .from('notifications')
        .select('user_id')
        .eq('type', 'papic_originals_reminder')
        .eq('event_id', ev.event_id)
        .in('user_id', recipients)
        .gte('created_at', due.stageStartIso);
      if (doneErr) throw doneErr;
      const done = new Set((already ?? []).map((r) => r.user_id as string));

      const name = ev.display_name?.trim() || 'Your event';
      for (const userId of recipients) {
        if (done.has(userId)) continue;
        await emitNotification({
          userId,
          type: 'papic_originals_reminder',
          title: originalsReminderTitle(due),
          body: originalsReminderBody(name),
          relatedUrl: `/dashboard/${ev.event_id}/memories`,
          eventId: ev.event_id,
        });
        sent += 1;
      }
    } catch (e) {
      console.error('[papic-originals-reminder] skipped an event this pass:', (e as Error)?.message ?? e);
    }
  }
  return { events: events.length, sent };
}
