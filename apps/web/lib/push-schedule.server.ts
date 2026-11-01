import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { DAILY_GAP_MS } from '@/lib/periodic-job-registry';
import { isAnyPushConfigured, sendPush, sendPushForNotice } from '@/lib/push-send.server';
import { pushRsvpReply } from '@/lib/rsvp-push.server';
import { eventIdFromRelatedUrl } from '@/lib/notification-event-id';
import type { NotificationType } from '@/lib/notifications';
import {
  eveningSummaryOpen,
  eveningSummarySentence,
  lastQuietWindow,
  manilaToday,
  morningReleaseOpen,
  typesAtLevel,
} from '@/lib/push-levels';
import { planMorningRelease, summaryCounts, summaryUrl, type HeldRow } from '@/lib/push-schedule';

/**
 * THE TWO SCHEDULED PHONE MOMENTS (owner 2026-10-31, "Yes, add them"):
 *
 *   · THE 7 AM RELEASE — Normal notices held through quiet hours (10 pm to 7 am,
 *     Manila) go out together, collapsed per kind.
 *   · THE EVENING SUMMARY — one push a day from 7 pm counting the day's Low notices:
 *     "Today on your event: 3 updates", opening the bell.
 *
 * 🔑 NO NEW STATE. A held notice is its bell row; a row read before the release is
 * not pushed. Each moment runs once a day through `runClaimedJob` (`cron_job_runs`).
 *
 * ⚠ CRON-FREE, LIKE EVERY JOB HERE: there is no scheduler, so "7 am" is the first
 * request after 7 am (public pages and event pages carry it). A day with no traffic
 * at all before 10 pm sends nothing that day; the rows stay in the bell.
 *
 * 📏 CAPACITY: one run reads at most ROW_CAP rows and sends to the users holding a
 * push subscription, a few at a time, inside one `after()` budget. Past that scale
 * this needs a real queue; the cap keeps it from running away until then.
 *
 * No email anywhere in this file.
 */

const ROW_CAP = 5000;
const CONCURRENT_SENDS = 8;
/** Per instance: most requests answer from memory and never touch the database. */
const CHECK_THROTTLE_MS = 5 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;
let lastCheckMs = 0;

/** Only people who can receive a push are worth a send: `push_subscriptions` was empty in prod when this shipped. */
async function usersWithPush(admin: Admin, userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('user_id')
      .in('user_id', userIds.slice(i, i + 200));
    if (error) throw new Error(`push-schedule: subscriptions read refused: ${error.message}`);
    for (const r of (data ?? []) as { user_id: string }[]) out.add(r.user_id);
  }
  return out;
}

async function inBatches<T>(items: T[], send: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENT_SENDS) {
    await Promise.all(items.slice(i, i + CONCURRENT_SENDS).map(send));
  }
}

async function readRows(admin: Admin, types: NotificationType[], startMs: number, endMs: number): Promise<HeldRow[]> {
  const { data, error } = await admin
    .from('notifications')
    .select('user_id, type, title, body, related_url, event_id, created_at')
    .in('type', types)
    .is('read_at', null)
    .gte('created_at', new Date(startMs).toISOString())
    .lt('created_at', new Date(endMs).toISOString())
    .order('created_at', { ascending: true })
    .limit(ROW_CAP);
  if (error) throw new Error(`push-schedule: rows read refused: ${error.message}`);
  return (data ?? []) as HeldRow[];
}

/** The 7 am release. Returns how many notices went out. */
export async function runMorningRelease(nowMs: number = Date.now()): Promise<number> {
  const admin = createAdminClient();
  const { startMs, endMs } = lastQuietWindow(nowMs);
  const rows = await readRows(admin, typesAtLevel('normal'), startMs, endMs);
  const reachable = await usersWithPush(admin, [...new Set(rows.map((r) => r.user_id))]);
  const plan = planMorningRelease(rows.filter((r) => reachable.has(r.user_id)));
  await inBatches(plan, async (p) => {
    // A reply counts the host's unread replies itself; everything else is its latest row.
    if (p.rsvpEventId) await pushRsvpReply(p.row.user_id, p.rsvpEventId);
    else {
      await sendPushForNotice({
        userId: p.row.user_id,
        type: p.row.type,
        title: p.row.title,
        body: p.row.body,
        relatedUrl: p.row.related_url,
        eventId: p.row.event_id ?? eventIdFromRelatedUrl(p.row.related_url),
      });
    }
  });
  return plan.length;
}

/** The one evening summary. Returns how many people got it. */
export async function runEveningSummary(nowMs: number = Date.now()): Promise<number> {
  const admin = createAdminClient();
  const { startMs, endMs } = manilaToday(nowMs);
  const rows = await readRows(admin, typesAtLevel('low'), startMs, endMs);
  const reachable = await usersWithPush(admin, [...new Set(rows.map((r) => r.user_id))]);
  const people = summaryCounts(rows.filter((r) => reachable.has(r.user_id)));
  await inBatches(people, async (p) => {
    await sendPush(p.userId, {
      sentence: eveningSummarySentence({ count: p.count, events: p.eventIds.length }),
      url: summaryUrl(p.vendorSide),
      collapseKey: 'summary:today',
      level: 'low',
      // One event → its name is the title; several → "Setnayan".
      eventId: p.eventIds.length === 1 ? p.eventIds[0]! : null,
    });
  });
  return people.length;
}

/**
 * CRON-FREE tick. Asked of public pages and event pages; the clock is checked BEFORE
 * the claim, because a claim taken outside its window would burn the day's run.
 * Never throws.
 */
export async function maybeRunPushSchedule(nowMs: number = Date.now()): Promise<void> {
  if (nowMs - lastCheckMs < CHECK_THROTTLE_MS) return;
  lastCheckMs = nowMs;
  if (!isAnyPushConfigured()) return;
  if (morningReleaseOpen(nowMs)) {
    await runClaimedJob('push-morning-release', DAILY_GAP_MS, () => runMorningRelease(nowMs));
  }
  if (eveningSummaryOpen(nowMs)) {
    await runClaimedJob('push-evening-summary', DAILY_GAP_MS, () => runEveningSummary(nowMs));
  }
}
