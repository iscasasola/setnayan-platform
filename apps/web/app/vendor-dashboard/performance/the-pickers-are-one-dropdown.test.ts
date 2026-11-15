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
const DOING = read('business-doing.tsx');

test('the window is the house sliding switch, one per card — never a ▾, a track of its own or a native select', () => {
  assert.match(CAROUSEL, /import \{ PillSelector \} from '@\/app\/_components\/pill-selector';/);
  assert.match(CAROUSEL, /<PillSelector label=\{`Window for \$\{title\}`\} value=\{winOf\(k\)\} options=\{WINDOW_OPTIONS\}/);
  for (const src of [CAROUSEL, TREE, SECTION, DOING]) {
    assert.doesNotMatch(src, /<PickMenu\b|PillTrack|role="tablist"|<select\b/, 'a second kind of window picker is back');
  }
});

test('"How is my business doing" wears the same sliding switch — its ▾ is gone (ruling 6075)', () => {
  assert.match(DOING, /import \{ PillSelector \} from '@\/app\/_components\/pill-selector';/);
  assert.match(DOING, /<PillSelector\s+label="Which days"\s+value=\{key\}/, 'the window is not the house switch');
  assert.match(DOING, /data-business-fixed-window/, 'a card handed one window must show it as a label, with no switch');
  // Numbers tick old → new (HeldCount), never a remount that drops them to 0; the bars regrow on a slide.
  assert.match(DOING, /<HeldCount value=\{w\.views\}/);
  assert.doesNotMatch(DOING, /<CountUp\b/, 'the counts restart from 0 on a slide again');
  assert.match(DOING, /key=\{key\}[^>]*data-business-bars-window/, 'the bars no longer regrow when the switch slides');
});

test('no service-scope picker — the carousel is the whole shop', () => {
  assert.ok(!existsSync(join(C, 'service-scope-selector.tsx')) && !existsSync(join(C, 'service-scope-select-client.tsx')), 'the scope ▾ is back');
  assert.doesNotMatch(SECTION, /searchParams|\?service=|activeServiceId/, 'the section filters by a service again');
});
