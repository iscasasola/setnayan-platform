import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { rosterDoors } from '@/lib/roster-doors';

/**
 * ⚖ OWNER 2026-09-23: *"the guest list on mobile mode is different from the
 * desktop mode. seems like the mobile mode was not edited properly."*
 *
 * He was right, and the gap was worse than cosmetic. `rosterDoors` is the ONLY
 * producer of `?gview=walk` in the app; the phone's own control surface
 * (`mobile-guest-carousel.tsx`) emits `gview: null` and reads
 * `gview === 'map'`, never `walk`. With the doors row mounted `hidden
 * lg:block`, a phone had NO control that could reach the Wedding March — the
 * only way in was to type the URL.
 *
 * 🔑 AND THE MOBILE DESIGN WAS ALREADY BUILT. RosterTabs is a snap carousel
 * measured at 380px with an edge fade, and "Arrange the room" is an icon on
 * mobile because the owner asked for that on 2026-09-20. It all shipped behind
 * a `hidden`.
 *
 * ⚠ THIS IS A REACHABILITY TEST, NOT A LAYOUT ONE. It does not claim the row
 * looks right on a phone — it claims the phone HAS the row, and that the door
 * it carries is the only one that exists.
 */

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(GUESTS, ...p), 'utf8'));

test('the Wedding March has exactly one door, and it is the doors row', () => {
  const doors = rosterDoors({
    eventId: 'e1',
    view: 'list',
    finished: false,
    hasProcessional: true,
    hasJoinLink: true,
  });
  const walk = doors.tabs.find((d) => d.kind === 'tab' && d.key === 'walk');
  assert.ok(walk, 'rosterDoors no longer offers the Wedding March');

  // The phone's own surface does not offer it, so hiding the row hides the
  // feature. If that ever changes, this line is the place to say so.
  const carousel = read('_components', 'mobile-guest-carousel.tsx');
  assert.doesNotMatch(
    carousel,
    /gview:\s*'walk'|gview=walk/,
    'the mobile carousel now links to the walk view — update this test, it is no longer the only door',
  );
});

test('the doors row is not hidden from phones', () => {
  const page = read('page.tsx');
  const at = page.indexOf('<RosterTabs');
  assert.ok(at > -1, 'the page no longer mounts the doors row');
  // The wrapper element immediately before the mount.
  const open = page.lastIndexOf('<div', at);
  const wrapper = page.slice(open, at);
  assert.doesNotMatch(
    wrapper,
    /\bhidden\b/,
    'the doors row is hidden again — on a phone that removes the Wedding March entirely, because nothing else links to it',
  );
});
