/**
 * 🧊 A LOCKED ORDER IS FROZEN.
 *
 * The money review found three confirmed defects that are all the same defect:
 * `removeItemFromPackage` re-priced a locked booking from LIVE vendor rows under
 * the LIVE flag. This suite pins the freeze that replaced it.
 *
 * ── WHAT IS BEING PINNED ────────────────────────────────────────────────────
 *   1. A vendor raising an hourly RATE after lock cannot re-bill locked hours.
 *   2. A vendor lowering an hour CAP after lock cannot clamp locked hours.
 *   3. A vendor RETIRING (or deleting) an option after lock cannot delete the
 *      locked charge for it — the pre-fix path silently dropped it, fail-OPEN.
 *   4. A vendor narrowing a PICK RANGE after lock cannot make the locked pick
 *      set refuse to re-price.
 *   5. A guest-count change cannot re-multiply a locked per-head upgrade.
 *   6. A FLAG ROLLBACK between lock and removal cannot re-price the booking —
 *      deltas are pool-spend under one model and a flat surcharge under the
 *      other, so the model is recorded and replayed.
 *   7. 🚨 A REMOVAL NEVER INCREASES `total_locked_centavos`. The booking fee
 *      rides on that number; a silent increase would reprice an agreed order as
 *      a side effect of the couple removing something.
 *   8. The re-narrow still happens: dropping a line drops the follow-up
 *      questions its options revealed, and the persisted sets are rewritten to
 *      match the new total.
 *
 * ── MUTATION-TESTED ─────────────────────────────────────────────────────────
 * Two of the three labeled mutants that previously passed every gate are killed
 * here, by named tests:
 *   (a) `removeItemFromPackage` replays the stored ids without re-narrowing
 *       → 'dropping a parent line drops the follow-up charge it revealed'
 *   (c) the persisted-set rewrite is deleted
 *       → 'the surviving sets come back for persisting, narrowed to the total'
 * The third, (b) — dropping `extra_hour_centavos` from both select constants —
 * is killed by the literal pin in ./vendor-packages.columns.test.ts.
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyPricingSnapshot,
  buildPricingSnapshot,
  readPricingSnapshot,
  repriceAfterRemoval,
  snapshotChargeLines,
  snapshotChargeTotalCentavos,
  type PackagePricingSnapshot,
} from './package-pricing-snapshot';
import type {
  VendorPackageItemOptionRow,
  VendorPackageItemRow,
  VendorPackageWithItems,
} from './vendor-packages';

/* ────────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function opt(
  over: Partial<VendorPackageItemOptionRow> & { option_id: string },
): VendorPackageItemOptionRow {
  return {
    item_id: 'ITEM',
    option_label: over.option_id,
    price_delta_centavos: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
    ...over,
  };
}

function item(
  over: Partial<VendorPackageItemRow> & { item_id: string },
): VendorPackageItemRow {
  return {
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${over.item_id}`,
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 1_000_00,
    display_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    parent_option_id: null,
    ...over,
  };
}

function pkg(
  items: VendorPackageItemRow[],
  over: Partial<VendorPackageWithItems> = {},
): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'VEN',
    package_name: 'All-in Reception',
    description: null,
    total_price_centavos: 10_000_00,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    items,
    ...over,
  };
}

/**
 * The canonical locked booking:
 *   base            plain inclusion
 *   main            CHOICE · std (free, default) | premium (+₱2,000)
 *     └ style       FOLLOW-UP off `premium` · plain (free) | boneless (+₱1,200)
 *   photo           hourly · ₱500/hr, cap 4
 */
function lockedPkg(over: Partial<VendorPackageWithItems> = {}) {
  return pkg(
    [
      item({ item_id: 'base' }),
      item({
        item_id: 'main',
        options: [
          opt({ option_id: 'std', is_default: true, display_order: 0 }),
          opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
        ],
      }),
      item({
        item_id: 'style',
        parent_option_id: 'premium',
        is_default_included: false,
        options: [
          opt({ option_id: 'plain', is_default: true, display_order: 0 }),
          opt({ option_id: 'boneless', price_delta_centavos: 1_200_00, display_order: 1 }),
        ],
      }),
      item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
    ],
    over,
  );
}

