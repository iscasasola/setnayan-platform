/**
 * Coverage contract for the Shortlist's category → tile bridge
 * (`CATEGORY_TO_TILE` in lib/shortlist-taxonomy.ts).
 *
 * WHY this file exists: `buildShortlistFolders` does `if (!tile) continue;` —
 * a category with no tile means the couple's CONSIDERED vendor is dropped from
 * the Shortlist tab entirely, silently. Until 2026-07-21 the bridge's docstring
 * claimed to be "exhaustive over the enum" while missing the 14 non-wedding gap
 * leaves (tour_guide, referee_official, …), so a travel / tournament /
 * corporate / birthday / gender-reveal pick vanished. The contract asserted
 * here is ALL 45 enum values map — and the placements are locked so nobody
 * "simplifies" a tour guide onto a wedding tile.
 *
 * 2026-07-21 fix-forward: the bridge is BIDIRECTIONAL and the inverse
 * (`categoryForTile`) is a WRITE path — it decides what lands in
 * event_vendors.category, which the Budget tab's `bucketVendorsByGroup` and the
 * finalize gate's `planGroupForCategory` key on. #3466 fixed the forward
 * direction and broke the inverse. So this file now also asserts (a) every
 * tile's write-back is plan-group-bucketable, (b) the bucketer has a catch-all,
 * and (c) `buildShortlistFolders` itself — fed a REAL taxonomy snapshot, the
 * way production does — never drops a considered pick to a scope filter.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tileForCategory, categoryForTile, buildShortlistFolders } from './shortlist-taxonomy';
import { primaryTileForVendorCategory } from './vendor-category-taxonomy';
import { VENDOR_CATEGORIES, type VendorCategory } from './vendors';
import { bucketVendorsByGroup, planGroupForCategory } from './wedding-plan-groups';
import { pickTodaysOneThing, countUnlockedCategories } from './todays-one-thing';
import { fallbackSnapshot } from './taxonomy-snapshot';
import {
  TILE_PARENT,
  WEDDING_TILE_ORDER,
  WEDDING_FOLDER_ORDER,
  WEDDING_TILES_BY_PARENT,
  type WeddingFolder,
  type WeddingTile,
} from './taxonomy';

/** Same table shape as lib/taxonomy-gap-leaves.test.ts — the ADMIN-side proof
 *  that these 14 leaves live under non-wedding tier-1 families. Duplicated
 *  deliberately: this file locks the COUPLE-side bridge to those same families,
 *  so if the two ever disagree one of the two suites goes red. */
const GAP_LEAF_PARENT: Record<string, WeddingFolder> = {
  referee_official: 'logistics_safety',
  event_medic: 'logistics_safety',
  tour_activity: 'experience',
  tour_guide: 'experience',
  travel_insurance: 'insurance',
  av_production: 'program',
  speaker_talent: 'program',
  performers: 'program',
  kids_entertainer: 'program',
  choreographer: 'program',
  reveal_element: 'specialty',
  event_insurance: 'insurance',
  personal_accident_insurance: 'insurance',
  restaurant_reservation: 'dining',
};
const GAP_LEAVES = Object.keys(GAP_LEAF_PARENT) as WeddingTile[];

test('every VendorCategory bridges to a tile (no considered pick is ever dropped)', () => {
  assert.equal(
    VENDOR_CATEGORIES.length,
    45,
    'enum size changed — re-derive the contract before editing this number',
  );
  for (const c of VENDOR_CATEGORIES) {
    assert.ok(
      tileForCategory(c),
      `${c}: no tile — a considered pick under this category vanishes from the Shortlist`,
    );
  }
});

test('every bridged tile is a LIVE taxonomy tile', () => {
  // Types alone can't catch a tile that was renamed or deleted out of the tree;
  // this is the same runtime intent as validateVendorCategoryMapping().
  for (const c of VENDOR_CATEGORIES) {
    const tile = tileForCategory(c);
    assert.ok(
      tile && WEDDING_TILE_ORDER.includes(tile),
      `${c} → ${tile}: not in WEDDING_TILE_ORDER`,
    );
  }
});

test('the 14 non-wedding gap leaves land on their OWN tile, under a non-wedding family', () => {
  assert.equal(GAP_LEAVES.length, 14);
  for (const leaf of GAP_LEAVES) {
    assert.equal(
      tileForCategory(leaf as unknown as VendorCategory),
      leaf,
      `${leaf}: must anchor 1:1 to its same-named tile, never be re-filed onto a wedding tile`,
    );
    assert.equal(TILE_PARENT[leaf], GAP_LEAF_PARENT[leaf], `${leaf}: wrong tier-1 family`);
  }
});

