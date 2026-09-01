/**
 * A PAUSE QUIETS THE PROMPTS — executed against real Postgres.
 *
 * Owner, 2026-09-01: *"instead of just stop. let us also allow pause for the
 * challenge. so challenges can all be not available on moments everybody must
 * be watching."*
 *
 * ── WHAT ONLY A REPLAYED DATABASE CAN PROVE ────────────────────────────────
 * 🔴 THE GUEST'S BOARD IS UNCHANGED ACROSS A PAUSE. That is the ruling ("the
 * board stays, with a notice over it"), and it is the assertion that stops the
 * CHEAPEST implementation of a pause — teaching `papic_guest_missions` to
 * return nothing — which would pass any test that only checked the challenges
 * went quiet, and would ship "not available" as an absence indistinguishable
 * from a celebration that set no challenges up.
 *
 * 🔴 AND NO CAPTURE PATH READS IT. Asked of the shipped function BODIES, not of
 * the repository's source: a capture path that started consulting the pause
 * would be invisible to a grep over `apps/`.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DAY = 86_400_000;

async function seedEventWithBoard(tag: string): Promise<{ eventId: string; guestId: string }> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, papic_window_end)
     VALUES ($1, 'birthday', $2::date, $3::timestamptz) RETURNING event_id`,
    [
      `Pause ${tag}`,
      new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      new Date(Date.now() + 31 * DAY).toISOString(),
    ],
  );
  const eventId = ev.rows[0]!.event_id;
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Pause','Guest','both','friends') RETURNING guest_id`,
    [eventId],
  );
  // A real board, built the way a guest's first open builds it.
  await db.query(`SELECT public.ensure_papic_board($1::uuid)`, [eventId]);
  return { eventId, guestId: g.rows[0]!.guest_id };
}

/** The guest's board, as their phone reads it. */
async function guestBoard(guestId: string): Promise<string> {
  const r = await db.query(
    `SELECT * FROM public.papic_guest_missions($1::uuid)`,
    [guestId],
  );
  return JSON.stringify(r.rows);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('the column exists, and a celebration starts NOT paused', async () => {
  const { eventId } = await seedEventWithBoard('default');
  const r = await db.query<{ paused: string | null }>(
    `SELECT papic_challenges_paused_at AS paused FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.paused, null, 'a new celebration must not be born quiet');
});

test('🔴 the guest’s board is BYTE-IDENTICAL across a pause', async () => {
  // The ruling, and the assertion that keeps the cheap implementation out.
  const { eventId, guestId } = await seedEventWithBoard('board-unchanged');

  const before = await guestBoard(guestId);
  assert.ok(before.length > 2, 'the fixture must have a real board, or this test proves nothing');

  await db.query(
    `UPDATE public.events SET papic_challenges_paused_at = NOW() WHERE event_id = $1`,
    [eventId],
  );
  const during = await guestBoard(guestId);
  assert.equal(
    during,
    before,
    'pausing changed what the guest is given — the board must STAY, with a notice over it; an empty board is indistinguishable from a celebration with no challenges',
  );

  await db.query(
    `UPDATE public.events SET papic_challenges_paused_at = NULL WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(await guestBoard(guestId), before, 'resuming must give the board back untouched');
});

test('a pause takes nothing off the board — is_active is not what changed', async () => {
  // Hiding and pausing are different acts. If a pause were implemented as
  // `is_active = false` across the board, THIS is what would show it.
  const { eventId } = await seedEventWithBoard('not-hiding');
  const live = async () =>
    Number(
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM public.papic_missions
            WHERE event_id = $1 AND is_active AND approved`,
          [eventId],
        )
      ).rows[0]!.n,
    );
  const before = await live();
  assert.ok(before > 0, 'the fixture must have live challenges');
  await db.query(
    `UPDATE public.events SET papic_challenges_paused_at = NOW() WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(await live(), before, 'a pause retired challenges — that is hiding, and it is permanent');
});

test('🔴 no capture or board function consults the pause', async () => {
  // A guest is never refused a photo because the challenges are quiet — and the
  // board reader must not learn about it either, or the notice becomes an
  // absence again one migration later.
  const r = await db.query<{ proname: string }>(
    `SELECT p.proname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('papic_record_guest_capture','papic_record_seat_capture',
                          'papic_complete_mission','papic_guest_missions','ensure_papic_board')
        AND pg_get_functiondef(p.oid) ILIKE '%papic_challenges_paused_at%'`,
  );
  assert.deepEqual(
    r.rows,
    [],
    `these now read the pause: ${JSON.stringify(r.rows)} — it closes prompts, never the shutter, and never the board`,
  );
});

test('the pause is not a clock — nothing in the schema derives an end from it', async () => {
  // Manual only (owner). A companion "pause_until" or a duration would be a
  // second, invented rule about when a room may play again.
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
        AND column_name ILIKE '%paus%' `,
  );
  assert.deepEqual(
    r.rows.map((x) => x.column_name),
    ['papic_challenges_paused_at'],
    'a second pause column appeared — a pause ends when somebody resumes it, and never on its own',
  );
});

test('a host still reads the column through events_host — the view was rebuilt', async () => {
  // 🚨 THE HALF THAT SHIPS BROKEN IF YOU FORGET IT. `events_host` has an
  // EXPLICIT column projection, so a column added without rebuilding the view is
  // a phantom there — and /dashboard/[eventId]/details THROWS on a query error.
  // `site_art_direction` was refused to every signed-in person for over a month
  // exactly this way. `lint-events-column-grants.mjs` is what told me; this is
  // the measurement.
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events_host'
        AND column_name = 'papic_challenges_paused_at'`,
  );
  assert.equal(r.rows.length, 1, 'papic_challenges_paused_at is a phantom column on events_host');
});
