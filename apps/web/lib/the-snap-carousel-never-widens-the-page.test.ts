/**
 * the-snap-carousel-never-widens-the-page.test.ts — 🔒 W4 B2 (18 Nov 2026): at 390 px the Guests page measured
 * `documentElement.scrollWidth` 406 > 390 — the summary carousel's slides leaked ~16 px to the page. The track scrolls
 * its own overflow; the carousel's ROOT must never be wider than its column or let anything out sideways.
 *
 * SABOTAGE: delete `overflow-x: clip` or `max-width: 100%` from `.carousel` → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { ruleBody } from './press-reach';

const css = stripComments(readFileSync(join(import.meta.dirname, '..', 'components', 'snap-carousel.module.css'), 'utf8'));

test('the carousel root clips sideways overflow and is never wider than its column', () => {
  const root = ruleBody(css, '.carousel');
  assert.ok(root, '.carousel rule is gone');
  assert.match(root!, /overflow-x:\s*clip;/, 'the carousel root lets its slides widen the page');
  assert.match(root!, /max-width:\s*100%;/, 'the carousel root can be wider than its column');
});

test('the track still scrolls its own overflow (the carousel works)', () => {
  const track = ruleBody(css, '.track');
  assert.match(track ?? '', /overflow-x:\s*auto;/);
  assert.match(track ?? '', /scroll-snap-type:\s*x mandatory;/);
});