test('EVERY tile writes back a category the Budget bucketer can bucket', () => {
  // ⚠ THE load-bearing assertion of this file (2026-07-21 fix-forward on #3466).
  // categoryForTile() supplies the `category` STORED on event_vendors — by the
  // "Add manually" affordance and by the fit-QR add path
  // (app/vendor/fit/[ref]/page.tsx). That stored value is exactly what
  // bucketVendorsByGroup / planGroupForCategory key on. #3466 fed the
  // canonical-fill pass into the inverse bridge, so 14 tiles started writing
  // their leaf name (tour_guide, event_medic, …) — values NO plan group claims
  // — and the vendor disappeared from Budget. Nothing asserted the round-trip
  // was bucketable, which is where the regression hid.
  for (const folder of WEDDING_FOLDER_ORDER) {
    for (const tile of (WEDDING_TILES_BY_PARENT[folder] ?? []) as WeddingTile[]) {
      const cat = categoryForTile(tile);
      assert.ok(
        planGroupForCategory(cat),
        `${tile} → ${cat}: not in any PLAN_GROUP — a vendor added from this tile vanishes from Budget`,
      );
    }
  }
});

test('gap-leaf FORWARD bridge is intact (the #3466 fix is not undone)', () => {
  // The forward direction is the correct half of #3466 and must stay: a pick
  // already stored as `tour_guide` surfaces on the Tour Guide tile, not on a
  // wedding tile. Only the INVERSE (write-back) direction was rolled back, and
  // only for categories no plan group claims.
  for (const leaf of GAP_LEAVES) {
    const tile = tileForCategory(leaf as unknown as VendorCategory);
    assert.equal(tile, leaf, `${leaf}: forward bridge broken`);
    // …and the inverse deliberately does NOT echo the leaf back, precisely
    // because these 14 are unbucketable. Assert the INVARIANT (the write-back
    // is bucketable), not the current literal value: the day the owner takes
    // the recommended follow-up and adds these leaves to a real PLAN_GROUP,
    // `categoryForTile` legitimately starts echoing the leaf and this test must
    // stay green — the invariant still holds. Hard-coding `=== 'misc'` here
    // would turn a correct data fix into a red build.
    assert.ok(
      planGroupForCategory(categoryForTile(leaf as unknown as WeddingTile)),
      `${leaf}: inverse bridge must fall back to a bucketable category`,
    );
  }
});

test('the set of unbucketable categories is exactly the 14 known gap leaves', () => {
  // Pins the catch-all's SCOPE. Test 6 proves an unbucketable row lands in
  // `logistics`; nothing proved WHICH categories are unbucketable. Without this,
  // a future PR that drops a category out of a PLAN_GROUP's `categories` array
  // gets silently swept into Logistics & Misc instead of failing loudly.
  //
  // Direction matters. An EXTRA unbucketable category is a regression → fail.
  // FEWER is the owner's recommended data fix (add the gap leaves to real plan
  // groups) → must not fail. So: subset, not equality.
  const unbucketable = VENDOR_CATEGORIES.filter((c) => !planGroupForCategory(c));
  const known = new Set<string>(GAP_LEAVES as unknown as string[]);
  for (const c of unbucketable) {
    assert.ok(
      known.has(c),
      `${c}: newly unbucketable — no PLAN_GROUP claims it, so picks under it are swept into Logistics & Misc. Add it to a plan group, or add it to GAP_LEAF_PARENT deliberately.`,
    );
  }
});

