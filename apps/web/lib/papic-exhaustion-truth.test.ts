/**
 * THE CAMERA SAYS WHAT IS TRUE — executable guard for the refusal copy.
 *
 * Two properties, and neither can be got from reading the file:
 *   1. NO SURFACE MAY PROMISE A REFILL. Nothing in the schema refills a seat
 *      (measured 2026-09-16 — see the module docblock), so any sentence that
 *      says otherwise is false by construction.
 *   2. THE TWO CAUSES MUST STAY DISTINGUISHABLE. Collapsing them to one
 *      sentence is the cheapest edit a future session would make, and it swaps
 *      a bigger lie for a smaller one rather than fixing anything.
 *
 * It also pins the SOURCE of `app/api/upload/route.ts`: that file is
 * `server-only`, so a test cannot import it, and the false sentence lived there.
 * Comments are stripped first — this file's own prose quotes the dead sentence,
 * and so does the route's, so a raw-source match would report the defect as
 * still present forever.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAPIC_POOL_NOT_BINDING,
  arrivalTally,
  exhaustionCauseFromOwnCamera,
  exhaustionDetail,
  exhaustionHeadline,
  resolveExhaustionCause,
} from './papic-exhaustion-truth';
// 🔑 THE SHARED, STRING-AWARE STRIPPER — never a two-replace regex. `/*` inside
// a string (accept="image/*") opens a comment that runs to the next real close
// marker and blanks every line between, so a guard asserts against a blank and
// passes. lib/strip-comments.ts is a small lexer for exactly that reason.
import { stripComments } from './strip-comments';

/** Strip block + line comments so prose that QUOTES a banned string can't pass
 *  or fail a check about the code. */
const ROUTE = join(process.cwd(), 'app', 'api', 'upload', 'route.ts');
const SEAT = join(
  process.cwd(),
  'app',
  'papic',
  'seat',
  '[token]',
  '_components',
  'papic-seat-capture.tsx',
);

// ── 1 · the discriminator ──────────────────────────────────────────────────

test('the pool sentinel means this camera has a balance of its own', () => {
  assert.equal(resolveExhaustionCause(PAPIC_POOL_NOT_BINDING), 'own_camera');
});

test('any bounded pool reading is the shared pot, not her own credits', () => {
  for (const v of [0, 1, 49, 30_000, PAPIC_POOL_NOT_BINDING - 1]) {
    assert.equal(
      resolveExhaustionCause(v),
      'event_pool',
      `${v} is a real pool balance — it must never be read as a camera of her own`,
    );
  }
});

test('an unreadable probe falls to the pot, never to "you can buy more"', () => {
  // Telling a guest she has a camera to top up when she may not is the error
  // with a cost; the other direction just sends her to the host.
  assert.equal(resolveExhaustionCause(null), 'event_pool');
  assert.equal(resolveExhaustionCause(undefined), 'event_pool');
});

test('the record seam answers from the latched camera, not from a default', () => {
  // A long clip passes the presign (gated at the cheapest band) and is refused
  // at the record — so this path is ordinary, not a race, and defaulting a
  // guest with her own camera to "the celebration ran out" would be wrong on a
  // routine capture.
  assert.equal(exhaustionCauseFromOwnCamera(true), 'own_camera');
  assert.equal(exhaustionCauseFromOwnCamera(false), 'event_pool');
  assert.equal(exhaustionCauseFromOwnCamera(null), 'event_pool');
  assert.equal(exhaustionCauseFromOwnCamera(undefined), 'event_pool');
});

// ── 2 · no surface may promise a refill ────────────────────────────────────

/** Every sentence this module can produce, across every input. */
function everySentence(): string[] {
  const out: string[] = [];
  for (const cause of ['own_camera', 'event_pool'] as const) {
    out.push(exhaustionHeadline(cause));
    for (const buyOffered of [true, false]) {
      for (const dailyBudget of [true, false]) {
        out.push(exhaustionDetail(cause, { buyOffered, dailyBudget }));
      }
    }
  }
  for (const [landed, refused] of [
    [0, 1],
    [3, 5],
    [7, 1],
    [1, 1],
  ] as const) {
    const t = arrivalTally(landed, refused);
    assert.ok(t, 'a refused shot must always produce a tally');
    out.push(t.headline, t.detail);
  }
  return out;
}

