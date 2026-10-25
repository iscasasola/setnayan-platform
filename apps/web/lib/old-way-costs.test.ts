/**
 * old-way-costs.test.ts — every old-way figure the questionnaire shows has a source and a read date.
 *
 * `lib/old-way-costs.ts` holds what doing it the old way costs (printing it yourself, keeping the list by hand) — FACTS
 * ABOUT PRINTING AND TIME, never about another event company (owner 2026-10-25: "I was told never to compare so i do
 * not look cheap"). A figure the page shows with nothing behind it is the exact claim this file exists to refuse.
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · blank the place card's source                      → RED (no https source)
 *   · set the welcome sign's readOn to "Oct 2026"        → RED (not a date)
 *   · count the invitations per guest instead of per household → RED (the arithmetic)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OLD_WAY, oldWayMoney, householdsFor, tablesFor } from './old-way-costs';

test('every old-way figure has an https source and the day it was read', () => {
  const entries = Object.entries(OLD_WAY);
  assert.ok(entries.length >= 5, `only ${entries.length} figures — did the module move?`);
  for (const [k, f] of entries) {
    assert.ok(f.value > 0, `${k} has no figure`);
    assert.match(f.source, /^https:\/\/[^\s]+\.[a-z]{2,}\//, `${k} has no https source`);
    assert.match(f.readOn, /^\d{4}-\d{2}-\d{2}$/, `${k} has no read date`);
    assert.ok(f.what.trim().length > 8, `${k} does not say what it is`);
  }
});

test('the four the owner was shown — Paperbug ₱89 invitation, Feliz Studio place card · table number · welcome sign, 9 hours', () => {
  assert.equal(OLD_WAY.printedInvitation.value, 89);
  assert.match(OLD_WAY.printedInvitation.source, /paperbug\.com\.ph/);
  assert.equal(OLD_WAY.placeCard.value, 10);
  assert.equal(OLD_WAY.tableNumber.value, 20);
  assert.equal(OLD_WAY.welcomeSign.value, 1100);
  for (const f of [OLD_WAY.placeCard, OLD_WAY.tableNumber, OLD_WAY.welcomeSign]) assert.match(f.source, /felizstudio\.ph/);
  assert.equal(OLD_WAY.guestListHours.value, 9);
  assert.equal(OLD_WAY.guestListHours.unit, 'hours');
  assert.match(OLD_WAY.guestListHours.source, /bravotv\.com/);
  for (const f of Object.values(OLD_WAY)) assert.equal(f.readOn, '2026-10-25');
});

test('money kept counts invitations per household, and prints only when asked', () => {
  assert.equal(householdsFor(151), 76);
  assert.equal(tablesFor(151), 16);
  assert.equal(oldWayMoney({ guests: 100, wantsGuestList: false, wantsOnlineReplies: false, wantsPrintables: false }).total, 0);
  assert.equal(oldWayMoney({ guests: 100, wantsGuestList: true, wantsOnlineReplies: false, wantsPrintables: false }).total, 50 * 89);
  assert.equal(
    oldWayMoney({ guests: 100, wantsGuestList: false, wantsOnlineReplies: true, wantsPrintables: true }).total,
    50 * 89 + 100 * 10 + 10 * 20 + 1100,
  );
});