test('a catch-all row does NOT mark its fallback group as locked', () => {
  // ⚠ The second load-bearing assertion (2026-07-21, round 2).
  //
  // `bucketVendorsByGroup` is NOT a Budget-only helper — four callers key on
  // it, and three of them read LOCK/PROGRESS semantics off the bucketed map:
  // pickTodaysOneThing + countUnlockedCategories (lib/todays-one-thing.ts) and
  // the AI cockpit's decision list (lib/setnayan-ai-cockpit.ts). Adding a raw
  // catch-all would make one contracted `av_production` row read as "Logistics
  // & Misc is locked" — the couple gets told a planning card is done that they
  // never touched, and the home hero stops nudging them to arrange transport /
  // security / giveaways. That is the SAME shape of defect as #3466: a shared
  // helper changed, its other callers untraced.
  //
  // So the catch-all STAMPS the pick (`bucketed_by_fallback`) and the
  // lock/progress consumers ignore stamped picks. Display consumers (Budget,
  // the Vendors tab) render them normally — the row is visible, it just doesn't
  // vote on whether a group it never belonged to is complete.
  const lockedGapRow = [
    {
      vendor_id: 'v-av',
      vendor_name: 'Sound & Vision AVP',
      category: 'av_production' as VendorCategory,
      status: 'contracted',
      total_cost_php: 40000,
    },
  ];

  // It is visible in Budget…
  const bucketed = bucketVendorsByGroup(lockedGapRow);
  assert.deepEqual(
    bucketed.get('logistics')?.map((p) => p.vendor_id),
    ['v-av'],
    'the catch-all stopped surfacing unbucketable rows',
  );
  assert.equal(
    bucketed.get('logistics')?.[0]?.bucketed_by_fallback,
    true,
    'the catch-all must STAMP the pick so lock/progress consumers can ignore it',
  );

  // …but it does not complete a card the couple never touched.
  const baseline = countUnlockedCategories([]);
  assert.equal(
    countUnlockedCategories(lockedGapRow),
    baseline,
    'a locked unbucketable row falsely marked its fallback group as locked — the couple loses the Logistics & Misc nudge forever',
  );

  // …and it does not change which task the home hero surfaces.
  const NOW = new Date('2026-07-21T00:00:00.000Z');
  const WEDDING = '2027-01-01T00:00:00.000Z';
  assert.equal(
    pickTodaysOneThing(lockedGapRow, WEDDING, NOW)?.id,
    pickTodaysOneThing([], WEDDING, NOW)?.id,
    'an unbucketable row changed which task the home hero surfaces',
  );
});

test('the bucketer never silently drops a row (catch-all backstop)', () => {
  // Belt to the braces above: rows already written while #3466 was live, or by
  // any other writer, still carry an unbucketable category. They must surface.
  const picks = bucketVendorsByGroup([
    {
      vendor_id: 'v1',
      vendor_name: 'Cebu Heritage Walks',
      category: 'tour_guide' as VendorCategory,
      status: 'considering',
      total_cost_php: 12000,
    },
  ]);
  const seen = [...picks.values()].flat();
  assert.equal(seen.length, 1, 'an unbucketable category was dropped from Budget');
  assert.deepEqual(
    picks.get('logistics')?.map((p) => p.vendor_id),
    ['v1'],
    'unbucketable rows belong in Logistics & Misc (where `misc` already lives)',
  );
});

test('buildShortlistFolders never drops a considered pick to the EVENT-TYPE filter', () => {
  // Uses a real `fallbackSnapshot()` for SHAPE, with the scoping entry injected
  // by hand: `fallbackSnapshot()` returns `tileEventTypes: {}` on purpose
  // (lib/taxonomy-snapshot.ts — "constant fallback has no event scoping → all
  // universal"), so the snapshot itself never scopes anything. Production reads
  // the same field off the admin taxonomy DB via `snapshotFromRows`. Here
  // `florist` is scoped to birthdays only while the event is a wedding: the
  // tile must still appear, because the couple has a pick on it.
  const snap = fallbackSnapshot();
  snap.tileEventTypes = { ...snap.tileEventTypes, florist: ['birthday'] };

  const rows = [
    {
      vendor_id: 'v-florist',
      vendor_name: 'Bloom & Co',
      category: 'florist' as VendorCategory,
      status: 'considering',
    },
  ];

  const folders = buildShortlistFolders({
    vendorRows: rows,
    eventType: 'wedding',
    faithSet: new Set<string>(),
    taxonomy: snap,
    eventId: 'S89E-TEST000000',
  });
  const kept = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'florist');
  assert.ok(kept, 'an out-of-scope tile holding the couple’s pick vanished from the Shortlist');
  assert.deepEqual(kept.vendors.map((v) => v.vendorId), ['v-florist']);

  // …and the same tile with NO pick is still correctly scoped out (the filter
  // was preserved, not disabled).
  const empty = buildShortlistFolders({
    vendorRows: [],
    eventType: 'wedding',
    faithSet: new Set<string>(),
    taxonomy: snap,
    eventId: 'S89E-TEST000000',
  });
  assert.equal(
    empty.flatMap((f) => f.tiles).find((t) => t.tile === 'florist'),
    undefined,
    'the event-type filter stopped working for empty tiles',
  );
});

