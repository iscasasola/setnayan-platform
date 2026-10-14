/**
 * PAPIC SEATS TAKE THE SIX-MONTH DEFAULT — migration 20271269077780.
 *
 * 📸 Owner 2026-10-13: Papic is on automatically from 6 months before the day.
 * The brief marked UNCONFIRMED whether cameras made before any window was saved
 * carry that default. They did not: a seat is stamped once, when it is made,
 * from the default of THAT day — and the default used to be the event day
 * alone. This replays the migration's UPDATE over fixtures in every shape and
 * asserts it moves exactly the seats it should, and nothing else, twice.
 *
 * The expected start is computed by the app's OWN `earliestCaptureDate`, so the
 * SQL and the TypeScript default can never drift apart unnoticed.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { earliestCaptureDate } from '../../lib/papic-window';

const MIGRATION_FILE = '20271269077780_papic_seats_take_the_six_month_default.sql';
const MIGRATION_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'supabase', 'migrations', MIGRATION_FILE),
  'utf8',
);

let replay: ReplayResult;
let db: PGlite;

/** A month-end date, so the clamp is exercised: 31 Mar − 6 months = 30 Sep. */
const DAY = '2027-03-31';
const F = { noWindow: '', saved: '', noDate: '' };
const SEAT: Record<string, string> = {};

/** A birthday — a wedding row must carry its wedding fields (a CHECK); the window rule is the same for every type. */
async function event(name: string, date: string | null, windowStart: string | null): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, papic_window_start, papic_window_end)
       VALUES ($1, 'birthday', $2::date, $3::timestamptz, $4::timestamptz) RETURNING event_id AS e`,
      [name, date, windowStart, windowStart ? `${date}T11:59:59+08:00` : null],
    )
  ).rows[0]!.e;
}
async function seat(key: string, eventId: string, index: number, validFrom: string | null, revoked = false): Promise<void> {
  SEAT[key] = (
    await db.query<{ s: string }>(
      `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, valid_from, revoked_at)
       VALUES ($1, $2, 'PAPIC_CAMERA_FREE', $3, $4::date, ${revoked ? 'now()' : 'NULL'}) RETURNING seat_id AS s`,
      [eventId, index, `tok-six-month-${key}`, validFrom],
    )
  ).rows[0]!.s;
}
async function startOf(key: string): Promise<string | null> {
  const r = await db.query<{ v: string | null }>(`SELECT valid_from::text AS v FROM public.paparazzi_seats WHERE seat_id = $1`, [SEAT[key]]);
  return r.rows[0]!.v;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.noWindow = await event('No window saved', DAY, null);
  F.saved = await event('A window the couple saved', DAY, '2027-03-01T00:00:00+08:00');
  F.noDate = await event('No date yet', null, null);
  await seat('oldDefault', F.noWindow, 100, DAY); // made when the default was the day alone
  await seat('midway', F.noWindow, 101, '2027-01-15'); // later than the default — still too narrow
  await seat('already', F.noWindow, 102, earliestCaptureDate(DAY)); // already the default
  await seat('earlier', F.noWindow, 103, '2026-08-01'); // earlier than the default (never narrowed)
  await seat('open', F.noWindow, 104, null); // NULL fails open — left alone
  await seat('revoked', F.noWindow, 105, DAY, true); // a revoked camera is history
  await seat('couplesChoice', F.saved, 100, '2027-03-01'); // the couple's saved window
  await seat('dateless', F.noDate, 100, '2027-01-01');
  await db.exec(MIGRATION_SQL);
});

after(async () => {
  await db?.close();
});

test('the migration applied in the replay', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('the SQL default IS the app default (31 Mar → 30 Sep, clamped)', () => {
  assert.equal(earliestCaptureDate(DAY), '2026-09-30');
});

test('a camera made under the old one-day default now opens 6 months before', async () => {
  assert.equal(await startOf('oldDefault'), earliestCaptureDate(DAY));
  assert.equal(await startOf('midway'), earliestCaptureDate(DAY));
});

test('nothing else moves', async () => {
  assert.equal(await startOf('already'), earliestCaptureDate(DAY), 'already the default');
  assert.equal(await startOf('earlier'), '2026-08-01', 'a wider window is never narrowed');
  assert.equal(await startOf('open'), null, 'NULL fails open — it is not given a start');
  assert.equal(await startOf('revoked'), DAY, 'a revoked camera is not touched');
  assert.equal(await startOf('couplesChoice'), '2027-03-01', 'a window the couple saved is theirs');
  assert.equal(await startOf('dateless'), '2027-01-01', 'an event with no date has no default');
});

test('idempotent — a second run changes nothing', async () => {
  const before = await db.query(`SELECT seat_id, valid_from FROM public.paparazzi_seats ORDER BY seat_id`);
  await db.exec(MIGRATION_SQL);
  const after = await db.query(`SELECT seat_id, valid_from FROM public.paparazzi_seats ORDER BY seat_id`);
  assert.deepEqual(after.rows, before.rows);
});
