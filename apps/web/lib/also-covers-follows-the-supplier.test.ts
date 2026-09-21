/**
 * A SUPPLIER'S "ALSO COVERS" FOLLOWS THEM — onto the bench, and into the build.
 *
 * Owner 2026-09-21: *"when we manual add a vendor on a category and add other
 * categories as well, it should auto populate to the other categories … our
 * goal is for that vendor to show on the other categories and they are
 * automatically linked everytime. even when they are making builds."*
 *
 * Before this, `event_vendors.covers_plan_groups` was saved and then read by
 * nothing the couple looks at: the bench placed a supplier in exactly ONE tile
 * (its own category), and the build's "Covered by" fired only when the other
 * category was completely EMPTY — shortlisting one other name there broke it.
 *
 * Executed, not grepped: both rules are pure builders, run here on fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShortlistFolders, linkedTilesForRow } from '@/lib/shortlist-taxonomy';
import { buildPlanBudgetModel } from '@/lib/vendors-plan-budget';

const BENCH = {
  eventType: 'wedding' as string,
  faithSet: new Set<string>(),
  eventId: 'e1',
};

/** The reception venue from the owner's screenshot: filed under Reception, also covers Catering + Cake. */
const VENUE = {
  vendor_id: 'v-venue',
  vendor_name: 'Seda Vertis North',
  category: 'venue',
  status: 'considering',
  total_cost_php: 250_000,
  covers_plan_groups: ['catering', 'cake', 'accommodation'],
};

function tilesHolding(folders: ReturnType<typeof buildShortlistFolders>, vendorId: string) {
  return folders.flatMap((f) =>
    f.tiles.flatMap((t) =>
      t.vendors.filter((v) => v.vendorId === vendorId).map((v) => ({ tile: t.tile as string, v })),
    ),
  );
}

test('linkedTilesForRow: every covered tile, in order, never the home tile, never twice', () => {
  assert.deepEqual(linkedTilesForRow(VENUE as never), ['catering', 'cake']);
  // Accommodation bridges to the `reception` tile — the venue's OWN tile — so
  // it is already there and must not be listed as a second placement.
  assert.ok(!linkedTilesForRow(VENUE as never).includes('reception' as never));
  // A budget-cost row carries its OWN group (budget/cost-actions.ts).
  assert.deepEqual(
    linkedTilesForRow({ category: 'catering', covers_plan_groups: ['catering'] } as never),
    [],
  );
  // A stale id places nothing rather than landing on a guessed tile.
  assert.deepEqual(
    linkedTilesForRow({ category: 'venue', covers_plan_groups: ['not_a_group'] } as never),
    [],
  );
  assert.deepEqual(linkedTilesForRow({ category: 'venue', covers_plan_groups: null } as never), []);
});

test('the bench shows the supplier in every category they cover — with no second price', () => {
  const folders = buildShortlistFolders({ ...BENCH, vendorRows: [VENUE] as never });
  const placed = tilesHolding(folders, VENUE.vendor_id);
  assert.deepEqual(
    placed.map((p) => p.tile).sort(),
    ['cake', 'catering', 'reception'],
    'the supplier did not follow their covers onto the bench',
  );

  const home = placed.find((p) => p.tile === 'reception')!.v;
  assert.equal(home.includedWith, null, 'the home card was marked as a copy');
  assert.equal(home.totalCostPhp, 250_000);

  for (const tile of ['catering', 'cake']) {
    const copy = placed.find((p) => p.tile === tile)!.v;
    assert.equal(copy.includedWith, 'Reception', `${tile}: copy does not say where it is included`);
    // One booking, one price — a copy that carried money would read as a second bill.
    assert.equal(copy.totalCostPhp, null, `${tile}: the copy carries a price`);
    assert.equal(copy.priceBasisPhp, null, `${tile}: the copy carries a price basis`);
    assert.equal(copy.budgetFit, null, `${tile}: the copy carries a budget verdict`);
    // Acting on the copy acts on the one real booking.
    assert.equal(copy.vendorId, home.vendorId);
    assert.equal(copy.planGroupId, home.planGroupId);
    assert.equal(copy.href, home.href);
  }

  // Counts are suppliers, not cards.
  const total = folders.reduce((n, f) => n + f.pickCount, 0);
  assert.equal(total, 1, `one supplier was counted ${total} times`);
});

