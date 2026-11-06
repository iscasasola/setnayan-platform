/**
 * moved-settings-forward.test.ts — A SETTING THAT MOVED HOME KEEPS ITS OLD ADDRESS WORKING.
 *
 * Owner 2026-10-26/27 ("each menu has their own settings"; settings per menu PLAN § 6 — "every old link/anchor
 * redirects to the new home"). Rows left Event Details for their menu's ⚙; their old `/details/field/<row>` address
 * is in digest emails, bookmarks and tours. Held:
 *   1 · every moved row's old address forwards (308, the middleware's one legacy map) to its new home, exactly;
 *   2 · the row is GONE from Event Details' editor map — an address cannot both forward and open;
 *   3 · the destination names a row Guests ⚙ really draws (`SETTINGS_ROWS`, `data-setup-row`);
 *   4 · a row that stayed is NOT forwarded.
 *
 * Sabotage (2026-10-27): `'list-closes'` dropped from `DETAILS_ROWS_MOVED_TO_GUESTS` → 1 red; `'reply-by'` put back
 * into `RECORD_ROW_EDITOR` → 2 red; a move to `row=closes` (no such row) → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyRedirectTarget, MOVED_SETTING_OLD_PATHS } from './legacy-redirects';
import { DETAILS_ROWS_MOVED_TO_GUESTS, DETAILS_ROWS_MOVED_TO_SUPPLIERS, SETTINGS_ROWS } from './event-settings-record';
import { RECORD_ROW_EDITOR } from './event-details-record';

const EID = 'S89E-ABCDEFGHIJ';

/** The full list, written out — the map and this test must agree. */
const MOVES: readonly (readonly [string, string])[] = [
  ['guests-get-in', 'get-in'],
  ['rsvp-questions', 'asks'],
  ['reply-by', 'reply-by'],
  ['list-closes', 'reply-by'],
];
/** Suppliers ⚙ (owner 2026-10-27, "SUPPLIERS GETS ITS ⚙"). */
const SUPPLIER_MOVES: readonly (readonly [string, string])[] = [['costs-view', 'costs-view']];

test('1 · every moved row forwards to its home, and the map holds no more and no fewer', () => {
  for (const [from, row] of MOVES) {
    assert.equal(
      legacyRedirectTarget(`/dashboard/${EID}/details/field/${from}`),
      `/dashboard/${EID}/guests?settings=1&row=${row}`,
      `/details/field/${from} does not land on Guests ⚙ › ${row}`,
    );
  }
  for (const [from, row] of SUPPLIER_MOVES) {
    assert.equal(
      legacyRedirectTarget(`/dashboard/${EID}/details/field/${from}`),
      `/dashboard/${EID}/vendors?settings=1&row=${row}`,
      `/details/field/${from} does not land on Suppliers ⚙ › ${row}`,
    );
  }
  assert.equal(MOVED_SETTING_OLD_PATHS.length, MOVES.length + SUPPLIER_MOVES.length, `the map forwards ${MOVED_SETTING_OLD_PATHS.length} moved rows, this list ${MOVES.length + SUPPLIER_MOVES.length}`);
});

test('2 · a moved row no longer opens on Event Details', () => {
  for (const from of [...Object.keys(DETAILS_ROWS_MOVED_TO_GUESTS), ...Object.keys(DETAILS_ROWS_MOVED_TO_SUPPLIERS)]) {
    assert.ok(!(from in RECORD_ROW_EDITOR), `Event Details still opens "${from}" — the setting lives in two places`);
  }
});

test('3 · every destination is a row its menu ⚙ draws', () => {
  for (const row of Object.values(DETAILS_ROWS_MOVED_TO_GUESTS)) {
    assert.ok(row in SETTINGS_ROWS, `row=${row} is not a settings row`);
    assert.equal(SETTINGS_ROWS[row].menu, 'guests', `row=${row} is not a Guests ⚙ row`);
  }
  for (const row of Object.values(DETAILS_ROWS_MOVED_TO_SUPPLIERS)) {
    assert.ok(row in SETTINGS_ROWS, `row=${row} is not a settings row`);
    assert.equal(SETTINGS_ROWS[row].menu, 'suppliers', `row=${row} is not a Suppliers ⚙ row`);
  }
});

test('4 · a row that stayed on Event Details is not forwarded', () => {
  for (const kept of ['names', 'date', 'venues', 'area']) {
    assert.ok(kept in RECORD_ROW_EDITOR, `"${kept}" left Event Details — re-read this check`);
    assert.equal(legacyRedirectTarget(`/dashboard/${EID}/details/field/${kept}`), null, `"${kept}" is forwarded but it stayed`);
  }
});
