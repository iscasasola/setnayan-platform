/**
 * 🧩 GUARD 2 — A SHOP SEES ONLY ITS PARTS (PLAN `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 3,
 * step ②; owner-approved 2026-10-26).
 *
 * A supplier's `Part ▾` (`uploadableSlotsForShop`) must list exactly the parts whose home or "also from"
 * categories include a category the shop holds — never a part it does not dress (a florist offered Stage), and
 * never missing one it does. Three fixture shops, each holding ONE category's canonical services:
 *
 *   · a florist   — every part with `florist` among its categories, and nothing else;
 *   · a stylist   — every part with `stylist_decorator` among its categories, and nothing else;
 *   · a jeweller  — NOTHING, because no part names Jewelleries & Accessories … until an admin adds one, and then
 *                   exactly that one (the snapshot, not the consts, decides).
 *
 * The expected sets are computed from the snapshot's categories + the taxonomy's canonical services, not typed
 * in, so the guard holds whatever parts the table holds.
 *
 * 🛡 Sabotaged once each (2026-10-26, builder; the source restored after each): `slotUploadVerdict` returning
 * `allowed: true` before its trade check → all four red; `uploadableSlotsForShop` replacing the snapshot it is
 * handed with the fallback → the jeweller test and "a part the snapshot moves … moves with it" red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fallbackInspirationParts, partCategories, type InspirationPartsSnapshot } from './inspiration-parts';
import { uploadableSlotsForShop, slotUploadVerdict } from './moodboard-gallery-upload';
import { canonicalServicesForTile } from './vendor-counts';
import type { WeddingTile } from './taxonomy';

const shopOf = (tile: WeddingTile) => canonicalServicesForTile(tile);

/** The parts a shop holding `services` dresses — from the snapshot's categories, expanded through the taxonomy. */
function partsDressedBy(services: readonly string[], snapshot: InspirationPartsSnapshot): string[] {
  const held = new Set(services);
  return snapshot.parts
    .filter((p) => partCategories(p).some((tile) => canonicalServicesForTile(tile).some((c) => held.has(c))))
    .map((p) => p.slotKey);
}

const listed = (services: readonly string[], snapshot: InspirationPartsSnapshot) =>
  uploadableSlotsForShop(services, snapshot).map((s) => s.key);

test('⭐ a florist sees every part it dresses and nothing else', () => {
  const snap = fallbackInspirationParts();
  const florist = shopOf('florist');
  assert.ok(florist.length > 0, 'the taxonomy holds no florist services — the fixture is broken');
  const seen = listed(florist, snap);
  assert.deepEqual([...seen].sort(), partsDressedBy(florist, snap).sort());
  assert.ok(seen.includes('bridal_bouquet'), 'a florist is not offered the bridal bouquet');
  assert.ok(!seen.includes('stage') && !seen.includes('cake') && !seen.includes('bride'), 'a florist is offered a part it does not dress');
});

test('⭐ a stylist sees every part it dresses and nothing else', () => {
  const snap = fallbackInspirationParts();
  const stylist = shopOf('stylist_decorator');
  const seen = listed(stylist, snap);
  assert.deepEqual([...seen].sort(), partsDressedBy(stylist, snap).sort());
  assert.ok(seen.includes('stage') && seen.includes('tunnel'), 'a stylist is not offered the room');
  assert.ok(!seen.includes('bridal_bouquet') && !seen.includes('cake') && !seen.includes('groom'), 'a stylist is offered a part it does not dress');
});

test('⭐ a jeweller sees nothing — until an admin adds a Jewellery part, and then exactly that one', () => {
  const jeweller = shopOf('jewelleries_accessories');
  assert.ok(jeweller.length > 0, 'the taxonomy holds no jewellery services — the fixture is broken');
  const before = fallbackInspirationParts();
  assert.deepEqual(listed(jeweller, before), [], 'a jeweller is offered a part no category of theirs fills');
  assert.deepEqual(partsDressedBy(jeweller, before), []);
  for (const p of before.parts) assert.equal(slotUploadVerdict(p.slotKey, jeweller, before).allowed, false, `a jeweller may upload to ${p.slotKey}`);

  const after: InspirationPartsSnapshot = {
    source: 'db',
    parts: [
      ...before.parts,
      { slotKey: 'jewellery', label: 'Jewellery', kind: 'part', homeCategoryId: 'jewelleries_accessories', alsoCategoryIds: [], services: null, hidden: false, sortOrder: 300 },
    ],
  };
  assert.deepEqual(listed(jeweller, after), ['jewellery']);
  assert.equal(slotUploadVerdict('jewellery', jeweller, after).allowed, true);
  /* …and the florist's list is untouched by it. */
  assert.deepEqual(listed(shopOf('florist'), after), listed(shopOf('florist'), before));

  /* 🌳 ③a: a DB part's SERVICES are the door, not its home. Homed on Jewelleries but linking none of its services → the
     jeweller is refused; homed on a stylist's category but linking one jewellery service → that jeweller is let in. */
  const byServices = (home: string, services: string[]): InspirationPartsSnapshot => ({
    source: 'db',
    parts: [
      ...before.parts,
      { slotKey: 'jewellery', label: 'Jewellery', kind: 'part', homeCategoryId: home, alsoCategoryIds: [], services, hidden: false, sortOrder: 300 },
    ],
  });
  assert.equal(slotUploadVerdict('jewellery', jeweller, byServices('jewelleries_accessories', [])).allowed, false, 'a home with no linked service let a jeweller in');
  assert.equal(slotUploadVerdict('jewellery', jeweller, byServices('stylist_decorator', [jeweller[0]!])).allowed, true, 'a linked jewellery service did not let the jeweller in');
});

test('a part the snapshot moves to another category moves with it — the access is the snapshot’s, never the consts’', () => {
  const before = fallbackInspirationParts();
  const moved: InspirationPartsSnapshot = {
    source: 'db',
    parts: before.parts.map((p) => (p.slotKey === 'cake' ? { ...p, homeCategoryId: 'florist', alsoCategoryIds: [] } : p)),
  };
  assert.ok(!listed(shopOf('florist'), before).includes('cake'));
  assert.ok(listed(shopOf('florist'), moved).includes('cake'), 'a florist is not offered the part an admin homed on Florist');
  assert.ok(!listed(shopOf('cake'), moved).includes('cake'), 'a cake shop is still offered the part an admin moved away');
});
