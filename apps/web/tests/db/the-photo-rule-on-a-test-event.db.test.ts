/**
 * 📸 THE PHOTO RULE, PROVED ON A TEST EVENT (owner 2026-11-03, DECISION_LOG "THE PHOTO RULE").
 *
 * A seeded test event in the replayed schema — never production, never `cale-ice`. The SQL the weekly sweep runs
 * (`papic_events_past_fullres_clock`) is called with the arguments the sweep now passes: the first-capture clock
 * `DEFAULT_FULL_RES_RETENTION_DAYS` (0) and the post-event floor `FULL_RES_POST_EVENT_GRACE_DAYS` (92).
 *
 *   · an event whose first photo was taken ONE day ago, which ended 92+ days ago, is past its clock — the old 183-day
 *     first-capture clock would have held it until day 183;
 *   · a multi-day event counts from its LAST day — 91 days after it ended, the originals are still kept;
 *   · the reminder stages land on day 60 · 80 · 89 of the same window, and none once the clock has run out.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid } from './replay-migrations';
import { DEFAULT_FULL_RES_RETENTION_DAYS, FULL_RES_POST_EVENT_GRACE_DAYS } from '../../lib/papic-fullres-drop-core';
import { dueOriginalsReminder } from '../../lib/papic-originals-reminder-core';

let db: PGlite;
const DAY = 86_400_000;

/** YYYY-MM-DD in Manila, N days before now (the DATE columns hold the local calendar day). */
const manilaDaysAgo = (n: number) => new Date(Date.now() + 8 * 3_600_000 - n * DAY).toISOString().slice(0, 10);

async function seedTestEvent(name: string, start: string, end: string | null, capturedDaysAgo: number): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_end_date)
     VALUES ($1, 'travel', $2::date, $3::date) RETURNING event_id`,
    [name, start, end],
  );
  const eventId = ev.rows[0]!.event_id;
  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Photo', 'Rule', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, display_r2_key, media_type, captured_at)
     VALUES ($1, $2, $3, $4, 'photo', $5)`,
    [
      eventId,
      guest.rows[0]!.guest_id,
      `r2://setnayan-media/papic/test/${eventId}.jpg`,
      `r2://setnayan-media/papic/test/${eventId}.display.avif`,
      new Date(Date.now() - capturedDaysAgo * DAY).toISOString(),
    ],
  );
  return eventId;
}

async function pastTheClock(): Promise<Set<string>> {
  const res = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.papic_events_past_fullres_clock($1::int, $2::int)`,
    [DEFAULT_FULL_RES_RETENTION_DAYS, FULL_RES_POST_EVENT_GRACE_DAYS],
  );
  return new Set(res.rows.map((r) => r.event_id));
}

before(async () => {
  db = (await createReplayedDb()).db;
  await setAuthUid(db, null);
});

after(async () => {
  await db?.close();
});

test('the sweep’s settings ARE the rule: no first-capture clock, 92 days after the last day', () => {
  assert.equal(DEFAULT_FULL_RES_RETENTION_DAYS, 0);
  assert.equal(FULL_RES_POST_EVENT_GRACE_DAYS, 92);
});

test('a test event 93 days after its last day is past the clock — even with a photo taken yesterday', async () => {
  // The old rule (183 days from the FIRST capture) would have held this one for another six months.
  const id = await seedTestEvent('TEST · photo rule · cleared', manilaDaysAgo(95), manilaDaysAgo(93), 1);
  assert.ok((await pastTheClock()).has(id), 'the originals are still held past 3 months after the last day');
});

test('a multi-day test event 91 days after its LAST day keeps its originals', async () => {
  const id = await seedTestEvent('TEST · photo rule · trip still inside', manilaDaysAgo(120), manilaDaysAgo(91), 200);
  assert.ok(!(await pastTheClock()).has(id), 'counted from the FIRST day — the last day lost its three months');
});

test('the reminders land on day 60 · 80 · 89 of the same window, and stop when the clock runs out', () => {
  const at = (daysAfterLast: number) => {
    const last = manilaDaysAgo(daysAfterLast);
    return dueOriginalsReminder(manilaDaysAgo(daysAfterLast + 3), last, Date.now())?.stage ?? null;
  };
  assert.equal(at(59), null);
  assert.equal(at(60), 60);
  assert.equal(at(80), 80);
  assert.equal(at(89), 89);
  assert.equal(at(92), null, 'a reminder after the clock ran out would promise originals that may be gone');
});
