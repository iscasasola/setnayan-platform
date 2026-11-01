/**
 * the-board-menu-stays-on-screen.test.ts — 📐 THE EVENTS BOARD'S ⋯ MENU IS WHOLLY ON SCREEN, AND OFFERS "VIEW EVENT
 * HUB" ONLY WHEN GUESTS CAN OPEN ONE (owner 2026-10-27, phone screenshots: on a left-column card the menu ran off the
 * left edge — "this away", "ove for good"; and *"View event hub add that if event hub is available for that event"*).
 *
 *   1 · `menuShiftIntoView` puts any measured box inside the 16-px gutter — the left-column case, the right-edge case,
 *       a box that already fits (0), and a box wider than the room keeps its START in view.
 *   2 · the menu is measured once open and slid by that amount — not left to `align`, which depends on a grid that
 *       has changed between one and two columns more than once.
 *   3 · "View Event Hub" draws only with a `hubUrl`, and opens through `openEventHub` (in-app sheet / new tab).
 *   4 · the board computes `hubUrl` by Home's rule — a slug AND Public/Unlisted — from its OWN read, never by widening
 *       `fetchUserEvents` (one column a role cannot SELECT would reject every dashboard).
 *
 * 🛡 SABOTAGE (2026-10-28, each red then restored): `menuShiftIntoView` returning 0 → 1; the `transform` dropped from
 * the menu → 2; the `hubUrl ?` condition removed → 3; `'unlisted'` dropped from the board's rule → 4.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { menuShiftIntoView } from './menu-place';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MENU = 'app/dashboard/(launcher)/_components/event-card-menu.tsx';
const PAGE = 'app/dashboard/(launcher)/page.tsx';

test('1 · a measured menu is slid inside the 16-px gutter', () => {
  // The owner's case: a 280-px menu hung from the right edge of a left-column chip at 390.
  assert.equal(menuShiftIntoView({ left: -97, right: 183 }, 390), 113);
  // Hung off the right edge.
  assert.equal(menuShiftIntoView({ left: 150, right: 430 }, 390), -56);
  // Already inside.
  assert.equal(menuShiftIntoView({ left: 20, right: 300 }, 390), 0);
  // Wider than the room: the start stays in view.
  assert.equal(menuShiftIntoView({ left: 40, right: 440 }, 390), -24);
});

test('2 · the open menu is measured and slid, whatever column its card is in', () => {
  const src = read(MENU);
  assert.match(src, /ref=\{menuRef\}/, 'the menu box is not measured');
  assert.match(src, /menuShiftIntoView\(\{ left: r\.left, right: r\.right \}, document\.documentElement\.clientWidth\)/);
  assert.match(src, /style=\{menuShift \? \{ transform: `translateX\(\$\{menuShift\}px\)` \} : undefined\}/, 'the measured shift is not applied');
});

test('3 · "View Event Hub" only with a hub, through openEventHub', () => {
  const src = read(MENU);
  assert.match(src, /\{hubUrl \? \(\s*<>\s*<a\b[\s\S]{0,400}data-board-menu-hub=""/, 'the row draws without a hub to view');
  assert.match(src, /e\.preventDefault\(\);\s*close\(\);\s*openEventHub\(hubUrl\);/, 'the row does not open through openEventHub');
  assert.match(src, /View Event Hub/);
});

test("4 · the board's rule is Home's: a slug AND Public or Unlisted, from its own read", () => {
  const page = read(PAGE);
  assert.match(page, /\.select\('event_id, landing_page_visibility'\)/, 'the board does not read visibility on its own');
  assert.match(page, /r\.landing_page_visibility === 'public' \|\| r\.landing_page_visibility === 'unlisted'/);
  assert.match(page, /e\.member_type === 'couple' && e\.slug/, 'an event with no slug could be offered a /null link');
  const events = read('lib/events.ts');
  assert.doesNotMatch(events, /landing_page_visibility/, 'the shared fetchUserEvents read was widened — one ungranted column rejects every dashboard');
  assert.equal((page.match(/hubUrl=\{hubUrlById\.get\(event\.event_id\) \?\? null\}/g) ?? []).length, 5, 'a board shelf lost its hub link');
});
