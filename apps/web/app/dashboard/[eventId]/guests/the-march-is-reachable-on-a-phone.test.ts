import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

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
 * 🗂 R4 (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH"): the march COMES HOME to Guests —
 * Guests › March, a view of the same row as List · Map, at every width (the view row is never `hidden`). The old
 * Guest list links (`?gview=walk`, `?view=march`) land on it.
 *
 * ⚠ A REACHABILITY TEST, NOT A LAYOUT ONE.
 */

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const LAUNCH = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components');
const read = (dir: string, ...p: string[]) => stripComments(readFileSync(join(dir, ...p), 'utf8'));

test('the Wedding March has one home — Guests › March (R4) — and the Guest list hands old links to it', () => {
  // ⤷ R4: the view row draws every view the event has, March among them, at every width.
  const screen = read(GUESTS, '_components', 'guests-screen.tsx');
  // 🎚 2026-10-30: the row is ONE ▾ on every view (owner, *"The menu does not work properly"*) — March is one of its
  // choices where the event's views have it.
  assert.match(screen, /const tops = GUESTS_TOPS\.filter\(\(t\) => t === 'guests' \|\| guestsViews\.includes\(t\)\);/, 'March is not offered where the event has it');
  assert.match(screen, /\.\.\.\(tops\.includes\('march'\) \? \[\{ key: 'march', label: GUESTS_TOP_LABEL\.march/, 'the ▾ does not offer the March');
  const rowAt = screen.indexOf('data-first-row="" data-guests-top-row=""');
  const row = screen.slice(screen.lastIndexOf('<div', rowAt), rowAt);
  assert.doesNotMatch(row, /\bhidden\b/, 'the view row is hidden at some width — a phone could not reach the March');
  const summary = screen.slice(screen.indexOf('function PinnedSummary('), screen.indexOf('function joinedToTheRowAbove'));
  assert.doesNotMatch(summary, /\bhidden\b/, 'the ▾ is hidden at some width');
  const page = read(GUESTS, 'page.tsx');
  assert.match(page, /redirect\(guestsViewHref\(eventId, 'march'\)\)/, 'an old ?gview=walk link no longer lands on Guests › March');
  // ⤷ 2026-09-30 (Fix E): the phone carousel was deleted; the phone draws the
  // same head as the computer, so no phone-only link to a march view can exist.
  assert.doesNotMatch(page, /gview:\s*'walk'|gview=walk/, 'the roster links to a march view that no longer exists');
});

test('on a phone, the Details items and the march’s own lines are reachable — in the editor sheet’s one dropdown', () => {
  const ws = read(LAUNCH, 'details-workspace.tsx');
  // 2026-10-02 (owner, live phone test: "too clumped"; the approved phone layout, frame G):
  // the navigator strip is the desktop's; on a phone its items and an item's pieces — the
  // march's lines — are the editor sheet's ONE dropdown (`SheetSections`).
  const sheet = ws.slice(ws.indexOf('<SheetSections'), ws.indexOf('/>', ws.indexOf('<SheetSections')));
  assert.ok(sheet.length > 0, 'the editor sheet has no dropdown — on a phone the march has no way in');
  assert.match(sheet, /items=\{navGroups\.flatMap\(\(g\) => g\.items\)\}/, 'the sheet’s dropdown does not list the items');
  assert.match(sheet, /pieces=\{pieces\[selected\] \?\? null\}/, 'the sheet’s dropdown does not hold the item’s pieces (the march’s lines)');
  const sections = read(LAUNCH, 'sheet-sections.tsx');
  assert.match(sections, /\{pieces \? <div className="flex flex-col gap-0\.5">\{pieces\}<\/div> : null\}/, 'the dropdown does not draw the pieces');
  // The march's lines ride as pieces while the item is open — part 3's one piece mechanism.
  assert.match(ws, /\{on && pieces\[i\.key\] \? \(/);
  assert.match(ws, /data-details-pieces=\{i\.key\}\s*className="contents lg:flex/);
});
