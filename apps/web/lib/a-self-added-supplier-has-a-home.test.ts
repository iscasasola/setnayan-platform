/**
 * A SUPPLIER THE COUPLE ADDED THEMSELVES HAS A HOME, AND IT IS NOT "ESCORT".
 *
 * ─── THE DEFECT ────────────────────────────────────────────────────────────
 * `misc` is the FALLBACK `VendorCategory` — `eventVendorCategoryForCardKind`
 * returns it for an unknown trade, `vendorCategoryForLeaf` for an unknown leaf —
 * so it is what a self-added supplier is stamped with whenever the app cannot
 * name their trade. It had no tile of its own, so `shortlist-taxonomy.ts`
 * pinned it to `escort`, a tier-2 tile under **Cars & transport**.
 *
 * Measured on production 2026-09-22, event 044f7e64 (a live wedding):
 * `Seda Hotel` and `Saysay Live Band & Hosting` both carry
 * `event_vendors.category = 'misc'`, so the bench filed a HOTEL and a BAND
 * under "Cars & transport › Escort". Visible — and in the last place a couple
 * would look for either.
 *
 * ─── WHAT THIS PINS ────────────────────────────────────────────────────────
 * The third test is the load-bearing one. `everything_else` is
 * `marketplace_hidden` (nobody browses for "everything else", and the tile holds
 * no canonical service, so offering it would be a fake door). That is only safe
 * because `buildShortlistFolders` qualifies its hidden-tile filter with
 * `vendors.length === 0`, under an invariant it states itself: "A COUPLE'S
 * EXISTING PICK MUST NEVER VANISH FROM THEIR OWN SHORTLIST."
 *
 * 🔑 IF ANYONE DROPS THAT QUALIFIER AS DEAD CODE, EVERY SELF-ADDED SUPPLIER
 * DISAPPEARS — and before this tile existed the qualifier genuinely was dead
 * (the file's own comment said "No tile is hidden today (no-op)"), so it was
 * exactly the kind of thing a tidy-up removes. This test is what makes removing
 * it fail.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { VendorCategory } from './vendors';
import { buildShortlistFolders, tileForCategory } from './shortlist-taxonomy';
import { fallbackSnapshot } from './taxonomy-snapshot';
import { WEDDING_TILE_LABEL, TILE_PARENT } from './taxonomy';

/** The two real production rows, by shape. */
const SELF_ADDED = [
  {
    vendor_id: 'v-hotel',
    vendor_name: 'Seda Hotel',
    category: 'misc' as VendorCategory,
    status: 'considering',
  },
  {
    vendor_id: 'v-band',
    vendor_name: 'Saysay Live Band & Hosting',
    category: 'misc' as VendorCategory,
    status: 'considering',
  },
];

/**
 * The plain constant snapshot — NOTHING IS INJECTED.
 *
 * `everything_else` is in `ADMIN_ONLY_TILES`, and `taxonomy-snapshot.ts` derives
 * `hiddenCategories` from that set, so the fallback hides it on its own. Using
 * the untouched snapshot is deliberately stronger than hand-setting the flag:
 * it pins the membership as well as the behaviour, and it matches what every
 * consumer sees if a DB read hiccups.
 */
const snapshotWithTileHidden = fallbackSnapshot;

test('the fallback category maps to Everything else, not Escort', () => {
  assert.equal(tileForCategory('misc' as VendorCategory), 'everything_else');
  assert.notEqual(
    tileForCategory('misc' as VendorCategory),
    'escort',
    'the fallback must not be filed under Cars & transport › Escort any more',
  );
  // `security` legitimately IS an escort detail — only the FALLBACK moved.
  assert.equal(
    tileForCategory('security' as VendorCategory),
    'escort',
    'first-writer-wins: a real security category keeps its real tile',
  );
  assert.equal(WEDDING_TILE_LABEL.everything_else, 'Everything else');
  // The constant snapshot hides it WITHOUT being told to — i.e. the tile is in
  // ADMIN_ONLY_TILES, so the code fallback and the DB row agree.
  assert.equal(
    fallbackSnapshot().hiddenCategories.everything_else,
    true,
    'the tile must be hidden by the constant too, not only by the DB row — '
      + 'otherwise a hiccuped taxonomy read offers it for browsing',
  );
  assert.equal(
    TILE_PARENT.everything_else,
    'logistics_safety',
    'the folder is Logistics & safety — the plan group that owns `misc` is '
      + 'labelled "Logistics & Misc", not "Cars & transport"',
  );
});

test('an empty Everything else is not offered for browsing', () => {
  const folders = buildShortlistFolders({
    vendorRows: [],
    eventType: 'wedding',
    faithSet: new Set<string>(),
    taxonomy: snapshotWithTileHidden(),
    eventId: 'S89E-TEST000000',
  });
  const tiles = folders.flatMap((f) => f.tiles).map((t) => t.tile);
  assert.ok(
    !tiles.includes('everything_else'),
    'with nothing filed there the tile must stay out of the bench — it holds no '
      + 'canonical service, so browsing it would be a fake door',
  );
});

test('🔑 a self-added supplier appears on the bench even though the tile is hidden', () => {
  const folders = buildShortlistFolders({
    vendorRows: SELF_ADDED,
    eventType: 'wedding',
    faithSet: new Set<string>(),
    taxonomy: snapshotWithTileHidden(),
    eventId: 'S89E-TEST000000',
  });

  const tile = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'everything_else');
  assert.ok(
    tile,
    'the hidden tile MUST appear once it holds a pick — otherwise every '
      + 'self-added supplier vanishes from the couple\'s own shortlist',
  );
  assert.deepEqual(
    tile.vendors.map((v) => v.vendorId).sort(),
    ['v-band', 'v-hotel'],
    'both self-added suppliers land there',
  );

  // …and in the right folder, which is the whole point of the move.
  const folder = folders.find((f) => f.tiles.some((t) => t.tile === 'everything_else'));
  assert.equal(folder?.folder, 'logistics_safety');

  // …and NOT under Cars & transport any more.
  const transport = folders.find((f) => f.folder === 'transport');
  const strandedInTransport = (transport?.tiles ?? []).flatMap((t) => t.vendors);
  assert.deepEqual(
    strandedInTransport.map((v) => v.vendorId),
    [],
    'a hotel and a band must no longer be filed under Cars & transport',
  );
});

test('the supplier is never dropped for event type either — any celebration can have one', () => {
  // The tile carries `applicable_event_types = NULL` (universal). A wake, a
  // tournament and a birthday can each acquire a supplier whose trade we cannot
  // name, so scoping this tile to a list would silently drop the fallback for
  // every type missing from it.
  for (const eventType of ['wedding', 'wake', 'tournament', 'birthday', 'corporate']) {
    const folders = buildShortlistFolders({
      vendorRows: SELF_ADDED,
      eventType,
      faithSet: new Set<string>(),
      taxonomy: snapshotWithTileHidden(),
      eventId: 'S89E-TEST000000',
    });
    const tile = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'everything_else');
    assert.ok(tile, `${eventType}: the self-added suppliers vanished`);
    assert.equal(tile.vendors.length, 2, `${eventType}: a self-added supplier was dropped`);
  }
});
