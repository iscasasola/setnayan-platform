/**
 * THE ON-AIR INSTANT IS DECIDED BY THE DATABASE, NEVER BY THE CALLER.
 *
 * `events.panood_manual_on_air_at` is the trace left by a host who starts their own
 * livestream and presses "We're on air" — the route that, until Setnayan's own
 * YouTube channel is connected, is the only one that works. It exists to light up
 * the red tally and the ⚡ Moment button.
 *
 * ── WHY IT IS A SECURITY OBJECT AND NOT A PREFERENCE ──────────────────────────
 * It is ALSO handed to the paid multi-cam window as `broadcastStartedAt`. The
 * never-interrupt rule keeps multi-cam alive for a broadcast that was already
 * running when a purchased event-day lapsed, and it is bounded by that instant:
 *
 *     started INSIDE the window  → protected, finishes clean
 *     started AFTER it lapsed    → a new go-live, no protection
 *
 * So a caller who could choose the value could BACKDATE it to just inside a lapsed
 * window and hold ₱2,999 multi-cam open indefinitely. That is the "the row is yours,
 * the field is not" shape: a field recording a FACT, sitting in a row the host
 * legitimately owns.
 *
 * ── WHAT THESE TESTS ASSERT ───────────────────────────────────────────────────
 * Not merely "the write was refused" — the write is deliberately ACCEPTED, because
 * a host turning themselves on air is legitimate. What must hold is that the stored
 * instant is the database's `now()` and not the caller's number. So every test reads
 * the row back and checks the VALUE.
 *
 * The final test drops the trigger and shows the backdate landing, because a guard
 * that has never been observed failing is decoration.
 *
 * ⚠ Grants are NOT asserted here: this replay runs as SUPERUSER, so a permission
 * test would pass no matter what the grants say (lesson of 2026-08-12). The column
 * deliberately carries no grant; that is verified against prod by the object.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const COLUMN = 'panood_manual_on_air_at';
const TRIGGER = 'trg_panood_manual_on_air_stamp';
/** Comfortably inside any plausible lapsed window — the value an attacker wants. */
const BACKDATE = '2020-01-01T00:00:00.000Z';

let eventId: string;

async function freshEvent(): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Manual On Air Test', 'birthday') RETURNING event_id`,
  );
  return ev.rows[0]!.event_id;
}

async function readAir(id: string): Promise<Date | null> {
  const r = await db.query<{ v: Date | null }>(
    `SELECT ${COLUMN} AS v FROM public.events WHERE event_id = $1`,
    [id],
  );
  return r.rows[0]?.v ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  eventId = await freshEvent();
});

after(async () => {
  await db?.close?.();
});

test('the column exists and an event is not born on air', async () => {
  assert.equal(await readAir(eventId), null, 'a new event must start off air');
});

test('the stamp trigger is actually attached to events', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgrelid = 'public.events'::regclass AND tgname = $1 AND NOT tgisinternal`,
    [TRIGGER],
  );
  assert.equal(r.rows[0]!.n, 1, 'the guard must be attached, not merely defined');
});

test('MONEY: going on air with a BACKDATED value stores now(), not the backdate', async () => {
  const before = new Date();
  await db.query(`UPDATE public.events SET ${COLUMN} = $1 WHERE event_id = $2`, [
    BACKDATE,
    eventId,
  ]);
  const stored = await readAir(eventId);

  assert.ok(stored, 'the host is on air — the write is legitimate and must be accepted');
  assert.ok(
    stored.getTime() >= before.getTime() - 5_000,
    `stored ${stored.toISOString()} must be now(), not the caller's ${BACKDATE}`,
  );
  assert.ok(
    stored.getTime() - new Date(BACKDATE).getTime() > 1000 * 60 * 60 * 24 * 365,
    'the backdate must not have survived',
  );
});

