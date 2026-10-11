/**
 * a-seat-plan-is-never-arranged-from-an-unread-list.test.ts — 🛑 AN ARRANGING ACTION STOPS WHEN A READ IT SEATS FROM
 * DID NOT HAPPEN, AND THE SEAT PLAN'S PRESSES ANSWER INSTEAD OF THROWING.
 *
 * Two faults, one screen (owner 2026-10-11: "make sure requests does not cause a crash"):
 *
 *   A · Auto arrange · Build my seating · Lock & fill · Auto-seat · "seat this role here" read the guest list, the
 *       groups, the keep-apart rules and the floor plan, then WRITE seats. Each read degraded to an empty stand-in
 *       on failure, so a refused memberships read arranged the room as if the couple had made no groups — and said
 *       it had worked. A write on a value nobody read.
 *   B · Every press in the plan awaited `runGated` inside a transition, and `runGated` rethrew anything that was
 *       not a lost lock: a request that never answered replaced the plan with the error screen.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. The four stop-readers (`lib/seating-inputs.ts`), run against a stubbed client: refused or unanswered → they
 *      THROW `SeatingInputsUnreadError` naming what was unread; answered → the value; answered EMPTY is a value
 *      (a couple with no groups may be arranged).
 *   2. In `seating/actions.ts` each arranging action reads through them, the stop comes BEFORE the action's first
 *      write, and the file calls none of the degrading readers any more.
 *   3. The background re-seat (`lib/seating-reconcile.ts`) reads through them inside its own catch.
 *   4. `runGated` cannot reject (read with the parser: its whole body is one try/catch that does not rethrow), it
 *      says the failure in the plan's notice strip, and the presses that drew a change in plain state put it back
 *      when the gate answers "not saved".
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · What the person reads for an unread input is the plan's general "Couldn’t save that — please try again." — a
 *     thrown action's own words do not reach a production browser, so the reason is logged, not shown.
 *   · `linkTables` still reads the floor plan through the degrading form (it measures a room, it does not seat).
 *   · A linked group's rotation that did not save stays as drawn (it is said; the next turn sends whole positions).
 *   · The 3D lab (`seating/lab`) has its own presses and is not held here.
 *   · Claims 2–4 read SOURCE; 1 runs code. Nothing here drives a real seat plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SeatingInputsUnreadError, floorPlanOrStop, guestsOrStop, keepApartOrStop, membershipsOrStop } from '@/lib/seating-inputs';
import { stripComments } from '@/lib/strip-comments';
import { namedFunctions, neverRejects, parseSource } from '@/lib/transition-await-scan';

type Result = { data: unknown; error: unknown };
const REFUSED: Result = { data: null, error: { code: '42501', message: 'permission denied' } };
const NO_ANSWER: Result = { data: null, error: { code: '', message: 'TypeError: fetch failed' } };
function stubClient(result: Result): SupabaseClient {
  return {
    from() {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit']) b[m] = () => b;
      b.maybeSingle = () => Promise.resolve(result);
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return b;
    },
  } as unknown as SupabaseClient;
}
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

const READERS = [
  ['guests', guestsOrStop],
  ['groups', membershipsOrStop],
  ['keep-apart rules', keepApartOrStop],
  ['floor plan', floorPlanOrStop],
] as const;

test('1 · a read that did not happen STOPS the arranging — it never comes back as "none"', async () => {
  for (const [what, read] of READERS) {
    for (const failure of [REFUSED, NO_ANSWER]) {
      await quiet(() =>
        assert.rejects(
          read(stubClient(failure), 'e1') as Promise<unknown>,
          (e: unknown) => e instanceof SeatingInputsUnreadError && e.unread === what && e.code === 'seating_inputs_unread',
          `${what}: a refused read was handed on as a value`,
        ),
      );
    }
  }
});

test('1 · a read that happened is the value — and an EMPTY answer is an answer', async () => {
  const none = stubClient({ data: [], error: null });
  assert.deepEqual(await guestsOrStop(none, 'e1'), []);
  assert.equal((await membershipsOrStop(none, 'e1')).size, 0, 'a couple with no groups could not be arranged');
  assert.deepEqual(await keepApartOrStop(none, 'e1'), []);
  const noPlan = await floorPlanOrStop(stubClient({ data: null, error: null }), 'e1');
  assert.equal(typeof noPlan.stage_x, 'number', 'an event with no floor plan yet could not be arranged');
  const groups = await membershipsOrStop(stubClient({ data: [{ guest_id: 'g1', group_id: 'gr1' }], error: null }), 'e1');
  assert.deepEqual([...groups.entries()], [['g1', ['gr1']]]);
  assert.deepEqual(await keepApartOrStop(stubClient({ data: [{ guest_a_id: 'a', guest_b_id: 'b' }], error: null }), 'e1'), [{ guest_a_id: 'a', guest_b_id: 'b' }]);
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, needle: string) => s.split(needle).length - 1;
const ACTIONS = read('app/dashboard/[eventId]/seating/actions.ts');
/** One exported action's source, to the next export. */
function action(name: string): string {
  const at = ACTIONS.indexOf(`export async function ${name}(`);
  assert.ok(at > -1, `${name} is no longer an action in seating/actions.ts`);
  const next = ACTIONS.indexOf('\nexport ', at + 1);
  return ACTIONS.slice(at, next === -1 ? undefined : next);
}
const WRITE = /\.(insert|update|upsert|delete)\(/;

test('2 · every arranging action reads through the stop-readers, before its first write', () => {
  /** [action, the stop-readers it must use] — each seats people from every one of them. */
  const arranging: Array<[string, string[]]> = [
    ['autoSeatGuests', ['guestsOrStop', 'floorPlanOrStop', 'membershipsOrStop']],
    ['lockAndFill', ['guestsOrStop', 'floorPlanOrStop', 'membershipsOrStop', 'keepApartOrStop']],
    ['autoArrange', ['guestsOrStop', 'floorPlanOrStop', 'membershipsOrStop', 'keepApartOrStop']],
    ['buildSeatingDraft', ['guestsOrStop', 'floorPlanOrStop', 'membershipsOrStop']],
    ['seatRoleAtTable', ['guestsOrStop']],
  ];
  for (const [name, readers] of arranging) {
    const body = action(name);
    const firstWrite = body.search(WRITE);
    assert.ok(firstWrite > -1, `${name}: no write found — re-anchor (it is listed because it seats people)`);
    for (const r of readers) {
      const at = body.indexOf(`${r}(supabase, eventId)`);
      assert.ok(at > -1, `${name} does not read through ${r} — a refused read is arranged from as "none"`);
      assert.ok(at < firstWrite, `${name}: ${r} comes after a write — seats are changed before the stop`);
    }
  }
  // The degrading readers are gone from the file: a NEW action cannot arrange from one without importing it again.
  for (const bare of ['fetchGuestsByEvent(', 'fetchGroupMembershipsByEvent(', 'fetchSeatingConstraints(']) {
    assert.equal(count(ACTIONS, bare), 0, `seating/actions.ts calls ${bare}…) — a refused read becomes "none" in an action that writes`);
  }
  assert.doesNotMatch(ACTIONS, /import \{[^}]*\b(fetchGuestsByEvent|fetchGroupMembershipsByEvent|fetchSeatingConstraints)\b[^}]*\} from/);
});

