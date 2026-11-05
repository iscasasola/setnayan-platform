/**
 * 🧩 GUARD 1 — THE COUPLE'S LIST, THE SUPPLIER'S LIST AND THE ADMIN'S LIST ARE ONE (PLAN
 * `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 3, step ②; owner-approved 2026-10-26).
 *
 * The property is not "these three arrays hold these words" — it is that ONE snapshot drives all three, so an
 * admin's edit moves every list together and none can keep a stale copy. So the test takes the shipped
 * fallback, EDITS it the way an admin will from step ③ (a rename, a hide, a reorder, a new part, a deleted
 * part), draws the three lists from that one edited snapshot, and checks each edit landed in every list it
 * belongs in:
 *
 *   · the couple's "Which part?" — `palettePhotoParts(snapshot)`, what `mood-board-studio.tsx`'s `uploadOptions`
 *     is built from (asserted at the bottom: the Studio passes ITS snapshot prop, the server passes
 *     `getInspirationParts()`);
 *   · the supplier's `Part ▾` for a shop holding EVERY category — `uploadableSlotsForShop(services, snapshot)`,
 *     what the library page's dropdown is built from (`moodboardLibraryAccessForProfile`);
 *   · the admin's list — `inspirationPartsInOrder(snapshot)` (step ③ draws it).
 *
 * ⚠ THE THREE KEY SETS ARE NOT EQUAL IN STEP ②, AND THE TEST SAYS EXACTLY WHERE THEY DIFFER, ON PURPOSE:
 * couple ⊆ supplier ⊆ admin. The couple's "Which part?" offers the Palette's parts only (the Attire boards
 * upload from their rows, and the older shelves have no couple's card until step ④'s one board + "＋ Add a
 * part"); a HIDDEN part is hidden from couples only; the system part (palette) is nobody's shelf. Each of those
 * gaps is asserted as a rule below, so a fourth, unexplained gap fails.
 *
 * 🛡 Sabotaged once each (2026-10-26, builder; the source restored after each): `uploadableSlotsForShop`'s
 * second loop reading `fallbackInspirationParts()` instead of `parts` → "the supplier's list … IS the admin's
 * list" and "the new part … a deleted part leaves every list" red (and guard 2's jeweller); `studioPhotoParts`
 * labelling from the fallback → "one snapshot …" and "the rename reached every list" red; dropping
 * `part.hidden && !includeHidden` → "the couple's list IS …" and "hidden from couples, not from suppliers" red;
 * `uploadableSlotsForShop` replacing its snapshot with the fallback → seven red, the order test included.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  fallbackInspirationParts,
  inspirationPartsInOrder,
  type InspirationPart,
  type InspirationPartsSnapshot,
} from './inspiration-parts';
import { palettePhotoParts, libraryPhotoParts } from './inspiration-slots';
import { uploadableSlotsForShop } from './moodboard-gallery-upload';
import { canonicalServicesForTile } from './vendor-counts';
import { WEDDING_TILE_ORDER } from './taxonomy';

/** A shop that holds every category. */
const EVERY_SERVICE = [...new Set(WEDDING_TILE_ORDER.flatMap((t) => canonicalServicesForTile(t)))];

/** The fallback, edited the way an admin will edit the table. */
function edited(): InspirationPartsSnapshot {
  const base = fallbackInspirationParts().parts.map((p) => ({ ...p }));
  const at = (k: string) => base.find((p) => p.slotKey === k)!;
  at('stage').label = 'Stage & arch'; // a rename
  at('tunnel').hidden = true; // hidden from couples
  at('ceiling').sortOrder = 15; // ceiling before stage (20)
  const parts: InspirationPart[] = base.filter((p) => p.slotKey !== 'chairs'); // a part deleted (it held no photo)
  parts.push({ slotKey: 'flower_arch', label: 'Flower arch', kind: 'part', homeCategoryId: 'florist', alsoCategoryIds: ['stylist_decorator'], services: null, hidden: false, sortOrder: 135 });
  parts.sort((a, b) => a.sortOrder - b.sortOrder);
  return { source: 'db', parts };
}

function threeLists(snapshot: InspirationPartsSnapshot) {
  const couple = palettePhotoParts(snapshot).map((p) => ({ key: p.key as string, label: p.label }));
  const supplier = uploadableSlotsForShop(EVERY_SERVICE, snapshot).map((p) => ({ key: p.key, label: p.label }));
  const admin = inspirationPartsInOrder(snapshot).map((p) => ({ key: p.slotKey, label: p.label }));
  return { couple, supplier, admin };
}
const keys = (l: Array<{ key: string }>) => l.map((x) => x.key);

