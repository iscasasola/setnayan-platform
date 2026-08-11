/**
 * A VIDEO COSTS WHAT ITS LENGTH COSTS (owner-locked 2026-08-11).
 *
 * Owner's table, verbatim — seconds → credits:
 *   1 → 2 · 2 → 2 · 3 → 3 · 4 → 5 · 5 → 5 · 6 → 5 · 7 → 8 · 8 → 8 · 9 → 8 · 10 → 8
 *
 * The table is pinned literally below, second by second, because it is a PRICE.
 * A band boundary that drifts by one second changes what a person pays, and the
 * only way that stays honest is if moving it has to come past this file.
 *
 * Run: cd apps/web && npx tsx --test lib/papic-clip-cost.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  papicClipCost,
  papicCaptureCost,
  PAPIC_CLIP_COST_BANDS,
  PAPIC_CLIP_COST_MAX,
  PAPIC_CLIP_COST_MIN,
  PAPIC_POINTS_PER_CLIP,
  PAPIC_POINTS_PER_PHOTO,
  PAPIC_PRESERVATION_UNITS_PER_CLIP,
} from './papic-cameras';

/** The owner's table, second by second. */
const TABLE: ReadonlyArray<[seconds: number, credits: number]> = [
  [1, 2],
  [2, 2],
  [3, 3],
  [4, 5],
  [5, 5],
  [6, 5],
  [7, 8],
  [8, 8],
  [9, 8],
  [10, 8],
];

test('the owner’s table, second by second', () => {
  for (const [seconds, credits] of TABLE) {
    assert.equal(
      papicClipCost(seconds * 1000),
      credits,
      `${seconds}s must cost ${credits} credits`,
    );
  }
});

test('nothing got more expensive — ten seconds still costs what every clip used to', () => {
  // The whole change is a price CUT for short clips. If the top band ever drifts
  // above the old flat price, this stops being a cut and becomes a rise nobody
  // agreed to.
  assert.equal(papicClipCost(10_000), PAPIC_POINTS_PER_CLIP);
  assert.equal(PAPIC_CLIP_COST_MAX, PAPIC_POINTS_PER_CLIP);
});

test('a photo is untouched', () => {
  assert.equal(PAPIC_POINTS_PER_PHOTO, 1);
  assert.equal(papicCaptureCost('photo'), 1);
  assert.equal(papicCaptureCost('photo', 9_000), 1, 'a duration must not touch a photo');
});

// ── the two properties that keep the ladder honest ─────────────────────────

test('it is never cheaper to shoot longer', () => {
  let prev = 0;
  for (let s = 1; s <= 10; s += 1) {
    const cost = papicClipCost(s * 1000);
    assert.ok(
      cost >= prev,
      `${s}s costs ${cost}, less than the ${prev} the second before it — a shooter would be paid to record longer`,
    );
    prev = cost;
  }
});

test('chopping a clip up is never MEANINGFULLY cheaper — and the one place it is', () => {
  // ⚠ THE OWNER'S TABLE HAS EXACTLY ONE SPOT WHERE CHOPPING PAYS, and it is
  // recorded here rather than smoothed away, because the table is HIS price and
  // silently repricing 4 seconds to close a 1-credit gap is not a code change.
  //
  //   4s whole  = 5 credits
  //   2s + 2s   = 4 credits   ← 1 credit cheaper, as two files instead of one
  //
  // Left alone deliberately. The saving is one credit — a third of a peso — and
  // it costs the person a worse video (two clips of a four-second moment) plus
  // the fiddle of stopping and restarting mid-shot. Nobody trades that for ₱0.33.
  // It costs US slightly more storage for slightly less revenue, at a volume of
  // approximately nobody.
  //
  // WHAT THIS TEST STILL GUARDS is that the gap never GROWS. If a future band
  // edit makes chopping worth 2 credits or more anywhere, that is a real
  // incentive to game the pricing and this goes red.
  const TOLERATED = 1;
  for (let whole = 1; whole <= 10; whole += 1) {
    const oneClip = papicClipCost(whole * 1000);
    for (let piece = 1; piece < whole; piece += 1) {
      const pieces = Math.ceil(whole / piece);
      const split = pieces * papicClipCost(piece * 1000);
      assert.ok(
        split >= oneClip - TOLERATED,
        `${whole}s costs ${oneClip} whole but only ${split} as ${pieces}×${piece}s — ` +
          `a saving of ${oneClip - split} credits is enough to make chopping worth it`,
      );
    }
  }
});

