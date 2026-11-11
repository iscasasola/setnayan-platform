/**
 * 🎛 ANALYTICS' ONE PICKER IS EACH CARD'S SLIDING SWITCH (history: owner 2026-10-30 "ONE SELECTOR FOR EVERY PAGE", which
 * made the window and the service scope each one ▾ — then the owner's 11 Nov 2026 rulings, DECISION_LOG 🎚✅ *"Sliding
 * switch"* and 🎠 the window *"inside each card"*, which SUPERSEDE the ▾ window for Analytics).
 *
 *   · The window — 30 days · 12 months — is the house sliding two-button switch (`PillSelector`), one per card, never a
 *     page-wide ▾, never a pill track of its own, never a native `<select>`.
 *   · There is no service-scope picker any more: the carousel is the whole shop (prototype option 3 has none), and the
 *     card "Which card sells" is where one service is compared with another.
 *
 * Source checks (each fails with the change reverted).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const C = join(__dirname, '_components');
const read = (f: string) => stripComments(readFileSync(join(C, f), 'utf8'));
const CAROUSEL = read('analytics-carousel.tsx');
const TREE = read('analytics-growing.tsx');
const SECTION = read('one-analytics-section.tsx');

test('the window is the house sliding switch, one per card — never a ▾, a track of its own or a native select', () => {
  assert.match(CAROUSEL, /import \{ PillSelector \} from '@\/app\/_components\/pill-selector';/);
  assert.match(CAROUSEL, /<PillSelector label=\{`Window for \$\{title\}`\} value=\{winOf\(k\)\} options=\{WINDOW_OPTIONS\}/);
  for (const src of [CAROUSEL, TREE, SECTION]) {
    assert.doesNotMatch(src, /<PickMenu\b|PillTrack|role="tablist"|<select\b/, 'a second kind of window picker is back');
  }
});

test('no service-scope picker — the carousel is the whole shop', () => {
  assert.ok(!existsSync(join(C, 'service-scope-selector.tsx')) && !existsSync(join(C, 'service-scope-select-client.tsx')), 'the scope ▾ is back');
  assert.doesNotMatch(SECTION, /searchParams|\?service=|activeServiceId/, 'the section filters by a service again');
});
