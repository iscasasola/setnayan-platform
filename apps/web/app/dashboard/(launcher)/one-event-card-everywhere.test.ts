import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * one-event-card-everywhere.test.ts
 *
 * ⚖ OWNER RULING 2026-08-23: one event card on phone and laptop. The board used
 * to render every shelf TWICE — a phone composition under `sm:hidden` (a
 * full-width dark hero for the first event, two-up chips for the rest) and a
 * glass-card grid under `hidden sm:grid`.
 *
 * This replaced two OWNER-APPROVED compositions, which is why it is an owner
 * decision and not an engineering one, and why this file exists: to make a
 * silent drift back to two compositions impossible, and to prove the collapse
 * took nothing with it.
 *
 * 🛡 Every assertion mutation-checked BY OCCURRENCE COUNT.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const src = () => stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('no shelf hides a composition at a breakpoint any more', () => {
  const s = src();
  assert.equal(count(s, /sm:hidden/g), 0, 'a phone-only composition is back');
  assert.equal(count(s, /hidden gap-3 sm:grid/g), 0, 'a desktop-only composition is back');
});

test('the one grid starts at ONE column and widens', () => {
  const s = src();
  const grids = count(s, /className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"/g);
  // Now happening · Planning · Put away · Untold · Told.
  assert.equal(grids, 5, `expected one grid per shelf, saw ${grids}`);
  assert.ok(
    !/grid-cols-2 gap-2\.5/.test(s),
    'the two-up phone chip grid is back',
  );
});

test('the phone-only cards are deleted, not merely unmounted', () => {
  const s = src();
  for (const name of ['MobileEventHero', 'MobileEventChip']) {
    assert.ok(
      !new RegExp(`function ${name}\\\\b|<${name}\\\\s`).test(s),
      `${name} is back. Dead code that looks like a shipped card is what made ` +
        'a guard pass on an unmounted component twice in this file already.',
    );
  }
});

test('every shelf still renders a card, and only one kind of card', () => {
  const s = src();
  const mounts = count(s, /<GlassEventCard\s/g);
  assert.equal(mounts, 5, `expected one card mount per shelf, saw ${mounts}`);
});

test('nothing was lost in the collapse — the card carries every signal', () => {
  // Checked rather than assumed. The phone pair printed the stance, the count,
  // the reason a dead card cannot open, and the story-page override; all four
  // are on the card that replaced them.
  const s = src();
  const body = s.slice(s.indexOf('function GlassEventCard'), s.indexOf('function MobileEvent') > 0 ? s.indexOf('function MobileEvent') : s.indexOf('function EventAttention'));
  assert.match(body, /<StanceChip stance=\{stance\}/, 'the stance');
  assert.match(body, /<EventAttention\s/, 'the count');
  assert.match(body, /\{closedReason\}/, 'why a dead card cannot open');
  assert.match(body, /const resolvedHref = storyHref \?\? href;/, 'the story-page override');
});

test('the New-event card is offered once, not twice', () => {
  // Both compositions carried one. Collapsing without noticing would have left
  // two "Create an event" tiles stacked on a phone.
  assert.equal(count(src(), /<NewEventCard\b/g), 1);
});

test('the popover anchor alternation went with the two-up grid', () => {
  // A fixed 280px popover hung off the right of a LEFT-column chip landed
  // offscreen, so the chips alternated. At one column a card is full width and
  // the default right anchor has room — the alternation is not needed, and a
  // leftover `align` would be dead configuration nobody could explain.
  assert.equal(count(src(), /align=\{i % 2 === 0 \? 'left' : 'right'\}/g), 0);
});