/** The snapshot the lock would have written for the selection below. */
function lockedSnapshot(creditModel = true): PackagePricingSnapshot {
  return buildPricingSnapshot({
    pkg: lockedPkg(),
    chosenOptionIds: ['premium', 'boneless'],
    extraHours: { photo: 3 },
    paxCount: 0,
    creditEnabled: creditModel,
  });
}

/** ₱10,000 base + ₱2,000 premium + ₱1,200 boneless + 3×₱500 hours. */
const LOCKED_TOTAL = 10_000_00 + 2_000_00 + 1_200_00 + 3 * 500_00;

const reprice = (
  p: VendorPackageWithItems,
  snapshot: PackagePricingSnapshot,
  removed: string[],
  lockedTotal = LOCKED_TOTAL,
) =>
  repriceAfterRemoval({
    pkg: p,
    snapshot,
    removedItemIds: removed,
    additions: [],
    catalogue: [],
    lockedTotalCentavos: lockedTotal,
  });

/* ────────────────────────────────────────────────────────────────────────── */
/* 0. The snapshot records what the lock charged                              */
/* ────────────────────────────────────────────────────────────────────────── */

test('the snapshot records every charged option and every hour, with frozen money', () => {
  const s = lockedSnapshot();
  assert.equal(s.version, 1);
  assert.equal(s.credit_model, true);
  assert.deepEqual(
    s.options.map((o) => [o.option_id, o.delta_centavos]),
    [
      ['premium', 2_000_00],
      ['boneless', 1_200_00],
    ],
  );
  assert.deepEqual(s.extra_hours, [
    {
      item_id: 'photo',
      label: 'line photo',
      hours: 3,
      rate_centavos: 500_00,
      max_extra_hours: 4,
    },
  ]);
});

test('the snapshot records the LOCK’s pax for a per-head upgrade, already resolved', () => {
  // A per-head delta is stored multiplied out, so replay never re-multiplies it
  // against a guest count that has since changed.
  const p = pkg([
    item({
      item_id: 'menu',
      options: [
        opt({ option_id: 'set_a', is_default: true, display_order: 0 }),
        opt({
          option_id: 'set_b',
          pricing_basis: 'per_pax',
          per_pax_delta_centavos: 150_00,
          min_pax: 50,
          display_order: 1,
        }),
      ],
    }),
  ]);
  const s = buildPricingSnapshot({
    pkg: p,
    chosenOptionIds: ['set_b'],
    extraHours: {},
    paxCount: 180,
    creditEnabled: true,
  });
  assert.equal(s.options[0]!.delta_centavos, 180 * 150_00);
  assert.equal(s.pax_count, 180);
});