test('buildShortlistFolders never drops a considered pick to the FAITH filter', () => {
  // The faith guard is the same one invariant as the event-type guard, and it
  // is the behaviourally-sensitive one (a religious surface). It had no test:
  // reverting `vendors.length === 0 &&` on it left the whole suite green, which
  // is exactly how the last regression survived review.
  //
  // No faith-only tile is reachable from a VendorCategory under the CONSTANT
  // TAXONOMY_MAP, so the scenario is built the way production reaches it: the
  // `map` comes off the admin taxonomy DB (`snapshotFromRows`), where an admin
  // can faith-tag canonicals. Tag EVERY canonical behind the florist tile as
  // Muslim-only, set the couple's rite to Catholic → the tile is
  // faith-incompatible, but their pick on it must still show.
  const snap = fallbackSnapshot();
  const TILE: WeddingTile = 'florist';
  snap.map = Object.fromEntries(
    Object.entries(snap.map).map(([k, v]) => [
      k,
      (v as { tile?: WeddingTile }).tile === TILE ? { ...v, faith: 'Muslim' } : v,
    ]),
  ) as typeof snap.map;
  const taggedCount = Object.values(snap.map).filter(
    (v) => (v as { tile?: WeddingTile }).tile === TILE,
  ).length;
  assert.ok(taggedCount > 0, 'no canonical maps to the florist tile — pick another tile');

  const faithSet = new Set(['Catholic']);
  const kept = buildShortlistFolders({
    vendorRows: [
      {
        vendor_id: 'v-florist',
        vendor_name: 'Bloom & Co',
        category: 'florist' as VendorCategory,
        status: 'considering',
      },
    ],
    eventType: 'wedding',
    faithSet,
    taxonomy: snap,
    eventId: 'S89E-TEST000000',
  })
    .flatMap((f) => f.tiles)
    .find((t) => t.tile === TILE);
  assert.ok(
    kept,
    'a faith-incompatible tile holding the couple’s pick vanished from the Shortlist',
  );
  assert.deepEqual(kept.vendors.map((v) => v.vendorId), ['v-florist']);

  // …and the filter still works when the tile is empty.
  assert.equal(
    buildShortlistFolders({
      vendorRows: [],
      eventType: 'wedding',
      faithSet,
      taxonomy: snap,
      eventId: 'S89E-TEST000000',
    })
      .flatMap((f) => f.tiles)
      .find((t) => t.tile === TILE),
    undefined,
    'the faith filter stopped working for empty tiles',
  );
});

test('buildShortlistFolders never drops a considered pick to the HIDDEN-TILE filter', () => {
  // Third leg of the same invariant. No tile is marketplace_hidden today, so
  // this is a no-op in production — but the guard is the one the other two were
  // modelled on, and it was equally untested.
  const snap = fallbackSnapshot();
  snap.hiddenCategories = { ...snap.hiddenCategories, florist: true };

  const kept = buildShortlistFolders({
    vendorRows: [
      {
        vendor_id: 'v-florist',
        vendor_name: 'Bloom & Co',
        category: 'florist' as VendorCategory,
        status: 'considering',
      },
    ],
    eventType: 'wedding',
    faithSet: new Set<string>(),
    taxonomy: snap,
    eventId: 'S89E-TEST000000',
  })
    .flatMap((f) => f.tiles)
    .find((t) => t.tile === 'florist');
  assert.ok(kept, 'an admin-hidden tile holding the couple’s pick vanished from the Shortlist');

  assert.equal(
    buildShortlistFolders({
      vendorRows: [],
      eventType: 'wedding',
      faithSet: new Set<string>(),
      taxonomy: snap,
      eventId: 'S89E-TEST000000',
    })
      .flatMap((f) => f.tiles)
      .find((t) => t.tile === 'florist'),
    undefined,
    'the hidden-tile filter stopped working for empty tiles',
  );
});

test('canonically-EXEMPT categories still get a Shortlist home', () => {
  // The Shortlist deliberately does NOT delegate wholesale to
  // primaryTileForVendorCategory: officiant / church_fees / security / misc are
  // bucket-C "exempt" (null) in the canonical bridge, but the Shortlist must
  // still park them somewhere or the pick disappears. This assertion is the
  // tripwire — a future refactor to `= primaryTileForVendorCategory` fails here
  // instead of silently dropping four categories' worth of picks.
  for (const c of ['officiant', 'church_fees', 'security', 'misc'] as VendorCategory[]) {
    assert.equal(primaryTileForVendorCategory(c), null, `${c}: expected canonically exempt`);
    assert.ok(tileForCategory(c), `${c}: exempt canonically, but the Shortlist must still place it`);
  }
});
