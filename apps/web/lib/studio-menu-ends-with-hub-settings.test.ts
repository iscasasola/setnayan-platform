/**
 * 🎛 STUDIO ▾ ENDS WITH "EVENT HUB SETTINGS" — the approved Event Hub Pro prototype (`prototypes/build-contracts-2026-10-
 * 30/event-hub-pro/` `studioMenu`, DECISION_LOG 2026-10-30 "EVENT HUB PRO (look redesign)"): after Studio's pages, a
 * hairline, then one row "Event Hub Settings — Look · address · QR · who can view · E-Gifts" that opens the ⚙ sheet.
 * What left Studio (Look · Info's address · E-Gifts) is found from where it used to be.
 *
 *   1 · the row is the LAST thing in the Studio pages sheet, after the pages and a divider, with the prototype's words;
 *   2 · it closes the list and opens THE ⚙ — the shell's one `moreOpen`, the pinned row's `HubSettingsGear` — never a
 *       second sheet of its own; it is offered only where the ⚙ is (`hasWork`);
 *   3 · it is a row of the list (the house pick-option look), not a page: it is not a `StudioTileKey`, so it never
 *       counts in "n of N ready" and is never ticked.
 *
 * Read from SOURCE, comments stripped (the sheet is drawn on <body> only in a browser).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { STUDIO_MENU_KEYS, STUDIO_TILE_KEYS } from './studio-tile-defs';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PARTS = read(`${L}/stages-studio-parts.tsx`);
const SHELL = read(`${L}/maker-shell.tsx`);
const SWITCH = PARTS.slice(PARTS.indexOf('export function StudioSideSwitch('), PARTS.indexOf('function StudioHalf('));
const SHEET = SWITCH.slice(SWITCH.indexOf('<MakerSheet label="Studio pages"'), SWITCH.indexOf('</MakerSheet>'));

test('1 · the last row of Studio ▾, after the pages and a divider, in the prototype’s words', () => {
  assert.ok(SWITCH.length > 500 && SHEET.length > 300, 'anti-vacuity: Studio ▾’s sheet was not found');
  const pages = SHEET.indexOf('studioChooserOptions(tiles).map(');
  const row = SHEET.indexOf('data-studio-menu-settings=""');
  assert.ok(pages > 0 && row > pages, 'the Event Hub Settings row is not after Studio’s pages');
  assert.match(SHEET.slice(row), /^data-studio-menu-settings="" className="[^"]*border-t[^"]*"/, 'no divider before the row');
  assert.match(SHEET.slice(row), />Event Hub Settings</, 'the row is not named Event Hub Settings');
  assert.match(PARTS, /export const STUDIO_MENU_SETTINGS_LINE = 'Look · address · QR · who can view · E-Gifts';/, 'the row’s line is not the prototype’s');
  assert.match(SHEET.slice(row), /\{STUDIO_MENU_SETTINGS_LINE\}/);
  // Nothing after it: the row is the sheet's last.
  assert.doesNotMatch(SHEET.slice(row), /data-pick-option=\{o\.key\}/, 'a page is listed after the settings row');
});

test('2 · it closes the list and opens THE ⚙ — the pinned row’s sheet, offered only where the ⚙ is', () => {
  assert.match(SHEET, /data-pick-option="settings"\s+onClick=\{\(\) => \{\s*shut\('pages'\);\s*onSettings\(\);\s*\}\}/, 'the row does not close the list and open the ⚙');
  assert.match(SHEET, /\{onSettings \? \(/, 'the row is drawn with no ⚙ to open');
  assert.match(SHELL, /<StudioSideSwitch [^\n]*onSettings=\{hasWork \? \(\) => setMoreOpen\(true\) : undefined\} \/>/, 'Studio ▾ does not open the shell’s one ⚙');
  assert.match(SHELL, /<HubSettingsGear\s+open=\{moreOpen\}\s+onOpenChange=\{setMoreOpen\}/, 'the ⚙ is not the one `moreOpen` sheet');
  assert.doesNotMatch(SWITCH, /<HubSettingsGear\b|<MenuSettingsButton\b/, 'Studio ▾ draws a second settings sheet of its own');
});

test('3 · a row of the list, not a page — never counted, never ticked', () => {
  assert.ok(!(STUDIO_TILE_KEYS as readonly string[]).includes('settings') && !(STUDIO_MENU_KEYS as readonly string[]).includes('settings' as never));
  const row = SHEET.slice(SHEET.indexOf('data-studio-menu-settings=""'));
  assert.match(row, /className=\{pickOptionClass\(true, false\)\}/, 'the row does not wear the list’s option look');
  assert.doesNotMatch(row, /aria-selected|data-pick-tick/, 'the settings row can be ticked as if it were a page');
});
