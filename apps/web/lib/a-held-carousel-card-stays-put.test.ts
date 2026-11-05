/**
 * ✋ A HELD CAROUSEL CARD STAYS PUT (owner 2026-11-01, verbatim, on the Guests page's summary carousel: *"there are some
 * parts there to help me filter what i see, when i press it it should stop auto scroll and stays there until the
 * picked item like attending, not coming, no reply and to invite is unpicked."*).
 *
 * The carousel advanced every 3 s and a touch paused it for only 6 s, so the card holding the active filter rotated
 * away. Held here:
 *   1. the ONE decision each tick makes (`carouselMove`, run — not read): while a card is held it NEVER advances; it
 *      stays, or returns to the held card after a swipe; the touch pause still wins; nothing held = the rotation;
 *   2. the tick takes its move from that decision, with `held` from the `holdKey` the host passes;
 *   3. Guests holds Replies while a reply filter is on and the +1s card while a +1 filter is on;
 *   4. no other carousel holds anything (their behaviour is unchanged).
 *
 * SABOTAGE, seen red: Guests' `holdKey` removed → (3); the tick advancing without asking `carouselMove` → (2);
 * `carouselMove` advancing while held → (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
/* The carousel imports a CSS module — stubbed, as `every-carousel-snaps-to-centre-and-loops.test.ts` does. */
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SRC = read('components/snap-carousel.tsx');

test('1 · while a card is held the carousel never advances — it stays, or comes back after a swipe', async () => {
  const { carouselMove } = await import('@/components/snap-carousel');
  for (let at = 0; at < 4; at++) {
    assert.equal(carouselMove({ held: null, at, paused: false }), 'advance', 'nothing held: the rotation stopped');
    assert.equal(carouselMove({ held: null, at, paused: true }), 'stay', 'a touch no longer pauses it');
    for (let held = 0; held < 4; held++) {
      assert.notEqual(carouselMove({ held, at, paused: false }), 'advance', `held card ${held} rotated away from ${at}`);
      assert.equal(carouselMove({ held, at, paused: false }), at === held ? 'stay' : 'return');
      assert.equal(carouselMove({ held, at, paused: true }), 'stay', 'a swipe is pulled back before the touch pause ends');
    }
  }
});

test('2 · the tick moves only as `carouselMove` says, with the held card from `holdKey`', () => {
  assert.match(SRC, /const heldIndex = holdKey === null \? -1 : cards\.findIndex\(\(c\) => c\.key === holdKey\);/);
  assert.match(SRC, /heldRef\.current = heldIndex >= 0 \? heldIndex : null;/);
  const tick = SRC.slice(SRC.indexOf('const tick = window.setInterval('), SRC.indexOf('}, advanceMs);'));
  assert.match(tick, /const held = heldRef\.current;/);
  assert.match(tick, /const move = carouselMove\(\{ held, at: realOf\(slot\), paused: Date\.now\(\) < pausedUntil \}\);\s*if \(move === 'stay'\) return;/);
  assert.match(tick, /move === 'return' \? track\.children\[held! \+ CAROUSEL_COPIES\] : track\.children\[slot \+ 1\]/);
  assert.equal((tick.match(/track\.scrollTo\(/g) ?? []).length, 1, 'the tick scrolls some other way than the decision');
  // A card newly held is brought to the centre.
  assert.match(SRC, /track\.children\[looping \? heldIndex \+ CAROUSEL_COPIES : heldIndex\]/);
});

test('3 · Guests holds the card whose filter is on — Replies, or the +1s', () => {
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /<SnapCarousel\s+cards=\{summaryCards\}[^>]*holdKey=\{replyFilter \? 'replies' : plusFilter \? 'plus' : null\}/, 'the Guests carousel does not hold the filtering card');
  // The keys it names are the cards' own.
  assert.match(screen, /key: 'replies',\s*label: 'Replies and who is still to invite'/);
  assert.match(screen, /key: 'plus',\s*label: '\+1s'/);
});

test('4 · no other carousel holds anything', () => {
  const other = read('app/dashboard/[eventId]/guests/_components/view-summary-cards.tsx');
  assert.match(other, /<SnapCarousel\b/, 'anti-vacuity: the other carousel moved');
  assert.doesNotMatch(other, /holdKey/, 'another carousel holds a card — its behaviour changed');
  assert.match(SRC, /holdKey = null,/, 'a carousel with no holdKey is not the usual rotation');
});