test('3 · the background re-seat reads through them too, inside its own catch', () => {
  const src = read('lib/seating-reconcile.ts');
  const tryAt = src.indexOf('try {');
  const catchAt = src.lastIndexOf('} catch');
  for (const r of ['guestsOrStop', 'floorPlanOrStop', 'membershipsOrStop', 'keepApartOrStop']) {
    const at = src.indexOf(`${r}(supabase, eventId)`);
    assert.ok(at > tryAt && at < catchAt, `the reconcile does not read through ${r} inside its try`);
  }
  assert.ok(src.search(WRITE) > src.indexOf('keepApartOrStop(supabase, eventId)'), 'the reconcile writes before it has read');
  for (const bare of ['fetchGuestsByEvent(', 'fetchGroupMembershipsByEvent(', 'fetchSeatingConstraints(', 'fetchFloorPlan(']) assert.equal(count(src, bare), 0, bare);
});

test('4 · the plan’s gate cannot reject, says the failure, and plain-state presses are put back', () => {
  const file = 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx';
  const raw = readFileSync(join(WEB, file), 'utf8');
  const gate = namedFunctions(parseSource(file, raw)).get('runGated');
  assert.ok(gate, 'runGated is gone — the seat plan’s presses have no gate');
  assert.ok(neverRejects(gate), 'runGated can reject again — every press in the plan throws into its transition');
  const src = stripComments(raw);
  const body = src.slice(src.indexOf('const runGated = '), src.indexOf('const place = '));
  assert.match(body, /catch \(err\) \{\s*if \(!handleLockLost\(err\)\) setNotice\(failed\);\s*return null;\s*\}/, 'a failed press is not said in the notice strip');
  assert.match(src, /const SEAT_PLAN_NOT_SAVED = 'Couldn’t save that — please try again\.';/);
  // No caller is left that relies on the old rethrow.
  assert.doesNotMatch(src, /catch \(err\) \{\s*if \((handleLockLost|onLockLost)\(err\)\)[^}]*\}?\s*throw err;/, 'a catch still rethrows what is not a lost lock');
  // Drawn in plain state before the save → put back when the gate answers null.
  for (const put of [
    /savePriorityOrder\(fd\)\)\) === null\) setPriorityOrder\(before\);/,
    /savePriorityOrder\(fd\)\)\) === null\) setRoleSeating\(roleSeating\);/,
    /addSeatingConstraint\(fd\)\)\) === null\) \{\s*setKeepApart\(/,
    /removeSeatingConstraint\(fd\)\)\) === null\) \{\s*setKeepApart\(/,
    /saveVenuePhotoVisibility\(fd\), 'Couldn’t save the photo setting — please try again\.'\);\s*if \(res === null\) setPhotoVis\(prev\);/,
  ]) {
    assert.match(src, put, `a press that did not save is left looking saved: ${put}`);
  }
  assert.equal(count(src, 'updateTableRotation(fd))) === null) {'), 2, 'a single table’s turn that did not save stays turned');
});
