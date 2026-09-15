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
  exhaustionDetail,
  exhaustionHeadline,
  resolveExhaustionCause,
} from './papic-exhaustion-truth';

/** Strip block + line comments so prose that QUOTES a banned string can't pass
 *  or fail a check about the code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

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

// ── 2 · no surface may promise a refill ────────────────────────────────────

/** Every sentence this module can produce, across every input. */
function everySentence(): string[] {
  const out: string[] = [];
  for (const cause of ['own_camera', 'event_pool'] as const) {
    out.push(exhaustionHeadline(cause));
    for (const buyOffered of [true, false]) {
      out.push(exhaustionDetail(cause, { buyOffered }));
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

test('nothing this module can say promises a refill', () => {
  // Every phrasing of the lie, not just the one that shipped.
  const banned = /refills?\s+tomorrow|today['’]s shots|resets?\s+(tomorrow|daily|each day)|come back tomorrow|try again tomorrow|per day|daily (limit|allowance)/i;
  for (const s of everySentence()) {
    assert.doesNotMatch(s, banned, `this sentence promises a refill that does not exist: ${s}`);
  }
});

test('and every one of them says, positively, that they do not refill', () => {
  // A sentence can avoid the banned words and still leave the guest waiting.
  for (const cause of ['own_camera', 'event_pool'] as const) {
    for (const buyOffered of [true, false]) {
      assert.match(
        exhaustionDetail(cause, { buyOffered }),
        /don['’]t refill/i,
        `${cause}/${buyOffered}: silence about the refill is what made her wait`,
      );
    }
  }
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
      exhaustionDetail('own_camera', { buyOffered }),
      exhaustionDetail('event_pool', { buyOffered }),
      'a guest who can add her own shots and a guest who can only ask the host ' +
        'were handed the same next step',
    );
  }
});

test('only the pot names the couple as the only person who can act', () => {
  assert.match(exhaustionDetail('event_pool', { buyOffered: false }), /only the couple/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false }), /only the couple/i);
});

test('a remedy is named only when it is actually on the screen', () => {
  // `buyOffered` is the same boolean that mounts the panel; promising "add more
  // shots below" with nothing below it is a dead control.
  assert.match(exhaustionDetail('own_camera', { buyOffered: true }), /below/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false }), /below/i);
  assert.match(exhaustionDetail('event_pool', { buyOffered: true }), /below/i);
  assert.doesNotMatch(exhaustionDetail('event_pool', { buyOffered: false }), /below/i);
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
  assert.match(t.headline, /5 of these 8/);
  assert.match(t.detail, /3 are in the gallery/);
  assert.match(t.detail, /the other 5 were not saved/);
});

test('one refused shot is not reported in the plural', () => {
  const t = arrivalTally(7, 1);
  assert.ok(t);
  assert.match(t.headline, /1 of these 8/);
  assert.match(t.detail, /the other 1 was not saved/);
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
  assert.match(src, /arrivalTally\(/, 'the seat roll must compute the tally');
  // A capped shot drew NOTHING before this — no overlay at all, so it looked
  // exactly like a photograph that was kept. Pin the overlay to the status.
  const overlays = src.match(/shot\.status === 'capped'/g) ?? [];
  assert.ok(
    overlays.length >= 2,
    `a refused shot must be BOTH disabled and visibly badged; found ${overlays.length} site(s)`,
  );
});

test('the comment stripper is not itself the reason these pass', () => {
  // If stripComments ate everything, the doesNotMatch assertions above would
  // pass for the wrong reason. Pin that live code survives it.
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(src, /camera_points_exhausted/, 'stripComments destroyed the source');
  assert.ok(src.length > 4000, 'stripComments destroyed the source');
});
