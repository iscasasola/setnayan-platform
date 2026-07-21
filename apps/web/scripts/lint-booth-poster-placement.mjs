#!/usr/bin/env node
/**
 * lint-booth-poster-placement.mjs
 *
 * Fails when the 3D booth poster stand's placement is hardcoded in the RENDERER
 * instead of read from `boothPosterLocalOffset`, or when `BoothPoster`'s frame
 * dimensions are hardcoded instead of read from `BOOTH_POSTER_FRAME`.
 *
 * WHY THIS GUARD EXISTS — and why a unit test cannot do this job:
 *
 * PR #3437 placed the poster with a literal `w / 2 + 0.42` measured off the
 * SHARED 2.0 m booth footprint. Two things were wrong at once: the booth's real
 * body is its resolved CHASSIS (1.8 m … 3.4 m), and the 0.42 gap was smaller
 * than the stand's OWN half-width (0.45), so the banner reached back inside the
 * booth body on NINE of the ten chassis. It shipped because nothing checks a
 * number that only manifests as pixels in a 3D scene.
 *
 * The obvious fix — "assert the renderer and the obstacle agree" — is a TRAP,
 * and the first version of `lib/booth-poster-placement.test.ts` fell into it.
 * `templateBoothObstacles` computes the disc by calling `boothPosterLocalOffset`
 * INTERNALLY. A unit test that computes its expected value from the same helper
 * is comparing the module to itself: it passes whether or not the renderer uses
 * the helper at all. And the renderer cannot be reached directly — it is JSX in
 * a `'use client'` component, and this repo has no React render harness in the
 * unit suite (`test:unit` runs `tsx --test` over the lib test glob).
 *
 * So the renderer↔helper link is a CROSS-FILE INVARIANT that TypeScript cannot
 * express and node:test cannot observe — exactly the category the repo's other
 * `lint-*.mjs` guards exist for. It is checked lexically, on source text.
 *
 * HOW IT CHECKS — a lexical scan of venue-objects.tsx:
 *   1. Strip comments, so a literal quoted in prose (this file's own history is
 *      full of `w / 2 + 0.42`) cannot trip or silence the scan.
 *   2. BAN the old placement literal in any form (whitespace-insensitive).
 *   3. REQUIRE both poster render sites to go through `boothPosterLocalOffset`.
 *   4. REQUIRE `BoothPoster` to read `BOOTH_POSTER_FRAME` rather than declaring
 *      its own `maxW` / `maxH` literals — that hand-copied pair is what the
 *      placement maths must stay in step with.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, '..', 'app', '_components', 'plan3d', 'venue-objects.tsx');

const raw = readFileSync(TARGET, 'utf8');

/** Blank out comments while preserving offsets, so line numbers stay true. */
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

const problems = [];

// 1 · The banned literal, in any spacing.
const BANNED = /w\s*\/\s*2\s*\+\s*0\.42/g;
for (const m of src.matchAll(BANNED)) {
  const line = src.slice(0, m.index).split('\n').length;
  problems.push(
    `${TARGET}:${line} — hardcoded poster offset \`${m[0]}\`. ` +
      `Use boothPosterLocalOffset(spec) (kit/booth-templates.ts).`,
  );
}

// 2 · Both render sites must go through the helper. There are two: the
//     templated branch (a SIBLING of the rotated group, so its offset is
//     rotateLocalRad'd) and the generic silhouette branch (a CHILD of the
//     rotated group, so it takes booth-LOCAL coords and must NOT be rotated).
const posterRenders = [...src.matchAll(/<BoothPoster\b/g)].length;
const helperCalls = [...src.matchAll(/boothPosterLocalOffset\s*\(/g)].length;
if (posterRenders > 0 && helperCalls < posterRenders) {
  problems.push(
    `${TARGET} — ${posterRenders} <BoothPoster> render site(s) but only ` +
      `${helperCalls} boothPosterLocalOffset() call(s). Every site must derive ` +
      `its position from the helper, or the branches drift apart (that is ` +
      `exactly how the generic branch was left on the old constant).`,
  );
}

// 3 · BoothPoster must not re-declare the frame it shares with the maths.
//     SCOPED to BoothPoster's own body: sibling components legitimately use
//     `maxW`/`maxH` for their own boxes (BoothSign fits a logo that way), and a
//     whole-file scan flags them as false positives — which is how a guard
//     earns a blanket `// eslint-disable`-shaped workaround and stops guarding.
const POSTER_FN = /export function BoothPoster\b/.exec(src);
if (!POSTER_FN) {
  problems.push(
    `${TARGET} — could not find \`export function BoothPoster\`. If it was ` +
      `renamed or moved, update this guard; do not delete it.`,
  );
} else {
  const bodyStart = POSTER_FN.index;
  // Next top-level declaration after it, or EOF.
  const nextDecl = /\nexport (function|const) /g;
  nextDecl.lastIndex = bodyStart + 1;
  const nextMatch = nextDecl.exec(src);
  const body = src.slice(bodyStart, nextMatch ? nextMatch.index : src.length);

  const OWN_FRAME = /const\s+max[WH]\s*=\s*[\d.]+/g;
  for (const m of body.matchAll(OWN_FRAME)) {
    const line = src.slice(0, bodyStart + m.index).split('\n').length;
    problems.push(
      `${TARGET}:${line} — \`${m[0]}\` hardcodes a poster frame dimension ` +
        `inside BoothPoster. Read BOOTH_POSTER_FRAME instead; ` +
        `BOOTH_POSTER_HALF_W is derived from it, and a hand-copied half-width ` +
        `is the original defect.`,
    );
  }
}

if (problems.length > 0) {
  console.error('\n✗ lint-booth-poster-placement\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\nThe booth poster's placement must come from ONE helper shared by the\n` +
      `renderer and the crowd-avoidance disc. A unit test cannot enforce this:\n` +
      `templateBoothObstacles calls the helper internally, so asserting\n` +
      `"renderer and obstacle agree" from the helper compares the module to\n` +
      `itself and passes even when the renderer is hardcoded. Hence this scan.\n` +
      `See changelog.d/booth-poster-placement.md.`,
  );
  process.exit(1);
}

console.log(
  `✓ lint-booth-poster-placement: ${posterRenders} render site(s) via the shared helper, no hardcoded offset or frame.`,
);
