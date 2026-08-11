/**
 * thank-you-video.test.ts — the Thank-You Video's rule, and the boundary that
 * keeps its server reader out of the browser.
 *
 * ── WHY THE RULE IS TESTED AND THE READER IS NOT ─────────────────────────
 * `lib/thank-you-video.ts` carries `import 'server-only'` and cannot be loaded
 * under `tsx --test`. Its sibling `lib/creator-teaser.ts` keeps the identical
 * min/cap/reason logic INSIDE that boundary and has no test at all — a rule
 * that cannot be imported does not get asserted. So the decision lives in
 * `thank-you-video-shared.ts` (pure, client-safe) and is exercised here.
 *
 * ── WHAT CAN ACTUALLY GO WRONG ───────────────────────────────────────────
 * Not the encoding — that is `lib/reel-render.ts`, already shipping on three
 * surfaces. What can go wrong is:
 *   1. the floor and cap silently drifting, so a couple gets a strobe or a
 *      two-frame "film";
 *   2. the refusal sentence lying about WHY — "no photos yet" when the gallery
 *      is full of shots no guest agreed to share sends them hunting a problem
 *      that does not exist;
 *   3. the client-safe module growing a server import, which does not fail
 *      `tsc` — only `next build` models the RSC boundary — and so ships a
 *      broken production build with green CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

import {
  planFromFrames,
  THANK_YOU_MIN_PHOTOS,
  THANK_YOU_MAX_PHOTOS,
  THANK_YOU_TARGET_SEC,
  THANK_YOU_PALETTE,
} from './thank-you-video-shared';

const HERE = dirname(fileURLToPath(import.meta.url));

const frames = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ clipId: `p${i}`, url: `https://x/${i}.jpg` }));

test('below the floor it refuses, and says why in a sentence a person can act on', () => {
  const p = planFromFrames(frames(THANK_YOU_MIN_PHOTOS - 1));
  assert.equal(p.canRender, false);
  assert.equal(p.photos.length, 0, 'A refused plan must hand back NO photos — a half-plan is how a caller renders a two-frame film.');
  assert.match(p.reason!, /cleared to share publicly/);
  assert.match(p.reason!, /agreed to share them/);
  // 🔑 The count must be the REAL one. Reporting 0 when five cleared frames
  // exist would send the couple looking for missing photos instead of missing
  // consent — two completely different actions.
  assert.equal(p.availableCount, THANK_YOU_MIN_PHOTOS - 1);
  assert.match(p.reason!, new RegExp(String(THANK_YOU_MIN_PHOTOS - 1)));
});

test('exactly at the floor it renders — the boundary is inclusive', () => {
  const p = planFromFrames(frames(THANK_YOU_MIN_PHOTOS));
  assert.equal(p.canRender, true, 'An off-by-one here refuses the smallest wedding that qualifies.');
  assert.equal(p.reason, null);
  assert.equal(p.photos.length, THANK_YOU_MIN_PHOTOS);
});

test('the cap holds, and the honest total survives it', () => {
  const p = planFromFrames(frames(500));
  assert.equal(p.photos.length, THANK_YOU_MAX_PHOTOS, 'Uncapped, a 500-photo gallery renders a strobe.');
  assert.equal(
    p.availableCount,
    500,
    'availableCount must be the pre-cap total. Collapsing it to the cap makes ' +
      '"you have 20" indistinguishable from "you have 500 and we used 20".',
  );
});

test('one cleared frame reads as "is", not "are"', () => {
  // Small thing, and it is the kind of thing a couple notices on the screen
  // where they are being told they cannot have what they paid for.
  assert.match(planFromFrames(frames(1)).reason!, /there is 1 so far/);
  assert.match(planFromFrames(frames(2)).reason!, /there are 2 so far/);
});

test('an empty gallery still refuses cleanly rather than throwing', () => {
  const p = planFromFrames([]);
  assert.equal(p.canRender, false);
  assert.equal(p.availableCount, 0);
  assert.ok(p.reason && p.reason.length > 0);
});

test('the film fits inside the 30-second ceiling every Setnayan reel shares', () => {
  // RECAP_MAX_DURATION_MS, owner-locked 2026-06-28. A longer target would not
  // error — it would silently produce something the rest of the product says
  // cannot exist.
  assert.ok(THANK_YOU_TARGET_SEC > 0 && THANK_YOU_TARGET_SEC <= 30);
  // At the cap, each frame must still hold long enough to read a face.
  const secondsPerFrame = THANK_YOU_TARGET_SEC / THANK_YOU_MAX_PHOTOS;
  assert.ok(
    secondsPerFrame >= 0.8,
    `At the cap each photo gets ${secondsPerFrame.toFixed(2)}s — below ~0.8s it is a strobe, not a montage.`,
  );
});

test('it wears the locked terracotta palette, not the creator teaser brand chrome', () => {
  // The creator teaser is deliberately obsidian/gold — brand chrome aimed at a
  // creator's own audience. This film is the couple's and must look like the
  // rest of their wedding (palette locked 2026-08-04).
  assert.deepEqual(THANK_YOU_PALETTE, ['#FDFBF7', '#2C2A29', '#C24E25', '#A9834B']);
});

test('the client-safe module imports nothing server-only', () => {
  // 🪤 This CANNOT be caught by tsc — only `next build` models the RSC
  // boundary, so a server import here ships a broken production build with a
  // green typecheck. The shared module is imported by a 'use client'
  // component, so this is the guard that keeps the split real rather than
  // conventional.
  // ⚠ COMMENTS MUST BE STRIPPED, and this line is the receipt: the first cut
  // scanned raw source and failed on the shared module's own docblock, which
  // explains the boundary and therefore says "server-only" in prose. A guard
  // that flags the documentation of the rule it enforces is worse than none —
  // the fix people reach for is deleting the explanation. Goes through
  // lib/strip-comments.ts, the repo's real lexer, for the same reason
  // vendor-publish-guard.test.ts had to stop inlining a regex.
  const src = stripComments(readFileSync(resolve(HERE, 'thank-you-video-shared.ts'), 'utf8'));
  assert.ok(
    !/server-only/.test(src),
    'thank-you-video-shared.ts imports server-only. It is bundled into the client.',
  );
  for (const banned of ['./papic-gallery', './guest-stories', './supabase/admin', './uploads']) {
    assert.ok(
      !new RegExp(`from ['"]${banned.replace('.', '\\.')}['"]`).test(src),
      `thank-you-video-shared.ts imports ${banned}, which reaches 'server-only'.`,
    );
  }
});