test('re-pressing "on air" does NOT restart the clock that bounds the paid window', async () => {
  const first = await readAir(eventId);
  assert.ok(first, 'precondition: already on air');

  // A second press, this time trying to move the instant forward.
  await db.query(`UPDATE public.events SET ${COLUMN} = now() + interval '3 hours' WHERE event_id = $1`, [
    eventId,
  ]);
  const second = await readAir(eventId);

  assert.ok(second);
  assert.equal(
    second.getTime(),
    first.getTime(),
    'an already-live event must keep its ORIGINAL start instant',
  );
});

test('turning OFF is always allowed — a state you cannot leave is a gate with no handle', async () => {
  await db.query(`UPDATE public.events SET ${COLUMN} = NULL WHERE event_id = $1`, [eventId]);
  assert.equal(await readAir(eventId), null);
});

test('going on air again after going off stamps a fresh now()', async () => {
  const before = new Date();
  await db.query(`UPDATE public.events SET ${COLUMN} = $1 WHERE event_id = $2`, [
    BACKDATE,
    eventId,
  ]);
  const stored = await readAir(eventId);
  assert.ok(stored);
  assert.ok(
    stored.getTime() >= before.getTime() - 5_000,
    'a new run gets a new instant, still not the caller’s',
  );
  // leave the fixture off air for the neutralisation test below
  await db.query(`UPDATE public.events SET ${COLUMN} = NULL WHERE event_id = $1`, [eventId]);
});

test('an event cannot be INSERTED already on air at a chosen instant', async () => {
  const before = new Date();
  const ev = await db.query<{ event_id: string; v: Date | null }>(
    `INSERT INTO public.events (display_name, event_type, ${COLUMN})
     VALUES ('Born On Air', 'birthday', $1) RETURNING event_id, ${COLUMN} AS v`,
    [BACKDATE],
  );
  const stored = ev.rows[0]!.v;
  assert.ok(stored, 'the row is accepted');
  assert.ok(
    stored.getTime() >= before.getTime() - 5_000,
    'an inserted event cannot arrive pre-dated',
  );
});

test('unrelated writes to events never touch a live start instant', async () => {
  const id = await freshEvent();
  await db.query(`UPDATE public.events SET ${COLUMN} = now() WHERE event_id = $1`, [id]);
  const start = await readAir(id);
  assert.ok(start);

  // A write that does not name the column must not fire the trigger at all.
  await db.query(`UPDATE public.events SET display_name = 'Renamed' WHERE event_id = $1`, [id]);
  const after = await readAir(id);
  assert.ok(after);
  assert.equal(after.getTime(), start.getTime(), 'the start instant must be untouched');
});

/* ────────────────────────────────────────────────────────────────────────────
   NEUTRALISATION — prove the guard is what stops the backdate.
   Runs last: it drops the trigger, so nothing after it would be meaningful.
   ──────────────────────────────────────────────────────────────────────────── */

test('NEUTRALISED: without the trigger, the backdate lands — so the guard is real', async () => {
  const id = await freshEvent();

  // Baseline WITH the guard: refused (rewritten to now()).
  await db.query(`UPDATE public.events SET ${COLUMN} = $1 WHERE event_id = $2`, [BACKDATE, id]);
  const guarded = await readAir(id);
  assert.ok(guarded);
  assert.notEqual(
    guarded.getTime(),
    new Date(BACKDATE).getTime(),
    'precondition: the guard is holding',
  );

  await db.exec(`DROP TRIGGER ${TRIGGER} ON public.events`);

  const id2 = await freshEvent();
  await db.query(`UPDATE public.events SET ${COLUMN} = $1 WHERE event_id = $2`, [BACKDATE, id2]);
  const unguarded = await readAir(id2);

  assert.ok(unguarded);
  assert.equal(
    unguarded.getTime(),
    new Date(BACKDATE).getTime(),
    'with the trigger gone the caller CHOOSES the instant — this is what the guard prevents',
  );
});