test('the tolerated chop is EXACTLY the 4-second one, and nothing else', () => {
  // Pinned so the exception cannot quietly spread. If a band edit opens a second
  // place where chopping saves a credit, the count moves and this fires — the
  // tolerance above would otherwise absorb it in silence.
  const found: string[] = [];
  for (let whole = 1; whole <= 10; whole += 1) {
    const oneClip = papicClipCost(whole * 1000);
    for (let piece = 1; piece < whole; piece += 1) {
      const pieces = Math.ceil(whole / piece);
      const split = pieces * papicClipCost(piece * 1000);
      if (split < oneClip) found.push(`${whole}s→${pieces}×${piece}s saves ${oneClip - split}`);
    }
  }
  assert.deepEqual(found, ['4s→2×2s saves 1'], 'a new way to game the table appeared');
});

// ── the direction an unknown length must fail ──────────────────────────────

test('🚨 an unmeasured clip costs the MOST, never the least', () => {
  // THE LOAD-BEARING ASSERTION. The duration reaches the server as a number the
  // BROWSER stamped — app/papic/actions.ts says in as many words that it is
  // "spoofable by a hostile direct caller". Since the price now depends on it,
  // the one thing a tampered client must not be able to do is get a discount by
  // sending nothing. Every unusable value bills the top band.
  for (const bad of [null, undefined, Number.NaN, 0, -1, -10_000, Infinity, -Infinity]) {
    assert.equal(
      papicClipCost(bad as number | null | undefined),
      PAPIC_CLIP_COST_MAX,
      `${String(bad)} must cost the top band, not the cheap one`,
    );
  }
});

test('a clip longer than the cap costs the most, it does not wrap round to cheap', () => {
  // The 10s cap is enforced elsewhere (the record seam rejects it outright).
  // Here, a value past the last band must fall off the expensive end.
  assert.equal(papicClipCost(11_000), PAPIC_CLIP_COST_MAX);
  assert.equal(papicClipCost(60_000), PAPIC_CLIP_COST_MAX);
  assert.equal(papicClipCost(Number.MAX_SAFE_INTEGER), PAPIC_CLIP_COST_MAX);
});

test('seconds round UP — you pay for the second you are in', () => {
  assert.equal(papicClipCost(1), 2, 'a single millisecond is still a first second');
  assert.equal(papicClipCost(2_001), 3, '2.001s is a 3-second clip');
  assert.equal(papicClipCost(2_999), 3);
  assert.equal(papicClipCost(3_000), 3, 'exactly 3s is still 3s');
  assert.equal(papicClipCost(3_001), 5, 'just past 3s enters the next band');
  assert.equal(papicClipCost(6_000), 5);
  assert.equal(papicClipCost(6_001), 8);
});

// ── the seams, and what each of them is allowed to know ────────────────────

test('the presign floor is genuinely the cheapest band', () => {
  // app/api/upload gates on this. If it drifted above the true minimum, a
  // shooter with a small balance would be refused a URL for a clip they can
  // afford — a shot silently lost to a rounding choice.
  const cheapest = Math.min(...PAPIC_CLIP_COST_BANDS.map((b) => b.points));
  assert.equal(PAPIC_CLIP_COST_MIN, cheapest);
  assert.equal(papicClipCost(1_000), PAPIC_CLIP_COST_MIN);
});

test('storage stays flat, and stays flat ON PURPOSE', () => {
  // preservationUnits bills from a row carrying `is_clip` and no duration, so
  // a kept video's length is unreadable. Billing storage at the cheap band
  // would under-charge every video over three seconds.
  assert.equal(PAPIC_PRESERVATION_UNITS_PER_CLIP, PAPIC_CLIP_COST_MAX);
  assert.equal(
    papicCaptureCost('clip'),
    PAPIC_CLIP_COST_MAX,
    'a clip cost asked WITHOUT a duration must be the ceiling — the presign seam and preservation both rely on it',
  );
});

test('the bands are ordered and reach the cap, so no length falls in a hole', () => {
  const maxes = PAPIC_CLIP_COST_BANDS.map((b) => b.maxSeconds);
  assert.deepEqual([...maxes].sort((a, b) => a - b), maxes, 'bands must be in ascending order');
  assert.equal(maxes[maxes.length - 1], 10, 'the last band must reach the 10-second cap');
  const points = PAPIC_CLIP_COST_BANDS.map((b) => b.points);
  assert.deepEqual([...points].sort((a, b) => a - b), points, 'band prices must ascend with length');
});