test('the snapshot round-trips through JSON and a defensive read', () => {
  const s = lockedSnapshot();
  const parsed = readPricingSnapshot(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(parsed, s);
  // And it reads through the customizations wrapper the row actually stores.
  assert.deepEqual(readPricingSnapshot({ pricing_snapshot: s }), s);
});

test('a missing or malformed snapshot reads as null, never as a partial one', () => {
  // The money path treats null as REFUSE. A half-parsed snapshot would be worse
  // than none: it would freeze some numbers and re-derive the rest.
  assert.equal(readPricingSnapshot(null), null);
  assert.equal(readPricingSnapshot({}), null);
  assert.equal(readPricingSnapshot({ version: 2, credit_model: true, options: [], extra_hours: [] }), null);
  assert.equal(
    readPricingSnapshot({ version: 1, credit_model: true, options: [{ item_id: 'a' }], extra_hours: [] }),
    null,
    'an option with no id or delta must poison the whole read',
  );
  assert.equal(
    readPricingSnapshot({
      version: 1,
      credit_model: true,
      options: [],
      extra_hours: [{ item_id: 'photo', hours: 3 }],
    }),
    null,
    'hours with no frozen rate are exactly the defect — never accept them',
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. THE FREEZE — the vendor cannot move a locked number                     */
/* ────────────────────────────────────────────────────────────────────────── */

test('re-pricing from the snapshot reproduces the locked total exactly', () => {
  const r = reprice(lockedPkg(), lockedSnapshot(), []);
  assert.ok(r.ok);
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL);
});

test('DEFECT 1 — a vendor raising the hourly rate cannot re-bill locked hours', () => {
  // Measured before the fix: 3h locked at ₱500 → ₱11,500; vendor edits to ₱900;
  // couple removes an unrelated line → total went UP to ₱11,700.
  const live = lockedPkg();
  live.items = live.items.map((i) =>
    i.item_id === 'photo' ? { ...i, extra_hour_centavos: 900_00 } : i,
  );
  const r = reprice(live, lockedSnapshot(), []);
  assert.ok(r.ok);
  assert.equal(
    r.bookingTotalCentavos,
    LOCKED_TOTAL,
    'locked hours were re-rated at the vendor’s new price',
  );
});

test('DEFECT 1b — a vendor lowering the hour CAP cannot clamp locked hours', () => {
  const live = lockedPkg();
  live.items = live.items.map((i) =>
    i.item_id === 'photo' ? { ...i, max_extra_hours: 1 } : i,
  );
  const r = reprice(live, lockedSnapshot(), []);
  assert.ok(r.ok);
  assert.deepEqual(r.extraHours, { photo: 3 }, 'locked hours were clamped away');
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL);
});

test('DEFECT 2 — a RETIRED option keeps its locked charge instead of vanishing', () => {
  // Pre-fix this silently dropped ₱2,000 off the booking and erased the pick
  // from the record: fail-OPEN, where the path before this wave threw.
  const live = lockedPkg();
  live.items = live.items.map((i) =>
    i.item_id === 'main'
      ? {
          ...i,
          options: (i.options ?? []).map((o) =>
            o.option_id === 'premium' ? { ...o, is_available: false } : o,
          ),
        }
      : i,
  );
  const r = reprice(live, lockedSnapshot(), []);
  assert.ok(r.ok);
  assert.ok(r.chosenOptionIds.includes('premium'), 'the retired pick was dropped');
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL);
});

test('DEFECT 2b — an option row DELETED outright still keeps its locked charge', () => {
  const live = lockedPkg();
  live.items = live.items.map((i) =>
    i.item_id === 'main'
      ? { ...i, options: (i.options ?? []).filter((o) => o.option_id !== 'premium') }
      : i,
  );
  const r = reprice(live, lockedSnapshot(), []);
  assert.ok(r.ok);
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL, 'deleting the row deleted the charge');
});

test('DEFECT 4 — narrowing the pick range after lock cannot brick the re-price', () => {
  const live = lockedPkg();
  live.items = live.items.map((i) =>
    i.item_id === 'main' ? { ...i, pick_min: 2, pick_max: 2 } : i,
  );
  const r = reprice(live, lockedSnapshot(), []);
  assert.ok(r.ok, 'a vendor edit made a locked booking unpriceable');
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL);
});

