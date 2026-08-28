/**
 * explore-shows-what-it-costs.test.ts — the marketplace grid shows a shop's
 * starting price, and the one shop that asked us not to is still covered.
 *
 * WHY THIS FILE EXISTS. The grid computed every visible shop's cheapest active
 * starting price and then threw it away for everyone but demo rows, citing a
 * hide-prices lock that had been **superseded on 2026-07-16** by an
 * opt-in-to-hide flag defaulting to SHOW — which the shop's own page has
 * honoured ever since, printing "from ₱X" on every service card. Owner,
 * 2026-08-28: *"their service cards has the prices."*
 *
 * 🔑 SO THE DANGEROUS DIRECTION IS NOT "no price" — IT IS SHOWING ONE THE SHOP
 * OPTED OUT OF. A shop that ticked *hide my prices* would have its prices
 * blanked on its own page and printed on the marketplace: a control honoured
 * only on the way in. That is the whole subject of this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  hidingSetFromAttributeRows,
  payloadHidesPricesPublicly,
} from '@/lib/vendor-service-attributes';

const WEB_ROOT = join(process.cwd(), process.cwd().endsWith('/apps/web') ? '' : 'apps/web');
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), 'utf8'));

// ── The rule itself ───────────────────────────────────────────────────────

test('only an explicit true hides — absent means show', () => {
  // Opt-in-to-HIDE. Every shop that never touched the box shows its prices,
  // which is today's behaviour and must stay it.
  assert.equal(payloadHidesPricesPublicly({ hide_prices_publicly: true }), true);
  assert.equal(payloadHidesPricesPublicly({ hide_prices_publicly: false }), false);
  assert.equal(payloadHidesPricesPublicly({}), false);
  assert.equal(payloadHidesPricesPublicly({ price_model: 'from' }), false);
});

test('a truthy-looking value that is not true does not hide', () => {
  // The form can only ever persist a real boolean or an absent key. Anything
  // else is corrupt data, and guessing from it would blank a shop's prices on
  // no evidence.
  for (const v of ['true', 1, 'yes', {}, []]) {
    assert.equal(
      payloadHidesPricesPublicly({ hide_prices_publicly: v }),
      false,
      `${JSON.stringify(v)} must not hide`,
    );
  }
});

test('an unreadable payload shows, never hides', () => {
  assert.equal(payloadHidesPricesPublicly(null), false);
  assert.equal(payloadHidesPricesPublicly(undefined), false);
  assert.equal(payloadHidesPricesPublicly('hide_prices_publicly'), false);
  assert.equal(payloadHidesPricesPublicly(42), false);
});

// ── One shop, many sections ───────────────────────────────────────────────

test('a shop is one business — one ticked section hides all of it', () => {
  const hiding = hidingSetFromAttributeRows([
    { vendor_profile_id: 'shop-a', attribute_payload: {} },
    { vendor_profile_id: 'shop-a', attribute_payload: { hide_prices_publicly: true } },
    { vendor_profile_id: 'shop-b', attribute_payload: { hide_prices_publicly: false } },
    { vendor_profile_id: 'shop-b', attribute_payload: {} },
  ]);
  assert.ok(hiding.has('shop-a'), 'one ticked section hides the whole shop');
  assert.ok(!hiding.has('shop-b'), 'a shop that never ticked it shows');
  assert.equal(hiding.size, 1);
});

test('no rows means nobody hides — the read failing must not blank the page', () => {
  // The batch read returns an empty set on any error, and this is what that
  // empty set means downstream: everybody shows, exactly as before.
  assert.equal(hidingSetFromAttributeRows([]).size, 0);
});

// ── The wiring ────────────────────────────────────────────────────────────

test('the grid reads the SAME rule the shop’s own page reads', () => {
  const lib = read('lib/vendor-service-attributes.ts');
  assert.match(lib, /export function payloadHidesPricesPublicly/);

  for (const rel of ['app/(shell)/explore/page.tsx', 'app/v/[slug]/page.tsx']) {
    const src = read(rel);
    assert.match(
      src,
      /from '@\/lib\/vendor-service-attributes'/,
      `${rel} must get the rule from the shared module`,
    );
  }
});

test('nobody re-implements the rule', () => {
  // A second copy of "does this shop hide its prices" is how a shop that opted
  // out ends up with its prices on the marketplace anyway.
  for (const rel of ['app/(shell)/explore/page.tsx', 'app/v/[slug]/page.tsx']) {
    assert.ok(
      !/hide_prices_publicly\s*===\s*true/.test(read(rel)),
      `${rel} re-implements the hide-prices test`,
    );
  }
});

test('the grid honours the opt-out before it shows any price', () => {
  const src = read('app/(shell)/explore/page.tsx');
  assert.match(src, /fetchVendorsHidingPricesPublicly\(/, 'the batch read must happen');
  assert.match(
    src,
    /!hidingPrices\.has\(v\.vendor_profile_id\)/,
    'and gate the price it puts on the card',
  );
});

test('the price is no longer gated on being a demo shop', () => {
  // The single line this whole change is: `is_demo === true && …` threw away a
  // figure the page had already computed for every visible shop.
  const src = read('app/(shell)/explore/page.tsx');
  assert.ok(
    !/v\.is_demo === true && svc\?\.startingPrice/.test(src),
    'a real shop’s price must not be gated on demo mode',
  );
  assert.match(src, /v\.starting_price_php =\s*svc\?\.startingPrice/);
});

test('the demo label path is untouched', () => {
  // Demo cards carry their own label and their own styling; this change was
  // never about them.
  const src = read('app/(shell)/explore/page.tsx');
  assert.match(src, /row\.demo_starts_at_label =/);
  const card = read('app/(shell)/explore/_components/vendor-card.tsx');
  assert.match(card, /isDemoCard && vendor\.demo_starts_at_label/);
});
