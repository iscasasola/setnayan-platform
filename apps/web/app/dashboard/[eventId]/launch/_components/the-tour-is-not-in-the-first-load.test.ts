/**
 * 🥗 THE TOURS ARE NOT IN THE MAKER'S FIRST LOAD (rd/maker-diet, 2026-09-30).
 *
 * The Maker's first-load JavaScript has a ceiling (`scripts/check-maker-js-budget.mjs`,
 * 505KB). A tour draws only for someone who has not seen it — the Maker's welcome on
 * a first visit or "About the Maker", `MiniTour`, the couple welcome — yet every tour's
 * copy (`lib/tours.ts`) rode in the code every open downloads. It now loads when a tour
 * renders. Each boundary below is one static import away from coming back:
 *
 *   1. `maker-shell.tsx` loads `./maker-tour` with `dynamic(() => import(…))`, never statically;
 *   2. `maker-bar.ts` (first load) reads nothing from `lib/tours` but its TYPE — the slide
 *      filter lives in `maker-tour-slides.ts`;
 *   3. the server files that mount the generic tour import the stand-in
 *      (`guided-tour-lazy.tsx`), never `guided-tour.tsx`;
 *   4. the stand-in is `'use client'` and reaches the tour only through `import()`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(__dirname, '../../../../..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components/';

/** Static, value-carrying `import … from '<spec>'` lines (never `import type`). */
function staticFrom(src: string, spec: RegExp): string[] {
  return [...src.matchAll(/(?:^|\n)\s*import\s+(?!type\s)[^'";]*?from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1]!)
    .filter((s) => spec.test(s));
}

test('1 · the Maker shell loads its tour on demand', () => {
  const src = read(`${L}maker-shell.tsx`);
  assert.deepEqual(staticFrom(src, /^\.\/maker-tour$/), [], 'maker-shell.tsx imports ./maker-tour statically — the tour is back in the first load');
  assert.match(src, /const MakerTour = dynamic\(\(\) => import\(\s*['"]\.\/maker-tour['"]\s*\)/, 'maker-shell.tsx no longer loads MakerTour with dynamic(() => import(…))');
});

test('2 · the Maker bar takes only the TYPE from lib/tours', () => {
  const src = read(`${L}maker-bar.ts`);
  assert.deepEqual(staticFrom(src, /^@\/lib\/tours$/), [], 'maker-bar.ts imports a value from @/lib/tours — every tour is back in the first load');
  assert.match(read(`${L}maker-tour-slides.ts`), /export function makerTourSlides\(/, 'the slide filter left maker-tour-slides.ts');
});

test('3 · the server files mount the stand-in, never the tour itself', () => {
  for (const rel of ['app/dashboard/layout.tsx', 'app/_components/mini-tour.tsx']) {
    const src = read(rel);
    assert.deepEqual(staticFrom(src, /\/guided-tour$/), [], `${rel} imports guided-tour.tsx statically — import GuidedTour from guided-tour-lazy`);
    assert.equal(staticFrom(src, /\/guided-tour-lazy$/).length, 1, `${rel} no longer imports the GuidedTour stand-in`);
  }
});

test('4 · the stand-in is a client module that reaches the tour only through import()', () => {
  const raw = readFileSync(join(WEB, 'app/_components/guided-tour-lazy.tsx'), 'utf8');
  assert.match(raw, /^'use client';/, "guided-tour-lazy.tsx is not 'use client'");
  const src = stripComments(raw);
  assert.deepEqual(staticFrom(src, /guided-tour$/), [], 'the stand-in imports the tour statically');
  assert.match(src, /export const GuidedTour = dynamic\(\(\) => import\(\s*['"]\.\/guided-tour['"]\s*\)/);
});
