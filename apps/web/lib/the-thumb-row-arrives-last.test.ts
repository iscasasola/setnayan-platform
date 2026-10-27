/**
 * the-thumb-row-arrives-last.test.ts — 🔒 THE THUMB ROW ENTERS AFTER THE PAGE HAS BUILT ITSELF.
 *
 * Owner 2026-10-27 (DECISION_LOG "THE THUMB ROW ARRIVES LAST"): *"make thumb row pop up last so it does not intersect
 * with the animation and build up of the page?"*.
 *
 *   · ONE timing (`lib/thumb-row-arrives-last.ts`) — never a per-page number.
 *   · It waits at least as long as the longest arrival the Guests page plays (read from its CSS, so a slower ring
 *     cannot silently overlap the row again).
 *   · Reduced motion never waits.
 *   · Guests takes `data-on` from it — the old two-frame `requestAnimationFrame` slide-in is gone — and the row
 *     rises AND fades, taking no taps until it is on.
 *
 * Sabotage (2026-10-27, each reverted): the delay set to 300 → red (shorter than the ring) · Guests back on the
 * double rAF → red · `opacity: 0` dropped from `.lower` → red · the no-taps-until-on rule removed → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { THUMB_ROW_ENTERS_AFTER_MS, thumbRowDelay } from './thumb-row-arrives-last';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUESTS = join(HERE, '..', 'app', 'dashboard', '[eventId]', 'guests', '_components');
const SCREEN = stripComments(readFileSync(join(GUESTS, 'guests-screen.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(GUESTS, 'guests-screen.module.css'), 'utf8'));

test('the row waits out the longest arrival animation on Guests', () => {
  const durations = [...CSS.matchAll(/animation:\s*gs-(?:ring-in|half-in|catpop|popin)\s+(\d+)ms/g)].map((m) => Number(m[1]));
  assert.ok(durations.length >= 2, 'the Guests arrival animations were not found — the guard reads nothing');
  const longest = Math.max(...durations);
  assert.ok(
    THUMB_ROW_ENTERS_AFTER_MS > longest,
    `the row enters at ${THUMB_ROW_ENTERS_AFTER_MS} ms, inside the page's own ${longest} ms build-up`,
  );
});

test('reduced motion never waits; otherwise the one timing', () => {
  assert.equal(thumbRowDelay(true), 0);
  assert.equal(thumbRowDelay(false), THUMB_ROW_ENTERS_AFTER_MS);
});

test('Guests takes its row’s entrance from the one timing, not two animation frames', () => {
  assert.match(SCREEN, /const barOn = useThumbRowArrivesLast\(gview\);/, 'Guests does not use the shared timing');
  assert.doesNotMatch(SCREEN, /setBarOn/, 'the old per-page slide-in is back');
  assert.match(SCREEN, /data-on=\{barOn \? 'true' : 'false'\}/, 'the row no longer reads it');
});

test('the row rises and fades in, and takes no taps until it is on', () => {
  const lower = CSS.slice(CSS.indexOf('.lower {'), CSS.indexOf('}', CSS.indexOf('.lower {')));
  assert.match(lower, /opacity: 0;/, 'the row does not fade in');
  assert.match(lower, /transform: translateY\(140%\);/, 'the row does not rise');
  const on = CSS.slice(CSS.indexOf(".lower[data-on='true'] {"), CSS.indexOf('}', CSS.indexOf(".lower[data-on='true'] {")));
  assert.match(on, /opacity: 1;/);
  assert.match(CSS, /\.lower:not\(\[data-on='true'\]\) > \* \{\s*pointer-events: none;/, 'a hidden row can be tapped');
});
