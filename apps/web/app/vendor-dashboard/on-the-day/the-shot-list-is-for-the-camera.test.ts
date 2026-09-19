import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { resolveDayOfConsoleKind } from '@/lib/vendor-day-of';

/**
 * S43 · 8 — the shot list on the On-the-day page is for photo/video suppliers.
 *
 * RE-MEASURED 2026-09-19 BEFORE BUILDING: the register row said the list
 * "shows for every supplier". On origin/main it does not, and has not since the
 * 2026-07-01 reskin (8155ea13d): the one mount sits behind `kind === 'photo'`.
 * What was missing was a fence, so this pins the gate rather than rebuilding it.
 *
 * The couple side (DAY-10, `shot-list-card.tsx`) asks the booking's category
 * (photographer · videographer) only to decide whether an EMPTY list deserves a
 * "not shared yet" line; a list that exists is shown whoever kept it. So the
 * supplier-side gate is the one that decides who is offered a list at all.
 */

const PAGE = stripComments(
  readFileSync(join(process.cwd(), 'app/vendor-dashboard/on-the-day/page.tsx'), 'utf8'),
);

test('the shot list is mounted once, and only behind the photo console', () => {
  assert.ok(PAGE.length > 10_000, 'read the real page (an empty read is a green lie)');
  const mounts = [...PAGE.matchAll(/<ShotListSection\b/g)];
  assert.equal(mounts.length, 1, `expected 1 <ShotListSection mount, found ${mounts.length}`);
  // The condition is the text between the nearest `{` before the mount and it.
  const at = mounts[0]!.index!;
  const open = PAGE.lastIndexOf('{', at);
  const condition = PAGE.slice(open, at).replace(/\s+/g, ' ').trim();
  assert.equal(condition, "{kind === 'photo' ? (", `the shot list's gate is now: ${condition}`);
  // The component itself is only reached through that section.
  assert.equal([...PAGE.matchAll(/<ShotList\b(?!Section)/g)].length, 1);
});

test('only photo/video tiles resolve to the photo console', () => {
  assert.equal(resolveDayOfConsoleKind(['photo_video']), 'photo');
  for (const s of [['catering'], ['florist'], ['live_band'], ['hair_makeup'], [], null]) {
    assert.notEqual(resolveDayOfConsoleKind(s as string[] | null), 'photo', JSON.stringify(s));
  }
});
