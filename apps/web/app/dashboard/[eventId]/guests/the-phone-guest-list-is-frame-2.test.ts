/**
 * the-phone-guest-list-is-frame-2.test.ts — the Guest list on a phone is the
 * approved simple phone app's frame 2 (owner 2026-10-01, DECISION_LOG "THE
 * SIMPLE PHONE APP — APPROVED"): title + ⋯ · one search (the top bar) · one
 * Filter ▾ · counts · rows · the round +. Setup lives behind ⋯, never as banners.
 *
 * 🔑 NOTHING MAY BE DELETED BY A BREAKPOINT. Every control this file sees hidden
 * below `lg` must be drawn on the phone somewhere else, by the SAME element —
 * the Wedding March once vanished from every phone behind a `hidden lg:block`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(GUESTS, ...p), 'utf8'));
const PAGE = read('page.tsx');
const ROW = read('_components', 'find-add-row.tsx');
const MENU = read('_components', 'guests-phone-menu.tsx');

test('the doors row hides on a phone ONLY because the ⋯ draws the same element', () => {
  assert.match(PAGE, /<div className="hidden lg:block" data-roster-doors-row="">\{rosterTabs\}<\/div>/);
  assert.match(PAGE, /doors=\{rosterTabs\}/, 'the phone ⋯ no longer carries the roster\'s doors — they are gone from every phone');
  assert.equal((PAGE.match(/<GuestsPhoneMenu\b/g) ?? []).length, 1, 'a second, drifting ⋯');
  assert.equal((PAGE.match(/<RosterTabs\b/g) ?? []).length, 1, 'a second, drifting copy of the doors row');
  for (const slot of ['{sort}', '{doors}', '{addDoors}']) assert.ok(MENU.includes(slot), `the ⋯ sheet dropped ${slot}`);
  // ⋯ at every width — "desktop may show more, never different".
  assert.match(MENU, /<div data-guests-phone-menu="">/);
});

test('Sort ▾ and the add doors are behind ⋯ on a phone and in the row on a computer', () => {
  assert.match(PAGE, /sort=\{<RosterSort sorts=\{SORT_OPTIONS\.map/, 'the ⋯ has no Sort');
  assert.match(ROW, /<div className="hidden shrink-0 lg:block">\{sort\}<\/div>/);
  assert.match(PAGE, /addDoors=\{<AddDoors eventId=\{eventId\} rows \/>\}/, 'the ⋯ has no add doors (People · Full form · Import · Quick add list)');
  const capture = read('_components', 'capture-bar.tsx');
  assert.match(capture, /<AddDoors eventId=\{eventId\} \/>/, 'the computer\'s add doors left the name box');
  for (const d of ['OpenAddFromPeopleButton', 'OpenQuickAddButton', '/guests/import', '/guests/quick']) {
    assert.ok(capture.slice(capture.indexOf('export function AddDoors')).includes(d), `AddDoors lost ${d}`);
  }
});

test('ONE Filter ▾ at every width over the SAME four dropdowns; ONE + in the header opens the add sheet', () => {
  assert.match(ROW, /data-find-add-filter-toggle=""/, 'the one Filter ▾ is gone');
  assert.doesNotMatch(ROW.slice(ROW.indexOf('data-find-add-filter-toggle'), ROW.indexOf('data-find-add-filter-toggle') + 300), /lg:hidden/, 'the computer lost the one Filter ▾ — desktop may show more, never different');
  assert.match(ROW, /\{filterOpen \? 'block' : 'hidden'\}" data-find-add-filter=""|\$\{filterOpen \? 'block' : 'hidden'\}`\} data-find-add-filter=""/, 'the four dropdowns are not behind the one Filter ▾');
  // ONE way to add at every width (owner 2026-10-01 "okay keep it similar"): no header capture bar.
  assert.doesNotMatch(ROW, /data-find-add-add|<CaptureBar|\badd\b\s*[:?]/, 'a header add box is back in the row');
  // One ⋯ element: beside the phone's title, at the end of the computer's row.
  assert.match(ROW, /\{more \? <div className="ml-auto hidden shrink-0 lg:block">\{more\}<\/div> : null\}/, 'the computer lost its ⋯');
  assert.match(PAGE, /more=\{\s*<div className="flex items-center gap-2">[\s\S]{0,60}\{moreMenu\}/, 'the row is not handed the ⋯');
  assert.match(PAGE, /data-guests-phone-title="">[\s\S]{0,160}Guests[\s\S]{0,120}\{moreMenu\}/, 'the phone lost its title + ⋯ line (frame 2)');
  // ⚖ The + is in the HEADER beside ⋯ at every width — never a floating button
  // (owner 2026-10-01, "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB · MORE").
  assert.doesNotMatch(PAGE, /data-guests-add-fab|className="fixed[^"]*"[^>]*>\s*<OpenAddGuestButton/, 'a floating add button is back on the Guests page');
  assert.match(PAGE, /const addPlus = <OpenAddGuestButton\b/, 'the header + is gone');
  assert.match(PAGE, /data-guests-phone-title="">[\s\S]{0,260}\{addPlus\}\s*\{moreMenu\}/, 'the phone header has no + beside ⋯');
  assert.match(PAGE, /more=\{\s*<div className="flex items-center gap-2">\s*\{addPlus\}\s*\{moreMenu\}/, 'the computer header has no + beside ⋯');
  assert.doesNotMatch(read('_components', 'add-guest-sheet.tsx'), /\bfixed right-|\bbottom-\[/, 'the + became a floating button');
  // The layout's own floating "Add guest" stands down on this page.
  const navFab = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', '_components', 'customer-nav-fab.tsx'), 'utf8'));
  assert.match(navFab, /pathname === `\/dashboard\/\$\{eventId\}\/guests`\) return null;/, 'the floating "Add guest" still covers the Guests page');
  // The sheet: the name box first (the shipped CaptureBar, Enter adds), then the other ways as rows.
  assert.match(PAGE, /<AddGuestSheet\s+nameBox=\{<CaptureBar eventId=\{eventId\}[^}]*\} withDoors=\{false\} \/>\}\s+doors=\{<AddDoors eventId=\{eventId\} rows \/>\}/, 'the add sheet is not the name box + the other ways');
  assert.equal((PAGE.match(/<CaptureBar\b/g) ?? []).length, 1, 'a second capture bar (header) is back');
});

test('phone: ONE answer column picked by a VISIBLE Show ▾ on the counts line; computer: several columns', () => {
  // ⚖ Owner 2026-10-01: "on the mobile mode. we can pick a column and we will
  // show the answer for each guest. on desktop we can view multiple columns".
  const ROWS = read('_components', 'guest-list-multiselect.tsx');
  const SHOW = read('_components', 'phone-show-pick.tsx');
  // The phone keeps exactly ONE slot; the computer's slots follow its width.
  assert.match(ROWS, /storageKey: 'sn:guest-list-columns:phone:v1',\s*defaults: availableColumns,\s*fixedSlots: 1,/, 'the phone shows more than one answer column');
  assert.match(ROWS, /desk\.columns\.map\(\(column, slot\) =>/, 'the computer no longer shows several columns');
  // The pick is published by the list and drawn, visible, on the counts line.
  assert.match(ROWS, /publishPhoneColumn\(\{ column: phoneColumn, available: availableColumns, pick: \(c\) => phonePick\(0, c\) \}\)/, 'the phone column pick is not handed out');
  const counts = PAGE.slice(PAGE.indexOf('function RosterCountsLine('));
  assert.match(counts.slice(0, 2500), /<PhoneShowPick \/>/, 'Show ▾ is not on the counts line');
  assert.match(SHOW, /lg:hidden" data-roster-phone-show=""/, 'Show ▾ shows on a computer, which has several columns');
  assert.match(SHOW, /<PickMenu\b/, 'Show ▾ is not the one shipped dropdown');
  assert.match(SHOW, /onPick=\{\(key\) => show\.pick\(key as RosterColumn\)\}/, 'Show ▾ does not pick');
  assert.doesNotMatch(MENU, /usePhoneColumn/, 'Show ▾ is buried in the ⋯ again');
  assert.doesNotMatch(ROWS, /data-roster-phone-column=""/, 'a Show strip sits above the rows again');
  // One counts line on a phone; the meters are the computer's extra.
  assert.match(PAGE, /<div className="hidden lg:block" data-roster-meters="">/, 'the meters stack above the rows on a phone again');
  assert.match(PAGE, /\{countsLine\}/, 'the phone lost its one counts line');
});

test('desktop may show more, never different: the dashed + on BOTH row shapes, and the same four add ways', () => {
  // ⚖ Owner 2026-10-01: "yes to both" (phone: only the round + adds, its four
  // ways in ⋯; keep the row's dashed "+" add-to-group) → "this also should be
  // visible on desktop mode?" → yes.
  const ROWS = read('_components', 'guest-list-multiselect.tsx');
  const fn = (name: string) => ROWS.slice(ROWS.indexOf(`function ${name}(`), ROWS.indexOf('\nfunction ', ROWS.indexOf(`function ${name}(`) + 10));
  assert.match(fn('MobileListRow'), /<AddToGroupControl\b/, 'the phone row lost its dashed +');
  const desk = fn('DesktopRow');
  assert.match(desk, /\{!columns\.includes\('groups'\) && !guest\.passed_away \? \(\s*<span className="shrink-0" data-desk-add-to-group="">\s*<AddToGroupControl\b/, 'a computer row has no dashed + when the Groups column is not showing');
  // The four other ways are one tap from the + on both widths (the sheet) and in ⋯.
  const capture = read('_components', 'capture-bar.tsx');
  assert.match(read('_components', 'add-guest-sheet.tsx'), /\{doors\}/, 'the add sheet dropped the other ways in');
  const doors = capture.slice(capture.indexOf('export function AddDoors'));
  assert.equal((doors.match(/<OpenAddFromPeopleButton|<OpenQuickAddButton|\/guests\/import`|\/guests\/quick`/g) ?? []).length, 4, 'not all four add ways are offered');
});
