/**
 * a-thread-without-geometry-does-not-crash.test.ts — the doorway's decorative
 * gold thread never takes a page down.
 *
 * Live, 2026-11-23: PAGE_CRASH on /schedule (and the same fingerprint on
 * /seat-plan, /monogram, /mood-board, /pakanta) — `n.getTotalLength is not a
 * function`, thrown inside the useGSAP scope of `usePanelIntro`. A client whose
 * `<path>` has no SVGGeometryElement methods hit an unguarded
 * `path.getTotalLength()` and fell to the root error screen.
 *
 * 🔑 The length is read through `strokeLengthOrZero`, which returns 0 when the
 * method is missing; 0 means "no draw-in, the line rests drawn".
 *
 * SABOTAGE (run 2026-11-23): restore `len = path.getTotalLength()` in
 * usePanelIntro → RED (source assertion); make `strokeLengthOrZero` call the
 * method unguarded → RED (behaviour assertion, TypeError).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { strokeLengthOrZero } from '@/lib/svg-stroke-length';

const src = stripComments(readFileSync(join(__dirname, '_premium.tsx'), 'utf8'));

function hookBody(name: string): string {
  const start = src.indexOf(`export function ${name}(`);
  const end = src.indexOf('export function', start + 1);
  assert.ok(start >= 0 && end > start, `anti-vacuity: ${name} not found in _premium.tsx`);
  return src.slice(start, end);
}

test('a path without getTotalLength measures 0 instead of throwing', () => {
  // The crashing client: an element that is a <path> by tag but has no geometry API.
  const bare = { tagName: 'path' } as unknown as Parameters<typeof strokeLengthOrZero>[0];
  assert.doesNotThrow(() => strokeLengthOrZero(bare));
  assert.equal(strokeLengthOrZero(bare), 0);
  assert.equal(strokeLengthOrZero({ getTotalLength: 'nope' }), 0);
  assert.equal(strokeLengthOrZero(null), 0);
  assert.equal(strokeLengthOrZero(undefined), 0);
});

test('a measurable path reports its real length, and a bad length is not drawn from', () => {
  const real = { getTotalLength: () => 1012.5 };
  assert.equal(strokeLengthOrZero(real), 1012.5);
  // `this` is the element — the browser method needs it.
  const bound = {
    d: 640,
    getTotalLength(this: { d: number }) {
      return this.d;
    },
  };
  assert.equal(strokeLengthOrZero(bound), 640);
  assert.equal(strokeLengthOrZero({ getTotalLength: () => Number.NaN }), 0);
  assert.equal(strokeLengthOrZero({ getTotalLength: () => 0 }), 0);
  assert.equal(strokeLengthOrZero({ getTotalLength: () => -4 }), 0);
});

test('_premium.tsx never calls getTotalLength directly', () => {
  assert.doesNotMatch(
    src,
    /\.getTotalLength\s*\(/,
    'an unguarded getTotalLength() is back in _premium.tsx — read the length through strokeLengthOrZero',
  );
});

test('usePanelIntro and useProvision measure through the guard and only dash a measured stroke', () => {
  const intro = hookBody('usePanelIntro');
  assert.match(intro, /strokeLengthOrZero\(path\)/, 'usePanelIntro no longer measures the thread through the guard');
  assert.match(intro, /if \(path && len\) \{\s*gsap\.set\(path/, 'usePanelIntro dashes the thread without a measured length');

  const provision = hookBody('useProvision');
  assert.match(provision, /strokeLengthOrZero\(rule\)/, 'useProvision no longer measures the rule through the guard');
  assert.match(provision, /if \(rule && ruleLen\) \{\s*gsap\.set\(rule/, 'useProvision dashes the rule without a measured length');
});
