/**
 * A facet click is a FULL SERVER NAVIGATION, and the roster query is 1.2 ms —
 * so the wait the owner reported ("clicking here takes a lot of time to show")
 * is the round trip, not the database. The pills warm their payload on hover
 * and focus so the click lands on a cache.
 *
 * 🪤 THIS IS EXACTLY THE KIND OF CODE SOMEBODY TIDIES AWAY. Two handlers that
 * "do nothing visible" and an explicit `prefetch={false}` read like leftovers.
 * They are not:
 *
 *   • remove the hover/focus warm → every click pays the full round trip again,
 *     and nothing looks broken, so nobody notices for months;
 *   • flip `prefetch` to true/default → Next warms on VIEWPORT instead, and
 *     every pill is on screen at once (Side, RSVP, seven views, every group,
 *     every tag), so ~25 full page renders fire on each load and compete with
 *     the paint the host is actually waiting for. Making the first render
 *     slower to make a later click faster is the wrong trade.
 *
 * Source guards, because the behaviour is in JSX props — nothing here returns
 * a value a unit test could read.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = 'app/dashboard/[eventId]/guests/_components';
const read = (f: string) =>
  stripComments(readFileSync(join(process.cwd(), HERE, f), 'utf8'));

const PILL = read('lens-pill.tsx');
const GROUPS = read('groups-sidebar.tsx');

test('THE REGRESSION: the facet pill warms on both hover and focus', () => {
  assert.match(PILL, /onMouseEnter=\{warm\}/, 'pointer users lose the warm-up');
  assert.match(PILL, /onFocus=\{warm\}/, 'keyboard users lose the warm-up');
  assert.match(PILL, /router\.prefetch\(href\)/, 'nothing is actually prefetched');
});

test('the pill does NOT viewport-prefetch', () => {
  // `prefetch={false}` is load-bearing, not a default being restated.
  assert.match(
    PILL,
    /prefetch=\{false\}/,
    'viewport prefetching every pill fires ~25 renders per load and slows first paint',
  );
});

test('the warm-up skips the pill that is already applied', () => {
  // Its href is the page you are standing on; prefetching it is pure waste.
  assert.match(PILL, /if \(!active\) router\.prefetch/, 'the active pill must not prefetch');
});

test('group chips get the same treatment, and skip the active group', () => {
  assert.match(GROUPS, /onMouseEnter=\{warm\}/, 'group chips lose the warm-up');
  assert.match(GROUPS, /onFocus=\{warm\}/, 'keyboard users lose it on group chips');
  assert.match(GROUPS, /if \(!isCurrent\) router\.prefetch\(href\)/, 'the active group must not prefetch');
  assert.match(GROUPS, /prefetch=\{false\}/, 'group chips must not viewport-prefetch either');
});

test('the pill is a client component — a server one cannot prefetch at all', () => {
  assert.match(PILL, /^'use client';/, "lens-pill.tsx must stay 'use client'");
});
