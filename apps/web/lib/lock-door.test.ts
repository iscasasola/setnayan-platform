/**
 * THE LOCK DOOR OPENS ON THE PAGE THAT HOLDS THE LOCK — executed, not grepped.
 *
 * ── WHAT THIS EXISTS TO CATCH (AREA-CHAT, 2026-09-19) ────────────────────────
 * Two "ask them to lock" links pointed at the shop's workspace page, which has
 * no Lock control; after #5614 that page bounced a bare landing back to the
 * conversation, so the couple's ONE booking action reloaded the quote card.
 * The rule is now a function, so a wrong destination is a red test rather than
 * a loop somebody has to notice on a phone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { coupleLockDoorHref } from './lock-door';
import { tileForCategory } from './shortlist-taxonomy';
import { VENDOR_CATEGORIES } from './vendors';

const EVENT = '2d4f1144-7816-4367-9c99-6ff0f9a6de10';
const BENCH = `/dashboard/${EVENT}/vendors`;

test('a known category opens the bench on that category’s own tile', () => {
  // The live test pick: Rosa & Ben × Saysay is stored as `band_dj`.
  const tile = tileForCategory('band_dj');
  assert.ok(tile, 'band_dj no longer maps to a tile — the fixture is stale, not the rule');
  assert.equal(coupleLockDoorHref(EVENT, 'band_dj'), `${BENCH}?open=${encodeURIComponent(tile!)}`);
});

test('every enum category lands on the bench, and never on the workspace', () => {
  let opened = 0;
  for (const c of VENDOR_CATEGORIES) {
    const href = coupleLockDoorHref(EVENT, c);
    assert.ok(href.startsWith(BENCH), `${c} → ${href} leaves the Vendors page`);
    assert.doesNotMatch(href, /\/workspace/, `${c} → ${href} names the workspace, which holds no Lock`);
    if (href.includes('?open=')) opened += 1;
  }
  // The taxonomy claims every valid category maps; hold that claim as a floor
  // so a silent null in the bridge cannot turn every door into the bare bench.
  assert.ok(opened >= VENDOR_CATEGORIES.length - 2, `only ${opened} of ${VENDOR_CATEGORIES.length} categories open a tile`);
});

test('an unplaceable or missing category still lands on the bench — never nowhere', () => {
  assert.equal(coupleLockDoorHref(EVENT, null), BENCH);
  assert.equal(coupleLockDoorHref(EVENT, 'not-a-category'), BENCH);
});
