/**
 * THE ANSWER WINDOW IS 48 HOURS — and one number, in one place.
 *
 * ⚖ Owner ruling 2026-08-28, asked and answered in one word. It restores the
 * 2026-06-02 lock's own figure, which the shipped code had never matched: read
 * out of the live production object, `guard_event_vendor_lock_handshake` carried
 * `INTERVAL '7 days'` and `nudge_stale_lock_requests` defaulted to `p_days = 5`.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The window is TWO facts that must agree: a rule the DATABASE enforces (the
 * materialized deadline) and a sentence the PRODUCT prints ("you have 48 hours
 * to agree or decline"). Two copies of one number always drift, and the drift
 * here is silent in the worst direction — a supplier told one deadline and held
 * to another. So the interval is read out of the replayed function body and
 * compared against the TypeScript constant every screen reads.
 *
 * 🔑 AND THE REMINDER IS PART OF THE WINDOW, NOT A SEPARATE SETTING. The nudge
 * only ever fires while `lock_request_expires_at > NOW()`, so a threshold at or
 * past the deadline cannot match a row: the job sweeps nothing and reports
 * success. Shortening the window without shortening the reminder does not break
 * the reminder loudly — it deletes it. That relationship is asserted here.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function functionBody(name: string): Promise<string> {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1`,
    [name],
  );
  assert.equal(r.rows.length, 1, `${name} is not a single function in the replayed schema`);
  return r.rows[0]!.def;
}

/** The constant every screen reads, parsed out of the source it lives in. */
function windowHoursFromCode(): number {
  const src = readFileSync(join(WEB, 'lib', 'lock-request-state.ts'), 'utf8');
  const m = src.match(/export const LOCK_ANSWER_WINDOW_HOURS\s*=\s*(\d+)/);
  assert.ok(m, 'LOCK_ANSWER_WINDOW_HOURS is gone from lib/lock-request-state.ts');
  return Number(m![1]);
}

test('the database stamps the window the code says it stamps', async () => {
  const def = await functionBody('guard_event_vendor_lock_handshake');
  const m = def.match(/lock_request_expires_at\s*:=[\s\S]{0,120}?INTERVAL\s*'([^']+)'/);
  assert.ok(m, 'the guard trigger no longer materializes a deadline with an INTERVAL');
  const literal = m![1]!.trim();

  // Normalise whatever spelling the interval uses to hours, so `48 hours`,
  // `2 days` and `2880 minutes` all compare — the assertion is about the
  // DURATION, not about how somebody typed it.
  const hours = await db.query<{ h: number }>(
    `SELECT EXTRACT(EPOCH FROM $1::interval) / 3600 AS h`,
    [literal],
  );
  assert.equal(
    Number(hours.rows[0]!.h),
    windowHoursFromCode(),
    `the trigger stamps '${literal}' but every screen prints ${windowHoursFromCode()} hours — ` +
      'a supplier would be told one deadline and held to another',
  );
});

test('the window is 48 hours', async () => {
  assert.equal(windowHoursFromCode(), 48, 'owner ruling 2026-08-28');
});

test('THE REMINDER FITS INSIDE THE WINDOW — or it can never fire', async () => {
  const def = await functionBody('nudge_stale_lock_requests');

  // It is only allowed to nudge a request that is still live…
  assert.match(
    def.replace(/\s+/g, ' '),
    /lock_request_expires_at IS NULL OR ev\.lock_request_expires_at > NOW\(\)/,
    'the nudge stopped requiring a live request — it would now warn people about closed ones',
  );

  // …so its threshold must be strictly inside the window. At or past it, the
  // WHERE above can never be satisfied and the job sweeps nothing, forever,
  // while reporting success.
  const m = def.match(/p_days\s+integer\s+DEFAULT\s+(\d+)/i);
  assert.ok(m, 'nudge_stale_lock_requests no longer takes a p_days default');
  const nudgeHours = Number(m![1]) * 24;
  assert.ok(
    nudgeHours < windowHoursFromCode(),
    `the reminder fires at ${nudgeHours}h but the request closes at ${windowHoursFromCode()}h — ` +
      'it could never match a row, and would report success forever',
  );
});

