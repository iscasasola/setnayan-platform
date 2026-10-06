/**
 * 🖨 THE PRINTS TILE DRAWS EVERY PIECE (owner 2026-10-06: *"yes add prints as the
 * eleventh tile"*; DECISION_LOG "PRINTS IS THE ELEVENTH STUDIO TILE";
 * `lib/studio-details.ts`).
 *
 * Studio › Prints opens Details' first print, and in the new Maker the set, the
 * prints for the day and Download are ONE form (`form: true` — every item's
 * editor one under the other, full screen). So the tile draws exactly
 * `PRINT_SET_KEYS` + `FREE_PRINT_KEYS` pieces (and Download the set), each once,
 * none invented — and every one of them fills the phone's screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAILS_ITEM_GROUPS, FREE_PRINT_KEYS, type DetailsItemKey } from './maker-details-items';
import { PRINT_SET_KEYS } from './print-pieces';
import { STUDIO_TILES } from './studio-tiles';
import { STUDIO_FORM_ITEMS, studioDetailsGroups } from './studio-details';

const shipped = DETAILS_ITEM_GROUPS.map((g) => ({
  key: g.group,
  label: g.label,
  items: g.keys.map((key) => ({ key })),
  ...(g.form ? { form: true as const } : {}),
  ...(g.hidden ? { hidden: true as const } : {}),
}));

test('the Prints form holds every set piece and every print for the day — counted from the lists', () => {
  const groups = studioDetailsGroups(shipped);
  const prints = groups.filter((g) => g.key === 'prints');
  assert.equal(prints.length, 1, 'Prints is not ONE group');
  const p = prints[0]!;
  assert.equal(p.form, true, 'Prints is not one form — its pieces would be drawn one at a time');
  const keys = p.items.map((i) => i.key);
  const pieces = keys.filter((k) => k !== 'download');
  assert.equal(pieces.length, PRINT_SET_KEYS.length + FREE_PRINT_KEYS.length, 'the tile draws a different number of pieces than the lists hold');
  assert.deepEqual(pieces, [...PRINT_SET_KEYS, ...FREE_PRINT_KEYS], 'a piece is missing, doubled or out of the shipped order');
  assert.equal(new Set(keys).size, keys.length, 'a piece is drawn twice');
  assert.equal(keys.at(-1), 'download', 'Download the set is not at the bottom');
  /* The tile opens INTO that form. */
  assert.ok(keys.includes(STUDIO_TILES.prints.item as DetailsItemKey), 'the Prints tile opens an item outside the form');
  /* No set, day or download group is left behind as a second list. */
  assert.ok(!groups.some((g) => g.key === 'set' || g.key === 'day' || g.key === 'download'));
});

test('every print fills the phone screen in Studio', () => {
  for (const k of [...PRINT_SET_KEYS, ...FREE_PRINT_KEYS, 'download' as const]) {
    assert.ok(STUDIO_FORM_ITEMS.includes(k as DetailsItemKey), `${k} is not drawn full screen`);
  }
});

test('Info and E-Gifts: the gifts leave Info for a form of their own; nothing else moves', () => {
  const groups = studioDetailsGroups(shipped);
  const info = groups.find((g) => g.key === 'event')!;
  assert.equal(info.label, 'Info');
  assert.deepEqual(info.items.map((i) => i.key), ['names', 'date', 'venues', 'opening-line', 'special-message', 'address', 'qr']);
  const gifts = groups.find((g) => g.key === 'gifts')!;
  assert.deepEqual(gifts.items.map((i) => i.key), ['gifts', 'thank-you']);
  assert.equal(gifts.form, true);
  const before = shipped.flatMap((g) => g.items.map((i) => i.key)).sort();
  const after = groups.flatMap((g) => g.items.map((i) => i.key)).sort();
  assert.deepEqual(after, before, 'an item was lost or invented by the regrouping');
});
