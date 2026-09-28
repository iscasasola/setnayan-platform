import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { rosterDoors } from '@/lib/roster-doors';

/**
 * ⚖ OWNER 2026-09-23: *"the guest list on mobile mode is different from the
 * desktop mode."* — the Wedding March once had exactly one door, the Guest
 * list's doors row, and that row shipped `hidden lg:block`, so a phone could
 * not reach the march at all.
 *
 * ⚖ OWNER 2026-09-29 (DECISION_LOG "THE GUEST LIST KEEPS PEOPLE…"): the march
 * LEFT the Guest list. Its one home is the Maker's Details › Your event, in the
 * three parts, and an old Guest list link lands there. The same lesson holds
 * in its new home: on a phone the Details navigator — the only way to the
 * item, and to the march's own lines — must not be hidden.
 *
 * ⚠ A REACHABILITY TEST, NOT A LAYOUT ONE.
 */

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const LAUNCH = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components');
const read = (dir: string, ...p: string[]) => stripComments(readFileSync(join(dir, ...p), 'utf8'));

test('the Wedding March has one home — Details — and the Guest list hands old links to it', () => {
  const doors = rosterDoors({ eventId: 'e1', view: 'list', finished: false, hasJoinLink: true });
  assert.ok(!doors.tabs.some((d) => /walk|march/i.test(d.key)), 'the Guest list offers the march again');
  const page = read(GUESTS, 'page.tsx');
  assert.match(page, /redirect\(detailsItemHref\(eventId, 'march'\)\)/, 'an old ?gview=walk link no longer lands on Details');
  const carousel = read(GUESTS, '_components', 'mobile-guest-carousel.tsx');
  assert.doesNotMatch(carousel, /gview:\s*'walk'|gview=walk/, 'the phone carousel links to a march view that no longer exists');
});

test('on a phone, the Details navigator — and the march’s own lines in it — is not hidden', () => {
  const ws = read(LAUNCH, 'details-workspace.tsx');
  const nav = ws.slice(ws.indexOf('<nav aria-label="Details'), ws.indexOf('>', ws.indexOf('<nav aria-label="Details')));
  assert.ok(nav.length > 0, 'the Details navigator is gone');
  assert.doesNotMatch(nav.replace(/lg:[\w-]+/g, ''), /\bhidden\b/, 'the Details navigator is hidden on a phone');
  // The march's lines ride in that same navigator while the item is open.
  assert.match(ws, /\{pieces\[selected\] && !allItems \? \(/);
});
