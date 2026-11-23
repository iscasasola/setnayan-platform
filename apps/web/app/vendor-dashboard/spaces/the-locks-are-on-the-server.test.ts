/**
 * 🔒 SHOP › SPACES — every lock the screen draws is ALSO refused by the server (a lock that is only drawn is not a lock;
 * `lib/locks.ts`: "The lock is the LOOK; the server is the RULE"). Owner 19 Nov: renaming and own names, and the floor plan, are on every paid plan (from Plus;
 * 22 Nov "SAME FEATURES IN EVERY SIZE"); "A booked space can be closed, never removed".
 *
 * Read off the one action file (`actions.ts`, comments stripped), because the action needs a signed-in shop and a
 * database to run. Each claim names the branch that holds it; break one and this fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LOCKS } from '@/lib/locks';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'actions.ts'), 'utf8'));
const body = (fn: string) => {
  const at = SRC.indexOf(`async function ${fn}(`);
  assert.ok(at >= 0, `${fn} is gone from actions.ts`);
  const next = SRC.indexOf('\nasync function ', at + 10);
  return SRC.slice(at, next < 0 ? undefined : next);
};

test('own names and numbering by floor are refused below Pro, on the server', () => {
  assert.match(body('addSpaces'), /run\.naming !== 'generic' && !\(await proOpen\(s\)\)\) return \{ ok: false/);
});

test('renaming is refused below Pro, on the server', () => {
  assert.match(body('updateSpace'), /if \(!\(await proOpen\(s\)\)\) return \{ ok: false, error: 'Renaming comes with every paid plan\.' \}/);
});

test('moving a table on the drawn floor plan is refused below Pro, on the server', () => {
  assert.match(body('placeTable'), /if \(!\(await proOpen\(s\)\)\) return \{ ok: false/);
});

test('a booked space is never removed, nor one a card uses — and an unread check refuses rather than removes', () => {
  const b = body('removeSpace');
  assert.match(b, /\.gte\('booked_date', today\)/, 'the bookings check is not for today and later');
  assert.match(b, /if \(held\.error \|\| uses\.error\) return \{ ok: false/, 'a refused check would remove the space');
  assert.match(b, /if \(\(held\.count \?\? 0\) > 0\) return \{ ok: false/);
  assert.match(b, /if \(\(uses\.count \?\? 0\) > 0\) return \{ ok: false/);
  assert.doesNotMatch(b, /\.delete\(\)/, 'a space is hard-deleted (bookings hold its id)');
});

test('a refused tier read keeps the lock shut (never a wrong "you have it")', () => {
  assert.match(body('proOpen'), /return !vendorPaywallApplies\(isTierAtLeast\(tier, SUPPLIER_FLOOR_PLAN_MIN_TIER\)\)/);
});

test('the two Spaces locks say problem and solution, open on every paid plan, and name this file as their server', () => {
  for (const k of ['space_floor_plan', 'space_names'] as const) {
    const d = LOCKS[k];
    assert.equal(d.opens, 'solo');
    assert.ok(d.problem.length > 0 && d.solution.length > 0);
    assert.equal(d.server, 'app/vendor-dashboard/spaces/actions.ts');
    assert.ok(existsSync(join(HERE, '../../..', d.server)), `${k} names a server file that does not exist`);
  }
});

test('the 18 Nov Rooms & seating page is gone (owner 19 Nov: reworked into Spaces, not kept beside it)', () => {
  assert.ok(!existsSync(join(HERE, '../rooms-seating/page.tsx')), '/vendor-dashboard/rooms-seating came back');
});

/* ── Ship review 21 Nov: a refused write never reads as saved, and no link is left one way ───────────────────── */

test('every update and delete asks which rows changed, and zero rows is said, never "saved"', () => {
  for (const fn of ['updateSpace', 'removeSpace', 'updateTable', 'deleteTable', 'lineUpTables', 'deleteDoor', 'placeTable']) {
    const b = body(fn);
    assert.match(b, /\.select\('(pool_id|unit_id|door_id)'\)/, `${fn} does not ask which rows it changed`);
    assert.match(b, /if \(changedNothing\((saved|gone|data)\)\) return NOT_YOURS;/, `${fn} reads a 0-row write as saved`);
  }
});

test('"Connects to" lets go of BOTH old links, and removing a space says when that fails', () => {
  const b = body('connectBothWays');
  assert.match(b, /\.eq\('connects_to_pool_id', id\)\.neq\('pool_id', to \?\? id\)/, 'the old link to this hall is kept');
  assert.match(b, /\.eq\('connects_to_pool_id', to\)\.neq\('pool_id', id\)/, 'whoever pointed at the new hall keeps a one-way link');
  assert.match(body('removeSpace'), /const e = await connectBothWays\(s, id, null\);\s*if \(e\) return \{ ok: false, error: e \};/, 'a refused unlink is swallowed');
});

test('a typed name is matched as typed: % and _ are not wildcards', () => {
  assert.match(body('updateSpace'), /\.ilike\('calendar_name', likeExactly\(name\)\)/);
  assert.match(SRC, /function likeExactly\(name: string\): string \{\s*return name\.replace\(\/\[\\\\%_\]\/g/);
});

test('a refused re-read refuses the move instead of skipping the plan check', () => {
  assert.match(body('placeTable'), /if \(!now\) return \{ ok: false, error: 'Couldn’t check the plan just now\. Nothing was moved\.' \};/);
});