test('nothing this module can say claims the exhausted budget comes back', () => {
  const banned =
    /refills?\s+tomorrow|today['’]s shots|come back tomorrow|try again tomorrow|daily (limit|allowance) (resets|refills) (so|and) you/i;
  for (const s of everySentence()) {
    assert.doesNotMatch(s, banned, `this sentence promises the refused budget back: ${s}`);
  }
});

test('and every one of them says, positively, what does NOT come back', () => {
  // A sentence can avoid the banned words and still leave the guest waiting.
  for (const cause of ['own_camera', 'event_pool'] as const) {
    for (const buyOffered of [true, false]) {
      for (const dailyBudget of [true, false]) {
        assert.match(
          exhaustionDetail(cause, { buyOffered, dailyBudget }),
          /don['’]t come back|doesn['’]t refill/i,
          `${cause}/${buyOffered}/${dailyBudget}: silence about the refill is what made her wait`,
        );
      }
    }
  }
});

// ── 2b · THE HONEST SENTENCE IS NOT HARDCODED EITHER ───────────────────────
//
// A per-day budget is REAL: papic_tier_config.points_per_day minus
// papic_seat_day_usage for CURRENT_DATE, resetting with no job because tomorrow
// is a different row. It is NULL on every tier a guest holds today and nothing
// reads it — but "it refills tomorrow" is TRUE on a tier that carries one, and
// ltd/roll/unlimited are one is_active flip away. Swapping one hardcoded claim
// for the opposite hardcoded claim is the same defect facing the other way.

test('a seat WITH a daily allowance is told about it', () => {
  for (const cause of ['own_camera', 'event_pool'] as const) {
    const withBudget = exhaustionDetail(cause, { buyOffered: false, dailyBudget: true });
    const without = exhaustionDetail(cause, { buyOffered: false, dailyBudget: false });
    assert.notEqual(
      withBudget,
      without,
      `${cause}: the copy ignores whether this seat actually has a daily allowance`,
    );
    assert.match(withBudget, /tomorrow/i);
    assert.doesNotMatch(without, /tomorrow/i);
  }
});

test('and "tomorrow" never attaches to the budget that just refused', () => {
  // The whole hazard: a guest reads "tomorrow" and waits. Whenever the daily
  // allowance is mentioned, the sentence must say in the same breath which
  // budget it does NOT apply to.
  for (const cause of ['own_camera', 'event_pool'] as const) {
    const s = exhaustionDetail(cause, { buyOffered: false, dailyBudget: true });
    const at = s.search(/tomorrow/i);
    assert.ok(at > 0);
    const clause = s.slice(at);
    assert.match(
      clause,
      /don['’]t|doesn['’]t/i,
      `${cause}: "tomorrow" is left hanging with nothing saying it is not these shots`,
    );
  }
});

test('the route DERIVES the daily budget from this seat, never assumes it', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(
    src,
    /from\('papic_tier_config'\)/,
    'the route must read this seat’s own tier row, not assume a posture',
  );
  assert.match(src, /points_per_day/);
  assert.match(
    src,
    /dailyBudget/,
    'the derived value must reach exhaustionDetail and the client',
  );
  // And it must fail to FALSE — claiming an allowance comes back when it may
  // not is the error that ends the conversation.
  assert.match(src, /let dailyBudget = false;/);
});

test('the shipped route no longer carries the false sentence', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.doesNotMatch(
    src,
    /refills?\s+tomorrow/i,
    'app/api/upload/route.ts still tells a guest her camera refills tomorrow',
  );
  assert.doesNotMatch(src, /today['’]s shots/i);
});

// ── 3 · the two causes must stay distinguishable ───────────────────────────

test('the two causes never produce the same sentence', () => {
  assert.notEqual(exhaustionHeadline('own_camera'), exhaustionHeadline('event_pool'));
  for (const buyOffered of [true, false]) {
    assert.notEqual(
      exhaustionDetail('own_camera', { buyOffered, dailyBudget: false }),
      exhaustionDetail('event_pool', { buyOffered, dailyBudget: false }),
      'a guest who can add her own shots and a guest who can only ask the host ' +
        'were handed the same next step',
    );
  }
});

test('only the pot names the couple as the only person who can act', () => {
  assert.match(exhaustionDetail('event_pool', { buyOffered: false, dailyBudget: false }), /only the couple/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false, dailyBudget: false }), /only the couple/i);
});

test('a remedy is named only when it is actually on the screen', () => {
  // `buyOffered` is the same boolean that mounts the panel; promising "add more
  // shots below" with nothing below it is a dead control.
  assert.match(exhaustionDetail('own_camera', { buyOffered: true, dailyBudget: false }), /below/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false, dailyBudget: false }), /below/i);
  assert.match(exhaustionDetail('event_pool', { buyOffered: true, dailyBudget: false }), /below/i);
  assert.doesNotMatch(exhaustionDetail('event_pool', { buyOffered: false, dailyBudget: false }), /below/i);
});

