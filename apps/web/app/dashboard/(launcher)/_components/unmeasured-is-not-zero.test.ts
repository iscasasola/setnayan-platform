/**
 * unmeasured-is-not-zero.test.ts — a queue we could not read must never be
 * reported as a queue with nothing in it.
 *
 * 🔑 WHY THIS EXISTS. `count === null` means NOT MEASURED. Filing an unmeasured
 * queue under "nothing needs you" puts it in the one place a person has been
 * told they need not look — and it looks completely fine. This repo has already
 * paid for that once on `/admin/work` (2026-08-05); My Home's Admin HQ tile was
 * carrying the identical defect in three separate places at once, which is why
 * a guard is worth more than a fix:
 *
 *   1. the page seeded `let adminOpenTotal = 0` and set `= 0` again in its
 *      `catch`, so a THROWN digest read became a confident zero;
 *   2. the accumulation did `?? 0` per queue, so ONE degraded lane inside an
 *      otherwise-successful digest silently vanished from the sum;
 *   3. the tile printed nothing at all for the unknown state, which on a board
 *      of numerals reads as calm.
 *
 * All three had to agree before the number was honest, and each was a plausible
 * "small tidy-up" away from breaking again.
 *
 * ⚠ THIS ASSERTS THE ACT, NOT A LITERAL. It runs the real derivation
 * (`buildHomeBoardTiles`) and the real digest semantics rather than grepping
 * for `?? 0` — a guard that matches a string is satisfied by a rename.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildHomeBoardTiles } from './home-board';

const LAUNCHER = path.join(import.meta.dirname, '..', 'page.tsx');

/**
 * The board input, with everything but the admin total held at a calm value.
 *
 * ⚠ TYPED, NOT CAST. A first cut ended `as Parameters<…>[0]` over a partial
 * object and typecheck refused it — correctly. Casting would have let the
 * fixture drift out of the real input shape while this guard kept passing, so
 * the field list is stated in full and a future field is a compile error here.
 */
function input(
  adminOpenTotal: number | null,
): Parameters<typeof buildHomeBoardTiles>[0] {
  return {
    activeCount: 1,
    needsTotal: 0,
    nextEventLabel: null,
    topWatchName: null,
    hasVendorAccess: false,
    shopNeedsTotal: 0,
    shopCount: 0,
    topShopName: null,
    hasAdminAccess: true,
    adminOpenTotal,
    finishedCount: 0,
  };
}

const hq = (adminOpenTotal: number | null) => {
  const tile = buildHomeBoardTiles(input(adminOpenTotal)).find(
    (t) => t.key === 'hq',
  );
  assert.ok(tile, 'the Admin HQ tile must exist for an admin');
  return tile;
};

test('an unread queue count reaches the tile as null, not as 0', () => {
  assert.equal(
    hq(null).value,
    null,
    'null must survive to the tile — the moment it becomes 0 the board lies',
  );
});

test('an unread queue count sorts WITH the tiles that want attention', () => {
  assert.equal(
    hq(null).needs,
    true,
    '"we could not check" is a reason to look, not a reason to relax',
  );
});

test('a genuinely empty queue is NOT treated as unread', () => {
  const clear = hq(0);
  assert.equal(clear.value, 0, 'a measured zero is a real number, keep it');
  assert.equal(
    clear.needs,
    false,
    'a clear desk must stay quiet, or the unknown state means nothing',
  );
});

test('a real backlog still surfaces', () => {
  const busy = hq(7);
  assert.equal(busy.value, 7);
  assert.equal(busy.needs, true);
});

test('the tile RENDERS the unknown state instead of leaving a blank', () => {
  /*
    A tile with no numeral reads as calm — the same harm one notch quieter. The
    component must say something for `value === null`, so assert the branch
    exists AND that it emits words, not an empty fragment.
  */
  const src = readFileSync(
    path.join(import.meta.dirname, 'home-board.tsx'),
    'utf8',
  );
  const branch = src.slice(src.indexOf('t.value === null'));
  assert.ok(
    src.includes('t.value === null'),
    'home-board must branch on a null value',
  );
  assert.match(
    branch.slice(0, 600),
    /couldn.{1,8}t load/i,
    'the null branch must print a human sentence, not render nothing',
  );
});

test('the launcher never re-seeds the admin total to 0 on a failed read', () => {
  /*
    The one thing that CANNOT be exercised through the pure function: the page's
    own error path. `catch { adminOpenTotal = 0 }` is the original defect and is
    invisible to every unit test, so it is asserted at the source — narrowly, on
    the assignment itself, not on prose about it.
  */
  const src = readFileSync(LAUNCHER, 'utf8');
  /*
    ⚠ SCOPED TO THE CATCH BLOCK, NOT THE FILE. A first cut asserted
    `/\badminOpenTotal\s*=\s*0\b/` over the whole source and went red against
    CORRECT code — it was matching the accumulator's legitimate seed
    (`let adminOpenTotal: number | null = 0`). A guard that cries wolf teaches
    you to skim past the one time it is right, so it reads only the handler.
  */
  const at = src.indexOf('let adminOpenTotal');
  assert.ok(at > 0, 'the admin total must still be derived in the launcher');
  const region = src.slice(at);
  const catchAt = region.indexOf('} catch');
  assert.ok(catchAt > 0, 'the digest read must still be guarded by a catch');
  const handler = region.slice(catchAt, catchAt + 400);
  assert.doesNotMatch(
    handler,
    /\badminOpenTotal\s*=\s*0\b/,
    'a failed digest read must set null, never 0 — that is the whole defect',
  );
  assert.match(
    handler,
    /\badminOpenTotal\s*=\s*null\b/,
    'the failure path must explicitly record "not measured"',
  );
});

test('one degraded lane makes the WHOLE total unmeasured', () => {
  /*
    A sum missing an unknown addend is not a smaller sum — it is not a number.
    `?? 0` inside the accumulation is what folds a degraded lane into a
    confident total, so it must not be applied to a queue's `count`.
  */
  const src = readFileSync(LAUNCHER, 'utf8');
  const loop = src.slice(
    src.indexOf('for (const [key, meta] of Object.entries(ADMIN_QUEUE_META))'),
  );
  const body = loop.slice(0, loop.indexOf('} catch'));
  assert.ok(body.length > 0, 'the accumulation loop must still be there');
  assert.doesNotMatch(
    body,
    /count\s*\?\?\s*0/,
    'a per-queue null must not be coerced to 0 inside the sum',
  );
  assert.match(
    body,
    /count === null/,
    'the loop must test for the unmeasured case explicitly',
  );
  /*
    🪤 AND THE BRANCH MUST ASSIGN null, NOT 0 — found by mutation, not by
    reading. Rewriting the loop's `adminOpenTotal = null` to `= 0` is a real
    defect (a degraded lane silently zeroes the whole total and breaks out of
    the sum), and the two assertions above BOTH stayed green through it: the
    `count === null` test was still satisfied, and the `?? 0` test never looked
    at the right-hand side. Detecting the branch is not the same as detecting
    what the branch does.
  */
  const unmeasured = body.slice(body.indexOf('count === null'));
  assert.match(
    unmeasured.slice(0, 200),
    /adminOpenTotal\s*=\s*null/,
    'the unmeasured branch must set the total to null, not to 0',
  );
});
