/**
 * A FOLLOW-UP LINE IS NEVER PRICED, NEVER CASCADED, NEVER OFFERED AS AN ADD-ON.
 *
 * A follow-up (`parent_option_id != null`, migration 20271012816361) is shown
 * to the couple only once one specific option is picked on another line. It is
 * CONDITIONAL by definition, so it can never sit inside
 * `total_price_centavos` — doing so would charge every couple for a line most
 * of them are never shown, inflate the booking fee computed off that total, and
 * cascade an `event_vendors` row at lock for a service nobody chose.
 *
 * ── THREE LAYERS, TESTED SEPARATELY ─────────────────────────────────────────
 *   BRACE  the database: `vendor_package_items_followup_not_default_included_ck`
 *          (migration 20271015207377) forces every follow-up to
 *          `is_default_included = FALSE` and `is_required = FALSE`. Proved in
 *          tests/db/package-option-branching.db.test.ts.
 *   BELT   `keptItems` drops follow-ups explicitly — this file. It matters
 *          because `keptItems` is also handed objects built IN MEMORY (the
 *          customization modal, the credit adapter, every test), where no
 *          constraint applies. So the belt is asserted against exactly the
 *          shape the database refuses.
 *   SPELL  the authoring validator turns the 23514 into a sentence — proved in
 *          package-authoring.test.ts.
 *
 * Plus: the surfaces that LIST non-included lines as add-ons must not offer a
 * follow-up as something the couple can simply take. Because the brace makes
 * every follow-up `is_default_included = FALSE`, "not included ⇒ add-on" is
 * precisely the reasoning that would leak them.
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  chosenOptionsSurchargeCentavos,
  computeCustomization,
  keptItems,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';

type Over = Partial<VendorPackageItemRow> & { item_id: string };

function item(over: Over): VendorPackageItemRow {
  return {
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${over.item_id}`,
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 1_000_00,
    display_order: 0,
    created_at: '2027-01-01T00:00:00Z',
    ...over,
  };
}

function pkg(
  items: VendorPackageItemRow[],
  over: Partial<VendorPackageWithItems> = {},
): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'V',
    package_name: 'Branching package',
    total_price_centavos: 10_000_00,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    is_active: true,
    items,
    ...over,
  } as VendorPackageWithItems;
}

/**
 * The shape the DATABASE refuses. Built here on purpose: the belt has to hold
 * without the brace, because `keptItems` also sees in-memory objects.
 */
const illegalFollowUp = item({
  item_id: 'followup',
  service_description: 'Which style of lechon?',
  parent_option_id: 'opt-lechon',
  is_default_included: true,
  replacement_value_centavos: 3_000_00,
});

/** The legal shape, i.e. what actually comes back from the database. */
const legalFollowUp = item({
  item_id: 'followup',
  service_description: 'Which style of lechon?',
  parent_option_id: 'opt-lechon',
  is_default_included: false,
  replacement_value_centavos: 3_000_00,
});

/* ──────────────────────────────────────────────────────────────────────────
 * keptItems — the line that would have cascaded the row
 * ────────────────────────────────────────────────────────────────────────── */

test('keptItems drops a follow-up even when it claims to be default-included', () => {
  // 💰 THE CASCADE. Everything keptItems returns becomes an event_vendors row
  // on lock. A follow-up in here is a booked vendor the couple never picked.
  const kept = keptItems(pkg([item({ item_id: 'base' }), illegalFollowUp]), []);
  assert.deepEqual(
    kept.map((i) => i.item_id),
    ['base'],
  );
});

test('keptItems drops a follow-up that is ALSO marked required', () => {
  // `is_required` short-circuits the removal check, so it is the shape most
  // likely to slip past a guard written in the wrong order. The follow-up test
  // sits ABOVE it, so it cannot.
  const kept = keptItems(
    pkg([
      item({ item_id: 'base' }),
      item({
        item_id: 'followup',
        parent_option_id: 'opt-lechon',
        is_default_included: true,
        is_required: true,
      }),
    ]),
    [],
  );
  assert.deepEqual(
    kept.map((i) => i.item_id),
    ['base'],
  );
});

test('keptItems drops a follow-up in its legal database shape too', () => {
  const kept = keptItems(pkg([item({ item_id: 'base' }), legalFollowUp]), []);
  assert.deepEqual(
    kept.map((i) => i.item_id),
    ['base'],
  );
});