test('the route sends the cause, not just the code', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(
    src,
    /resolveExhaustionCause/,
    'the route must derive the cause from the pool probe it already makes',
  );
  assert.match(
    src,
    /code:\s*'camera_points_exhausted'/,
    'the terminal code must survive — the client treats it as a hard cap',
  );
  assert.match(src, /status:\s*409/, 'the 409 must survive');
  assert.match(
    src,
    /reason:/,
    'a sentence the client cannot read is a measurement that never reaches the render',
  );
});

// ── 4 · PAP-13 · the arrival tells her, per photo ──────────────────────────

test('nothing refused → no tally, and the celebratory copy stands', () => {
  assert.equal(arrivalTally(8, 0), null);
  assert.equal(arrivalTally(0, 0), null);
});

test('3 of 8 landed is said as 3 of 8, in the guest’s own numbers', () => {
  const t = arrivalTally(3, 5);
  assert.ok(t);
  assert.match(t.headline, /3 of your 8 shots landed/);
  assert.match(t.detail, /The other 5 weren’t saved/);
});

test('one refused shot is not reported in the plural', () => {
  const t = arrivalTally(7, 1);
  assert.ok(t);
  assert.match(t.headline, /7 of your 8 shots landed/);
  assert.match(t.detail, /The other 1 wasn’t saved/);
});

test('the tally counts the session, not the trimmed roll', () => {
  // ROLL_MAX trims what is on screen; a sentence saying "of these N" would
  // misreport a long night. Nothing in the copy may point at the visible strip.
  const t = arrivalTally(40, 12);
  assert.ok(t);
  assert.match(t.headline, /40 of your 52 shots/);
  assert.doesNotMatch(`${t.headline} ${t.detail}`, /of these/i);
});

test('a refused shot is never called saved', () => {
  for (const [landed, refused] of [[0, 3], [3, 5], [9, 1]] as const) {
    const t = arrivalTally(landed, refused);
    assert.ok(t);
    assert.doesNotMatch(
      `${t.headline} ${t.detail}`,
      /every (photo|one)|all (of them|in the gallery)/i,
      'the panel used to claim every shot was in the gallery while some were refused',
    );
  }
});

test('the seat screen mounts the tally and badges a refused shot', () => {
  const src = stripComments(readFileSync(SEAT, 'utf8'));
  /*
    ⚠ AND NOT MERELY "arrivalTally IS CALLED". `arrivalTally(landedCount, 0)`
    returns null forever, the panel silently falls back to the celebratory
    branch, and every assertion about the copy stays green — which is exactly the
    cheapest off-switch a future edit would reach for ("the numbers confuse
    people"). Pin BOTH counters into the call.
  */
  assert.match(
    src,
    /arrivalTally\(\s*landedCount\s*,\s*refusedCount\s*\)/,
    'the tally must be computed from the refusal counter, not from a constant',
  );
  // And those counters must actually move, at the arrival, where a credit is spent.
  assert.match(src, /setLandedCount\(\(n\) => n \+ 1\)/);
  assert.match(src, /setRefusedCount\(\(n\) => n \+ 1\)/);

  /*
    ⚠ COUNTING THE OCCURRENCES OF `shot.status === 'capped'` IS NOT ENOUGH, and
    this guard shipped that way for one round. Deleting the OVERLAY's condition
    left the `disabled` test and the aria-label branch behind — still two
    matches, still green, and a refused photograph back to drawing nothing. A
    file-level match cannot say WHICH site went. So each site is anchored to
    what it actually does.
  */
  assert.match(
    src,
    /shot\.status === 'capped' && \([\s\S]{0,400}?<Ban\b/,
    'a refused shot must draw a visible badge — before this it drew NOTHING, a ' +
      'bare thumbnail indistinguishable from a photograph that was kept',
  );
  assert.match(
    src,
    /shot\.status === 'capped'\s*\?\s*'[^']*credits ran out'/,
    'a refused shot must say so to a screen reader too',
  );
  assert.match(
    src,
    /disabled=\{[\s\S]{0,200}?shot\.status === 'capped'/,
    'a refused shot must not be tappable as if it could be retried',
  );

  // And the panel must not congratulate her over refused shots.
  assert.match(
    src,
    /arrivalNote \?/,
    'the exhausted panel must branch on whether anything was actually refused',
  );
});

test('the comment stripper is not itself the reason these pass', () => {
  // If stripComments ate everything, the doesNotMatch assertions above would
  // pass for the wrong reason. Pin that live code survives it.
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(src, /camera_points_exhausted/, 'stripComments destroyed the source');
  assert.ok(src.length > 4000, 'stripComments destroyed the source');
});
