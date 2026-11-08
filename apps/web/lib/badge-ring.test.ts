/**
 * lib/badge-ring.test.ts — every shop badge's ring: how full, which colour (Build 2 §10 #32, lane B2-B).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_COLOUR, ringDelay, ringGroup, ringPct } from './badge-ring';
import type { BadgeTile } from './shop-badge-row';

const tile = (over: Partial<BadgeTile> & { kind?: string; state?: string }): BadgeTile =>
  ({
    key: over.key ?? 'x',
    on: over.on ?? false,
    num: over.num ?? '',
    sub: '',
    ladder: over.ladder ?? null,
    row: { kind: over.kind ?? 'reward', state: over.state ?? 'ok' },
  }) as unknown as BadgeTile;

test('a ladder fills toward its next tier — the pct the tile already measured', () => {
  assert.equal(ringPct(tile({ ladder: { pct: 40 } as BadgeTile['ladder'] })), 40);
});

test('an unread badge is an EMPTY ring, never a guess', () => {
  assert.equal(ringPct(tile({ state: 'unread', on: true, ladder: { pct: 80 } as BadgeTile['ladder'] })), 0);
});

test('rating is average / 5; a one-off is full when earned, empty when not', () => {
  assert.equal(ringPct(tile({ kind: 'rating', on: true, num: '4.8' })), 96);
  assert.equal(ringPct(tile({ kind: 'rating', on: false, num: '4.8' })), 0);
  assert.equal(ringPct(tile({ on: true })), 100);
  assert.equal(ringPct(tile({ on: false })), 0);
});

test('colour by what the badge is about', () => {
  assert.equal(ringGroup(tile({ kind: 'milestone' })), 'bookings');
  assert.equal(ringGroup(tile({ kind: 'rating' })), 'reputation');
  assert.equal(ringGroup(tile({ kind: 'verified' })), 'found');
  assert.equal(ringGroup(tile({ kind: 'award' })), 'reputation');
  assert.equal(ringGroup(tile({ key: 'reward:inspiration' })), 'found');
  assert.equal(ringGroup(tile({ key: 'reward:something_new' })), 'other');
  assert.equal(RING_COLOUR.other, 'rgb(var(--sn-accent))');
});

test('the rings draw in one after another, capped at the 7th', () => {
  assert.equal(ringDelay(0), 120);
  assert.equal(ringDelay(1), 210);
  assert.equal(ringDelay(6), ringDelay(20));
});