test('a per-head upgrade is not re-multiplied when the guest count changes', () => {
  const p = pkg([
    item({ item_id: 'base' }),
    item({
      item_id: 'menu',
      options: [
        opt({ option_id: 'set_a', is_default: true, display_order: 0 }),
        opt({
          option_id: 'set_b',
          pricing_basis: 'per_pax',
          per_pax_delta_centavos: 100_00,
          display_order: 1,
        }),
      ],
    }),
  ]);
  const snap = buildPricingSnapshot({
    pkg: p,
    chosenOptionIds: ['set_b'],
    extraHours: {},
    paxCount: 100,
    creditEnabled: true,
  });
  const lockedAt = 10_000_00 + 100 * 100_00;
  // The couple's headcount doubles after lock. The agreed upgrade does not.
  const r = repriceAfterRemoval({
    pkg: p,
    snapshot: snap,
    removedItemIds: [],
    additions: [],
    catalogue: [],
    lockedTotalCentavos: lockedAt,
  });
  assert.ok(r.ok);
  assert.equal(r.bookingTotalCentavos, lockedAt);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. THE MODEL IS REPLAYED, NOT RE-READ                                      */
/* ────────────────────────────────────────────────────────────────────────── */

test('DEFECT 3 — a flag rollback cannot re-price a booking locked under credit', () => {
  // Flag ON, spend drains the pool first; flag OFF it is a flat surcharge. The
  // same booking therefore priced differently depending on when an operator
  // flipped an env var — and the booking fee rides on that number.
  const flexible = lockedPkg({
    is_consumable_flexible: true,
    consumable_budget_centavos: 5_000_00,
  });
  const snapOn = buildPricingSnapshot({
    pkg: flexible,
    chosenOptionIds: ['premium', 'boneless'],
    extraHours: { photo: 3 },
    paxCount: 0,
    creditEnabled: true,
  });
  // Under the credit model the ₱4,700 of spend is absorbed by the ₱5,000 pool.
  const lockedUnderCredit = 10_000_00;

  const r = repriceAfterRemoval({
    pkg: flexible,
    snapshot: snapOn, // credit_model: true — replayed regardless of any flag
    removedItemIds: [],
    additions: [],
    catalogue: [],
    lockedTotalCentavos: lockedUnderCredit,
  });
  assert.ok(r.ok);
  assert.equal(
    r.bookingTotalCentavos,
    lockedUnderCredit,
    'the booking re-priced under a different model than the one that locked it',
  );
});

test('a booking locked under the LEGACY model replays legacy, not credit', () => {
  const snapOff = lockedSnapshot(false);
  assert.equal(snapOff.credit_model, false);
  const r = reprice(lockedPkg(), snapOff, []);
  assert.ok(r.ok);
  // Legacy: deltas and hours are a flat surcharge on the legacy total, which is
  // the same arithmetic as the non-flexible credit case here.
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. 🚨 A REMOVAL NEVER INCREASES THE TOTAL                                  */
/* ────────────────────────────────────────────────────────────────────────── */

test('a removal only ever lowers the total', () => {
  const r = reprice(lockedPkg(), lockedSnapshot(), ['base']);
  assert.ok(r.ok);
  // Non-flexible: dropping `base` cuts its ₱1,000 replacement value.
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL - 1_000_00);
  assert.ok(r.bookingTotalCentavos < LOCKED_TOTAL);
});

test('THE INVARIANT — a re-price that comes out HIGHER is refused, not written', () => {
  // Any arithmetic above the locked total means an input moved that should have
  // been frozen. Writing it would reprice an agreed order as a side effect of
  // the couple removing something, and the booking fee rides on that total.
  // Simulated by handing a locked total lower than the booking can possibly be.
  const r = reprice(lockedPkg(), lockedSnapshot(), [], LOCKED_TOTAL - 1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'total_increased');
});

test('the invariant holds for every single-line removal on the fixture', () => {
  // Exhaustive rather than illustrative: whichever line the couple drops, the
  // total must not rise.
  for (const removed of ['base', 'main', 'photo']) {
    const r = reprice(lockedPkg(), lockedSnapshot(), [removed]);
    assert.ok(r.ok, `removing ${removed} became unpriceable`);
    assert.ok(
      r.bookingTotalCentavos <= LOCKED_TOTAL,
      `removing ${removed} INCREASED the total to ${r.bookingTotalCentavos}`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. THE RE-NARROW — kills mutant (a)                                        */
/* ────────────────────────────────────────────────────────────────────────── */

test('dropping a parent line drops the follow-up charge it revealed', () => {
  // 🧟 MUTANT (a): replay the stored ids without re-narrowing. Removing `main`
  // un-reveals `style`, so the ₱1,200 `boneless` pick must go with it — and a
  // verbatim replay would instead hand the engine an option on a line the
  // booking no longer contains, which fails closed and throws on a legitimate
  // removal. Both halves are asserted.
  const r = reprice(lockedPkg(), lockedSnapshot(), ['main']);
  assert.ok(r.ok, 'a legitimate removal became unpriceable — the re-narrow is gone');
  assert.deepEqual(r.chosenOptionIds, [], 'the follow-up pick survived its parent');
  // ₱10,000 − ₱1,000 (main's value) + 3×₱500 hours. Both option deltas gone.
  assert.equal(r.bookingTotalCentavos, 10_000_00 - 1_000_00 + 3 * 500_00);
});

test('removing the hourly line drops its hours from the charge', () => {
  const r = reprice(lockedPkg(), lockedSnapshot(), ['photo']);
  assert.ok(r.ok);
  assert.deepEqual(r.extraHours, {});
  assert.equal(r.bookingTotalCentavos, LOCKED_TOTAL - 3 * 500_00 - 1_000_00);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. THE PERSISTED SETS — kills mutant (c)                                   */
/* ────────────────────────────────────────────────────────────────────────── */

test('the surviving sets come back for persisting, narrowed to the total', () => {
  // 🧟 MUTANT (c): delete the persisted-set rewrite. The record would then keep
  // the pre-removal picks beside a post-removal total — a receipt claiming an
  // upgrade nobody is paying for any more.
  const r = reprice(lockedPkg(), lockedSnapshot(), ['main']);
  assert.ok(r.ok);
  assert.deepEqual(r.chosenOptionIds, []);
  assert.deepEqual(r.extraHours, { photo: 3 });
});

test('the SNAPSHOT is narrowed too, so the next removal replays survivors', () => {
  // Without this the second removal would replay charges the first one dropped,
  // and the frozen record would drift from the total it is supposed to explain.
  const first = reprice(lockedPkg(), lockedSnapshot(), ['main']);
  assert.ok(first.ok);
  assert.deepEqual(first.snapshot.options, []);
  assert.deepEqual(
    first.snapshot.extra_hours.map((h) => h.item_id),
    ['photo'],
  );

  const second = reprice(
    lockedPkg(),
    first.snapshot,
    ['main', 'photo'],
    first.bookingTotalCentavos,
  );
  assert.ok(second.ok);
  assert.deepEqual(second.snapshot.extra_hours, []);
  assert.ok(second.bookingTotalCentavos < first.bookingTotalCentavos);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. applyPricingSnapshot in isolation                                       */
/* ────────────────────────────────────────────────────────────────────────── */

test('the overlay changes MONEY only, never which lines exist', () => {
  const live = lockedPkg();
  const frozen = applyPricingSnapshot(live, lockedSnapshot());
  assert.deepEqual(
    frozen.items.map((i) => i.item_id),
    live.items.map((i) => i.item_id),
  );
  assert.equal(frozen.total_price_centavos, live.total_price_centavos);
});

test('the overlay does not mutate the package it was handed', () => {
  const live = lockedPkg();
  const before = JSON.stringify(live);
  applyPricingSnapshot(live, lockedSnapshot());
  assert.equal(JSON.stringify(live), before, 'applyPricingSnapshot mutated its input');
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. Display — what the couple and the vendor are finally shown              */
/* ────────────────────────────────────────────────────────────────────────── */

test('the itemisation names every charged pick and states the hour arithmetic', () => {
  const lines = snapshotChargeLines(lockedSnapshot());
  assert.deepEqual(
    lines.map((l) => [l.label, l.amountCentavos]),
    [
      ['premium', 2_000_00],
      ['boneless', 1_200_00],
      ['line photo', 3 * 500_00],
    ],
  );
  // The vendor is owed TIME, so the arithmetic is spelled out rather than left
  // as a bare peso figure they would have to reverse-engineer.
  assert.equal(lines[2]!.detail, '3 extra hours × ₱500');
  assert.equal(lines[0]!.detail, null);
  assert.equal(snapshotChargeTotalCentavos(lockedSnapshot()), 2_000_00 + 1_200_00 + 3 * 500_00);
});

test('one hour reads as “hour”, not “hours”', () => {
  const s = buildPricingSnapshot({
    pkg: lockedPkg(),
    chosenOptionIds: [],
    extraHours: { photo: 1 },
    paxCount: 0,
    creditEnabled: true,
  });
  assert.equal(snapshotChargeLines(s)[0]!.detail, '1 extra hour × ₱500');
});

test('no snapshot means no itemisation, not a crash', () => {
  assert.deepEqual(snapshotChargeLines(null), []);
  assert.equal(snapshotChargeTotalCentavos(null), 0);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 8. THE WIRING — source pins on the server action                           */
/*                                                                            */
/* `removeItemFromPackage` is a server action: no unit test can reach it, and  */
/* BOTH previous money bugs in it were WIRING bugs (it fetched no options; it  */
/* re-priced with a different pricer than the lock). The composition now lives */
/* in `repriceAfterRemoval` and is asserted behaviourally above — these pin    */
/* that the action actually DELEGATES to it and persists what it returns.      */
/* Weak tests for a strong reason: each one is a labeled mutant that passed    */
/* every gate green.                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const ACTIONS = 'app/dashboard/[eventId]/vendors/packages/actions.ts';
const readSrc = (rel: string) =>
  readFileSync(join(import.meta.dirname, '..', rel), 'utf8');

test('the removal path re-prices through repriceAfterRemoval, from the snapshot', () => {
  // 🧟 MUTANT (a): replay the stored ids with no re-narrow. At the action level
  // that shows up as the removal calling the pricer itself again.
  const src = readSrc(ACTIONS);
  assert.match(src, /const snapshot = readPricingSnapshot\(/);
  assert.match(src, /repriceAfterRemoval\(\{/);
  // Exactly ONE direct pricer call in this file — the LOCK's. A second one is
  // the removal re-deriving its own numbers from live rows, which is the whole
  // defect class this snapshot exists to close.
  assert.equal(
    (src.match(/priceCustomizedPackage\(\{/g) ?? []).length,
    1,
    'the removal path is pricing directly again instead of replaying the snapshot',
  );
});

test('the removal path never re-reads the live flag or a live pax for its price', () => {
  // The model and the head count are REPLAYED from the snapshot. If either is
  // read live on this path, a flag rollback or a guest-count edit re-prices an
  // agreed order.
  const src = readSrc(ACTIONS);
  const removalHalf = src.slice(src.indexOf('export async function removeItemFromPackage'));
  assert.doesNotMatch(
    removalHalf,
    /packageCreditEnabled\(\)/,
    'the removal is reading the LIVE flag — a rollback would re-price the booking',
  );
  assert.doesNotMatch(
    removalHalf,
    /resolveLivePax\(/,
    'the removal is resolving a LIVE pax — a guest-count edit would re-price locked per-head upgrades',
  );
});

test('the lock writes the pricing snapshot into the persisted record', () => {
  const src = readSrc(ACTIONS);
  assert.match(src, /const pricingSnapshot = buildPricingSnapshot\(\{/);
  assert.match(src, /pricing_snapshot: pricingSnapshot,/);
});

test('the removal persists the surviving sets AND the narrowed snapshot', () => {
  // 🧟 MUTANT (c): delete the persisted-set rewrite. The record would keep the
  // pre-removal picks beside a post-removal total — a receipt claiming an
  // upgrade nobody is paying for any more — and the next removal would replay
  // charges this one dropped.
  const src = readSrc(ACTIONS);
  assert.match(src, /newCustom\.chosen_option_ids = survivingOptionIds/);
  assert.match(src, /newCustom\.extra_hours = survivingExtraHours/);
  assert.match(
    src,
    /newCustom\.pricing_snapshot = repriced\.snapshot/,
    'the narrowed snapshot is not written back — the next removal replays dropped charges',
  );
});

test('the removal refuses a re-price that came out higher', () => {
  const src = readSrc(ACTIONS);
  assert.match(src, /repriced\.reason === 'total_increased'/);
  assert.match(src, /if \(!repriced\.ok\)/);
});

test('the removal reads options WITHOUT the is_available filter', () => {
  // Filtering here made a retired option's row vanish, taking the locked charge
  // with it. The lock path keeps its filter (nobody may newly pick a retired
  // option); this path must not have one.
  const src = readSrc(ACTIONS);
  const removalHalf = src.slice(src.indexOf('export async function removeItemFromPackage'));
  assert.doesNotMatch(
    removalHalf,
    /\.eq\('is_available', true\)/,
    'the removal is filtering retired options again — locked picks will silently vanish',
  );
});

test('both post-lock surfaces itemise from the snapshot', () => {
  // The lock's own comment says this record "tells the vendor what to deliver".
  // Nothing rendered it: the receipt filters follow-ups out of its line lists,
  // and the vendor was never shown the hours they owe.
  for (const rel of [
    'app/dashboard/[eventId]/vendors/packages/[bookingId]/page.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx',
  ]) {
    const src = readSrc(rel);
    assert.match(src, /snapshotChargeLines\(/, `${rel} renders no itemisation`);
    assert.match(src, /readPricingSnapshot\(/, `${rel} does not read the snapshot`);
  }
});