test('keptItems still keeps normal lines — required, included, and unremoved', () => {
  // Regression: the follow-up rule must not change what a package without
  // follow-ups does. Every shape that ships today, in one assertion.
  const kept = keptItems(
    pkg([
      item({ item_id: 'plain' }),
      item({ item_id: 'required', is_required: true }),
      item({ item_id: 'dropped' }),
      item({ item_id: 'addon', is_default_included: false }),
    ]),
    ['dropped', 'required'],
  );
  assert.deepEqual(
    kept.map((i) => i.item_id),
    ['plain', 'required'],
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * computeCustomization — a follow-up moves no money, in either direction
 * ────────────────────────────────────────────────────────────────────────── */

test('a follow-up contributes nothing to the locked total or the refund', () => {
  const withFollowUp = computeCustomization(
    pkg([item({ item_id: 'base' }), legalFollowUp]),
    [],
  );
  const without = computeCustomization(pkg([item({ item_id: 'base' })]), []);
  assert.deepEqual(withFollowUp, without);
  assert.equal(withFollowUp.totalLockedCentavos, 10_000_00);
  assert.equal(withFollowUp.removedTotalCentavos, 0);
});

test('"removing" a follow-up refunds nothing — it was never charged', () => {
  // The couple cannot untick what they were never shown, but a stale or
  // hand-rolled client can still send the id. It must move no money.
  const { removedTotalCentavos, totalLockedCentavos } = computeCustomization(
    pkg([item({ item_id: 'base' }), legalFollowUp]),
    ['followup'],
  );
  assert.equal(removedTotalCentavos, 0);
  assert.equal(totalLockedCentavos, 10_000_00);
});

test('"removing" a follow-up grows no consumable pool on a flexible package', () => {
  // The flexible branch is the one that hands the freed value back as spendable
  // credit, so it is the more expensive way to get this wrong.
  const { remainingConsumableCentavos } = computeCustomization(
    pkg([item({ item_id: 'base' }), legalFollowUp], {
      is_consumable_flexible: true,
      consumable_budget_centavos: 500_00,
    }),
    ['followup'],
  );
  assert.equal(remainingConsumableCentavos, 500_00);
});

test('a follow-up’s own upgrade adds nothing to the surcharge while unpicked', () => {
  const p = pkg([
    item({ item_id: 'base' }),
    {
      ...legalFollowUp,
      options: [
        {
          option_id: 'crispy',
          item_id: 'followup',
          option_label: 'Crispy',
          price_delta_centavos: 0,
          is_default: true,
          is_available: true,
          display_order: 0,
        },
        {
          option_id: 'boneless',
          item_id: 'followup',
          option_label: 'Boneless',
          price_delta_centavos: 2_000_00,
          is_default: false,
          is_available: true,
          display_order: 1,
        },
      ],
    },
  ]);
  assert.equal(chosenOptionsSurchargeCentavos(p, [], ['boneless']), 0);
});

/* ──────────────────────────────────────────────────────────────────────────
 * The add-on listing surfaces
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * These are React Server Components — there is no pure function to call, so the
 * guard is pinned at the source. A weak test for a strong reason: deleting one
 * of these filters is silent, reachable, and turns "which style of lechon?"
 * into a line the couple is offered on its own.
 */
const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the vendor workspace add-on list excludes follow-ups', () => {
  // This surface labels every non-included line "(optional add-on)". Because
  // the DB forces follow-ups to not-included, they would ALL land in that
  // bucket without the filter.
  const src = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(src, /parent_option_id == null/);
  assert.match(src, /select\(\s*'[^']*parent_option_id/);
});

test('the booked-package detail list excludes follow-ups', () => {
  // This one splits on `removed_item_ids` alone and never consults
  // is_default_included, so a follow-up would print under "Included in this
  // booking" — a receipt for something nobody bought.
  const src = read('app/dashboard/[eventId]/vendors/packages/[bookingId]/page.tsx');
  assert.match(src, /parent_option_id == null/);
  assert.match(src, /parent_option_id'/);
});

test('the lock modal still lists ONLY default-included lines', () => {
  // Its existing add-on guard doubles as the follow-up guard: filtering TO
  // included is what keeps a follow-up off a list the couple can tick. Widening
  // it to add-ons would surface every follow-up at once, detached from the
  // question that reveals it.
  const src = read('app/_components/vendor-packages/lock-modal.tsx');
  assert.match(src, /\.filter\(\(i\) => i\.is_default_included\)/);
});
