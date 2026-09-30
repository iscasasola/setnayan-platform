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
  assert.equal((PAGE.match(/<RosterTabs\b/g) ?? []).length, 1, 'a second, drifting copy of the doors row');
  for (const slot of ['{sort}', '{doors}', '{addDoors}']) assert.ok(MENU.includes(slot), `the ⋯ sheet dropped ${slot}`);
  assert.match(MENU, /className="lg:hidden" data-guests-phone-menu=""/);
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

test('one Filter ▾ on a phone over the SAME four dropdowns; the add box becomes the round +', () => {
  assert.match(ROW, /data-find-add-filter-toggle=""[^>]*lg:hidden/, 'the phone lost its one Filter ▾');
  assert.match(ROW, /className=\{`hidden lg:block \$\{open/, 'the add box is drawn on a phone again (frame 2: the round +)');
  assert.match(PAGE, /data-guests-add-fab=""/, 'the phone has no way to add a guest');
  const fab = PAGE.slice(PAGE.indexOf('data-guests-add-fab'), PAGE.indexOf('data-guests-add-fab') + 600);
  assert.match(fab, /<OpenQuickAddButton/, 'the round + no longer opens the quick-add sheet');
  assert.match(PAGE.slice(PAGE.indexOf('data-guests-add-fab') - 200, PAGE.indexOf('data-guests-add-fab')), /lg:hidden/);
});
