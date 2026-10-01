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

const GROUPS = read('groups-sidebar.tsx');

// ⤷ 2026-09-30 (the Fable rows, then Fix E): the facet PILLS became four
// dropdowns (`roster-controls.tsx`) and `lens-pill.tsx` was deleted — it had no
// importer left (ugat-both-ends caught it). The group chips below are the
// surviving link facets, and they keep the same warm-up rule.

test('group chips get the same treatment, and skip the active group', () => {
  assert.match(GROUPS, /onMouseEnter=\{warm\}/, 'group chips lose the warm-up');
  assert.match(GROUPS, /onFocus=\{warm\}/, 'keyboard users lose it on group chips');
  assert.match(GROUPS, /if \(!isCurrent\) router\.prefetch\(href\)/, 'the active group must not prefetch');
  assert.match(GROUPS, /prefetch=\{false\}/, 'group chips must not viewport-prefetch either');
});