test('the sweep asks for the same threshold the function defaults to', () => {
  // A default nobody uses is a decoration. The runner passes the number
  // explicitly, so both have to move together.
  const src = readFileSync(join(WEB, 'lib', 'lock-request-expiry.ts'), 'utf8');
  const m = src.match(/p_days:\s*(\d+)/);
  assert.ok(m, 'the sweep no longer passes p_days');
  assert.equal(Number(m![1]), 1, 'the runner and the function default disagree about the reminder');
});

test('the deadline is MATERIALIZED, so an older row keeps the window it was given', async () => {
  // 🔑 THE REASON SHORTENING THE WINDOW IS SAFE. The trigger stamps an absolute
  // timestamp at the moment of asking; nothing recomputes it from the constant.
  // A request made under the seven-day rule would keep seven days.
  const def = await functionBody('guard_event_vendor_lock_handshake');
  assert.match(
    def.replace(/\s+/g, ' '),
    /NEW\.lock_request_expires_at := COALESCE\(NEW\.lock_requested_at, NOW\(\)\) \+ INTERVAL/,
    'the deadline stopped being stamped from the request time',
  );
  // And it is stamped only on the TRANSITION into pending, so touching a live
  // request never silently extends the supplier's window.
  assert.match(
    def.replace(/\s+/g, ' '),
    /TG_OP = 'INSERT' OR OLD\.lock_request_state IS DISTINCT FROM 'pending'/,
    'the deadline is no longer keyed on the transition — a later touch would extend it',
  );
});

test('and the forgery guards the window shares a function with are all still there', async () => {
  // The migration REPLACES a function whose other job is refusing a couple's
  // attempt to write the supplier's answer. Retyping it is how one of those
  // disappears, so the body was copied — and this asserts the copy kept them.
  //
  // 🔴 IT USED TO CHECK THE WHOLE BODY FOR EACH COLUMN NAME AND WAS DECORATION.
  // Measured by mutation: deleting `lock_request_nudged_at` from the INSERT
  // branch left this test GREEN, because the same column still appears in the
  // UPDATE branch and on the reset line. *A file-level count cannot say which
  // BRANCH still asks.* Each branch is now extracted and checked on its own.
  const def = await functionBody('guard_event_vendor_lock_handshake');
  const flat = def.replace(/\s+/g, ' ');

  const insertBranch = flat.slice(
    flat.indexOf("IF TG_OP = 'INSERT' THEN"),
    flat.indexOf("ELSIF TG_OP = 'UPDATE' THEN"),
  );
  const updateBranch = flat.slice(
    flat.indexOf("ELSIF TG_OP = 'UPDATE' THEN"),
    flat.indexOf('lock_request_expires_at :='),
  );
  assert.ok(insertBranch.length > 200, 'the INSERT branch vanished from the guard');
  assert.ok(updateBranch.length > 200, 'the UPDATE branch vanished from the guard');

  // THE VENDOR'S ANSWER, five columns, refused on BOTH verbs. A permissive
  // `FOR ALL` couple policy plus a table-wide UPDATE grant is why both matter:
  // without the INSERT arm a couple could create a row BORN 'agreed'.
  for (const col of [
    'lock_agreed_at',
    'lock_declined_at',
    'lock_decline_reason',
    'lock_answered_by_user_id',
    'lock_request_nudged_at',
  ]) {
    assert.ok(insertBranch.includes(col), `the INSERT arm lost ${col} when the window moved`);
    assert.ok(updateBranch.includes(col), `the UPDATE arm lost ${col} when the window moved`);
  }

  for (const clause of [
    "a booking cannot be created already carrying the vendor''s lock answer",
    'is set only by the vendor lock-handshake RPCs',
    'this booking has a live lock request',
  ]) {
    assert.ok(flat.includes(clause), `the guard lost "${clause}" when the window moved`);
  }
});

test('CLOSED_WINDOW_GRACE_DAYS is a DIFFERENT seven and must not have moved', () => {
  // Two sevens, two meanings. This one is how long a LAPSED ask stays visible as
  // a closed line, so that a row which simply vanished does not read as one you
  // answered. Nothing about the 48-hour ruling touches it.
  const src = readFileSync(join(WEB, 'lib', 'answers-desk.ts'), 'utf8');
  const m = src.match(/export const CLOSED_WINDOW_GRACE_DAYS\s*=\s*(\d+)/);
  assert.ok(m, 'CLOSED_WINDOW_GRACE_DAYS is gone');
  assert.equal(Number(m![1]), 7, 'the grace period was changed as if it were the answer window');
});
