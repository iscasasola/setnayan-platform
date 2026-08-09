/**
 * ONLY THE COORDINATOR ADVANCES THE RUN OF SHOW (owner ruling · build item 54).
 *
 * The database function `advance_schedule_block` admits FOUR classes:
 *   host/couple ∪ delegate-with-schedule:'edit' ∪ ANY BOOKED VENDOR ∪ admin.
 * The third arm is every supplier contracted on the wedding — the caterer and
 * the florist can advance the night's programme. Until now the only thing
 * standing in the way was a screen (and on the vendor client workspace not even
 * that: `canAdvance` is passed unconditionally there). A server action is a
 * public HTTP endpoint; a hidden button is not a permission.
 *
 * `advanceScheduleBlock` now re-checks the same arms with the vendor one
 * narrowed to the BOOKED COORDINATOR, via the SECURITY DEFINER helper
 * `current_coordinator_booked_event_ids()` that the day-of requests inbox
 * already uses (migration 20271013100000 · `'coordinator' = ANY(vp.services)`).
 *
 * These assertions are deliberately SCOPED TO THE EXECUTED CODE — each one
 * slices the function body it is about, so the long docblock that explains the
 * bug can never satisfy the test that is supposed to catch the bug coming back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', 'app', '_actions', 'run-of-show.ts'), 'utf8');

/** Comments stripped — an assertion must never be satisfied by prose. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * The body of a top-level function in this module, comments removed: from its
 * `export? async function <name>` header to the next top-level declaration.
 */
function body(name: string): string {
  const header = new RegExp(`(?:export )?async function ${name}\\b`);
  const start = SRC.search(header);
  assert.notEqual(start, -1, `${name}() is gone from app/_actions/run-of-show.ts`);
  // Start AFTER the header line so the search for the next top-level
  // declaration cannot re-find this one.
  const openLine = SRC.indexOf('\n', start);
  const rest = SRC.slice(openLine);
  const nextTop = rest.search(/\n(?:export )?(?:async function|const|type|function) /);
  return strip(nextTop === -1 ? rest : rest.slice(0, nextTop));
}

const ADVANCE = body('advanceScheduleBlock');
const GATE = body('mayAdvanceRunOfShow');

// ── 1 · The action checks the role at all ───────────────────────────────────

test('advanceScheduleBlock consults the role gate', () => {
  assert.match(
    ADVANCE,
    /mayAdvanceRunOfShow\(/,
    'the advance action no longer checks who is calling — every booked supplier ' +
      'can advance the programme again (the DB gate still admits them)',
  );
});

test('the role gate runs BEFORE the advance RPC, and refuses', () => {
  const gateAt = ADVANCE.indexOf('mayAdvanceRunOfShow(');
  const rpcAt = ADVANCE.indexOf("rpc('advance_schedule_block'");
  assert.notEqual(rpcAt, -1, 'the advance RPC call is gone');
  assert.ok(
    gateAt !== -1 && gateAt < rpcAt,
    'the role check must run before the timeline is touched, not after',
  );
  // A check whose failure branch does nothing is decoration — it must return a
  // refusal the caller can show, not fall through into the RPC.
  const guarded = ADVANCE.slice(gateAt, rpcAt);
  assert.match(
    guarded,
    /return\s*\{[\s\S]*ADVANCE_REFUSED_NOT_COORDINATOR/,
    'a failed role check must return the refusal status, not carry on',
  );
});

// ── 2 · The gate is the NARROW one ──────────────────────────────────────────

test('the vendor arm is narrowed to the booked COORDINATOR', () => {
  assert.match(
    GATE,
    /rpc\('current_coordinator_booked_event_ids'\)/,
    "the coordinator-only helper is what makes this a narrowing; without it the " +
      'gate either locks the coordinator out or lets every supplier back in',
  );
});

test('the gate never falls back to the every-booked-supplier helper', () => {
  assert.doesNotMatch(
    GATE,
    /current_vendor_booked_event_ids/,
    'that helper is EVERY booked supplier — the exact arm this build removes',
  );
});

test('the people who legitimately run the day are still admitted', () => {
  // Host/couple (an event_members row — what current_event_ids() reads) and the
  // delegate coordinator the owner directive admitted in 20270917100000. Losing
  // either turns the couple's own advance button into a dead control.
  assert.match(GATE, /from\('event_members'\)/, 'the host/couple arm is gone');
  assert.match(GATE, /from\('event_moderators'\)/, 'the delegate coordinator arm is gone');
  assert.match(
    GATE,
    /resolveAreaLevel\([\s\S]*?'schedule',?\s*\)\s*===\s*'edit'/,
    "the delegate arm must require schedule:'edit', not merely a delegate row",
  );
});

// ── 3 · The helper it leans on really is coordinator-only ───────────────────

test('current_coordinator_booked_event_ids really does require the coordinator tile', () => {
  // If a later migration widens that helper, this gate silently becomes the old
  // every-supplier gate again while every assertion above still passes.
  const sql = readFileSync(
    join(HERE, '..', '..', '..', 'supabase', 'migrations', '20271013100000_day_of_requests_stream.sql'),
    'utf8',
  );
  const fn = sql.slice(sql.indexOf('FUNCTION public.current_coordinator_booked_event_ids()'));
  const def = fn.slice(0, fn.indexOf('$$;'));
  assert.match(def, /'coordinator' = ANY \(vp\.services\)/);
});
