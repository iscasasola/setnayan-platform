/**
 * a-tall-section-still-reveals.test.ts — `useReveal` can always fire, however
 * tall the section it hides.
 *
 * Measured 2026-11-04 on a local build of /for-suppliers at 390 × 844: the plan
 * ladder (wrapped in `<RevealOnView>`) is ~7,400 px tall. `useReveal` set it to
 * opacity 0 and waited for 15% of it to be on screen — ~1,100 px, more than the
 * whole phone. The observer never fired, so every plan card stayed invisible
 * while the DOM (and every source test) said it was there.
 *
 * 🔑 An IntersectionObserver ratio is a share of the ELEMENT; the most a screen
 * can show is viewport ÷ height. So the threshold has to be capped by that, or
 * "hidden until seen" becomes "hidden".
 *
 * SABOTAGE (run 2026-11-04): restore `{ threshold }` → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, '_premium.tsx'), 'utf8'));

test('useReveal caps its threshold by what the screen can show', () => {
  const start = src.indexOf('export function useReveal(');
  const end = src.indexOf('export function', start + 1);
  assert.ok(start >= 0 && end > start, 'anti-vacuity: useReveal not found in _premium.tsx');
  const body = src.slice(start, end);

  assert.match(body, /new IntersectionObserver\(/, 'anti-vacuity: useReveal no longer observes');
  assert.match(
    body,
    /window\.innerHeight[^;]*\/\s*Math\.max\(1,\s*root\.offsetHeight\)/,
    'useReveal no longer measures how much of the section a screen can show',
  );
  assert.match(
    body,
    /threshold:\s*Math\.min\(threshold,\s*reachable\)/,
    'useReveal hands the observer a threshold a tall section can never reach — it stays at opacity 0',
  );
});

test('the arithmetic: the capped threshold is reachable at every height', () => {
  const cap = (threshold: number, viewport: number, height: number) =>
    Math.min(threshold, (viewport * 0.5) / Math.max(1, height));
  for (const height of [200, 844, 5_000, 7_400, 20_000]) {
    const t = cap(0.15, 844, height);
    const mostVisible = Math.min(1, 844 / height);
    assert.ok(t <= mostVisible, `a ${height}-px section can show ${mostVisible} at most, threshold ${t}`);
  }
  // A section that fits keeps the threshold it asked for.
  assert.equal(cap(0.15, 844, 600), 0.15);
});
