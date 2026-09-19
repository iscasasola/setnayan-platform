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
 * ⚠ 2026-09-18 (S37): the half of this file that ran `buildHomeBoardTiles`
 * went with `home-board.tsx`, which nothing had mounted since the account home
 * became "Your events" (2026-08-19, changelog.d/the-home-is-your-events.md).
 * A guard over an unmounted component protects nobody. What remains pins the
 * launcher's OWN derivation of the admin total, which the page still computes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LAUNCHER = path.join(import.meta.dirname, '..', 'page.tsx');

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