test('⭐ one snapshot: couple ⊆ supplier ⊆ admin, and every list names a part exactly as the snapshot does', () => {
  for (const snapshot of [fallbackInspirationParts(), edited()]) {
    const { couple, supplier, admin } = threeLists(snapshot);
    assert.ok(couple.length >= 10 && supplier.length >= 20, 'the lists are too short to mean anything — the fixture is broken, not the guard');
    const label = new Map(admin.map((a) => [a.key, a.label]));
    for (const list of [couple, supplier]) {
      for (const { key, label: l } of list) {
        assert.ok(label.has(key), `${key} is drawn but is not a part of the snapshot`);
        assert.equal(l, label.get(key), `${key} is called “${l}” here and “${label.get(key)}” in the snapshot`);
      }
    }
    assert.ok(keys(couple).every((k) => keys(supplier).includes(k)), 'a part the couple is offered is not a supplier shelf');
  }
});

test('⭐ the supplier’s list for a shop of every category IS the admin’s list, minus the system part — nothing else', () => {
  for (const snapshot of [fallbackInspirationParts(), edited()]) {
    const { supplier } = threeLists(snapshot);
    const expected = snapshot.parts.filter((p) => p.kind === 'part').map((p) => p.slotKey);
    assert.deepEqual([...keys(supplier)].sort(), [...expected].sort());
  }
});

test('⭐ the couple’s list IS the admin’s visible Palette parts — hidden ones and the system part held back, nothing else', () => {
  const studioKeys = new Set(libraryPhotoParts(fallbackInspirationParts()).filter((p) => p.group !== 'attire').map((p) => p.key as string));
  for (const snapshot of [fallbackInspirationParts(), edited()]) {
    const { couple } = threeLists(snapshot);
    const expected = snapshot.parts.filter((p) => !p.hidden && p.kind === 'part' && studioKeys.has(p.slotKey)).map((p) => p.slotKey);
    assert.deepEqual([...keys(couple)].sort(), [...expected].sort());
  }
});

test('the rename reached every list it belongs in', () => {
  const { couple, supplier, admin } = threeLists(edited());
  for (const [name, list] of [['couple', couple], ['supplier', supplier], ['admin', admin]] as const) {
    assert.equal(list.find((p) => p.key === 'stage')?.label, 'Stage & arch', `the ${name}’s list still has the old name`);
  }
});

test('hidden from couples, not from suppliers — the switch means exactly what its label says', () => {
  const { couple, supplier, admin } = threeLists(edited());
  assert.ok(!keys(couple).includes('tunnel'), 'a hidden part is still offered to the couple');
  assert.ok(keys(supplier).includes('tunnel'), 'a hidden part left the supplier’s shelves');
  assert.ok(keys(admin).includes('tunnel'), 'a hidden part left the admin’s list');
});

test('the new part is on the supplier’s shelves and in the admin’s list; a deleted part leaves every list', () => {
  const { couple, supplier, admin } = threeLists(edited());
  assert.ok(keys(supplier).includes('flower_arch') && keys(admin).includes('flower_arch'), 'the new part did not reach the supplier and the admin');
  for (const [name, list] of [['couple', couple], ['supplier', supplier], ['admin', admin]] as const) {
    assert.ok(!keys(list).includes('chairs'), `a deleted part is still in the ${name}’s list`);
  }
});

test('the admin’s order is the order in both other lists (within a heading)', () => {
  const { couple, supplier } = threeLists(edited());
  for (const list of [couple, supplier]) {
    assert.ok(keys(list).indexOf('ceiling') < keys(list).indexOf('stage'), 'ceiling was moved before stage and did not move');
  }
});

test('the wiring: each screen draws from the request’s ONE snapshot', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const studio = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  assert.match(studio, /palettePhotoParts\(props\.inspirationParts\)/, 'the couple’s “Which part?” does not read the snapshot it is handed');
  const editor = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  assert.match(editor, /inspirationParts=\{await getInspirationParts\(\)\}/, 'the Studio is not handed the request’s snapshot');
  const access = read('lib/moodboard-library-access.ts');
  assert.match(access, /getInspirationParts\(\)/, 'the supplier’s library does not read the snapshot');
  assert.match(access, /moodboardLibraryAccessForProfile\(profile, parts\)/, 'the supplier’s dropdown is not built from the snapshot it read');
});