test('a category’s own candidates lead its rail; the linked copy follows them', () => {
  const caterer = {
    vendor_id: 'v-cater',
    vendor_name: 'Juan Carlo',
    category: 'catering',
    status: 'considering',
    total_cost_php: 90_000,
  };
  const folders = buildShortlistFolders({ ...BENCH, vendorRows: [VENUE, caterer] as never });
  const catering = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'catering')!;
  assert.deepEqual(
    catering.vendors.map((v) => v.vendorId),
    ['v-cater', 'v-venue'],
  );
});

test('a supplier filed under the covered category too appears there ONCE, as their own row', () => {
  const alsoFiledThere = { ...VENUE, vendor_id: 'v-venue', category: 'catering', covers_plan_groups: [] };
  const folders = buildShortlistFolders({
    ...BENCH,
    vendorRows: [VENUE, alsoFiledThere] as never,
  });
  const catering = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'catering')!;
  const here = catering.vendors.filter((v) => v.vendorId === 'v-venue');
  assert.equal(here.length, 1, 'the same supplier rendered twice in one rail');
  assert.equal(here[0]!.includedWith, null, 'the linked copy beat their own row');
});

// ── The build ────────────────────────────────────────────────────────────────

const MODEL_BASE = {
  estimatedBudgetCentavos: null,
  daysUntilWedding: null,
  ceremonyType: null,
  venueSetting: null,
};

/** How the vendors page hands a manual supplier's covers to the model. */
const LINKED = new Map([
  [VENUE.vendor_id, { linked_services: [{ label: 'Catering', groupId: 'catering' }] }],
]);

function cateringChild(args: {
  vendorRows: unknown[];
  buildPicksByGroup?: Map<string, string[]>;
}) {
  const model = buildPlanBudgetModel({
    ...MODEL_BASE,
    vendorRows: args.vendorRows as never,
    enrichmentByVendorId: LINKED as never,
    buildPicksByGroup: args.buildPicksByGroup,
  });
  return model.folders.flatMap((f) => f.children).find((c) => c.groupId === 'catering')!;
}

const CANDIDATE_CATERER = {
  vendor_id: 'v-cater',
  vendor_name: 'Juan Carlo',
  category: 'catering',
  status: 'considering',
  total_cost_php: 90_000,
};

test('in the build, the supplier covers the category — even with another name shortlisted there', () => {
  const child = cateringChild({
    vendorRows: [VENUE, CANDIDATE_CATERER],
    buildPicksByGroup: new Map([['reception_venue', [VENUE.vendor_id]]]),
  });
  assert.ok(child.picks.length > 0, 'fixture: catering has a candidate of its own');
  assert.deepEqual(
    child.coveredBy,
    { vendorName: 'Seda Vertis North', fromGroupLabel: 'Reception venue', locked: false },
    'shortlisting one caterer broke the link — the 2026-06-12 "EMPTY only" rule is back',
  );
});

test('the category’s OWN build pick outranks the package that covers it', () => {
  const child = cateringChild({
    vendorRows: [VENUE, CANDIDATE_CATERER],
    buildPicksByGroup: new Map([
      ['reception_venue', [VENUE.vendor_id]],
      ['catering', ['v-cater']],
    ]),
  });
  assert.equal(child.coveredBy, null);
});

test('a supplier merely considered covers nothing in the build; a locked one says so', () => {
  assert.equal(cateringChild({ vendorRows: [VENUE] }).coveredBy, null);
  const locked = cateringChild({ vendorRows: [{ ...VENUE, status: 'contracted' }] });
  assert.equal(locked.coveredBy?.locked, true);
});
