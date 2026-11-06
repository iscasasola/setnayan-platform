/**
 * 🧩 EVERY MOOD BOARD PART MAPS TO A TAXONOMY CATEGORY (DECISION_LOG 2026-09-03
 * "inspiration by slot" — nothing new to invent; 2026-10-06 "MOOD BOARD PARTS
 * ADDED … To confirm at build: each new part maps to existing taxonomy
 * categories").
 *
 *   · every card Studio › Mood Board › Inspiration draws is an EXISTING stored
 *     slot (`MOODBOARD_SLOT_KEYS`, the DB CHECK's list) with at least one
 *     supplying trade in `MOODBOARD_SLOT_TRADES` — so its Search ideas › has a
 *     shelf, and its photos are kept;
 *   · the owner's parts with no slot yet (Bridal bouquet, Centrepieces) still
 *     map to EXISTING taxonomy tiles — the mapping is answered; what they lack
 *     is a slot to store in, which is a migration — and they are NOT drawn as
 *     cards a photo could be lost into;
 *   · the owner's twelve are all accounted for, one way or the other.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';
import { MOODBOARD_SLOT_TRADES } from './moodboard-gallery';
import { WEDDING_TILE_LABEL } from './taxonomy';
import { STUDIO_INSPIRATION_SLOTS } from './inspiration-slots';
import { fallbackInspirationParts, partCategories } from './inspiration-parts';

/* The owner's twelve parts (2026-10-06/07), with the bride's card named "Bridal gown" and his attire
   boards added (2026-10-08: Groom's suit drawn on the stored `groom` slot; Groomsmen · Bridesmaids ·
   Flower girl · Ring bearer each on a slot of their own since migration 20271266380994 — DRAWN, no
   longer waiting; `four-more-attire-boards.test.ts` holds the four). */
/* The Entourage board left Attire on 2026-10-14 (owner: the Attire screen is one block per role; its stored photos stay, `wedding_party` stays the silent palette fallback). */
/* "Groom’s suit" became "Groom’s attire" on 2026-10-26 (owner ruling recorded with "BUILD THE TAXONOMY"; migration ③a). */
const OWNERS_TWELVE = ['Flowers', 'Tables', 'Venue & decor', 'Bridal gown', 'Groom’s attire', 'Cake', 'Bridal bouquet', 'Centrepieces', 'Stage', 'Ceiling', 'Wall', 'Tunnel', 'Groomsmen', 'Bridesmaids', 'Flower girl', 'Ring bearer',
  /* 🎨🖼 The Palette's five parts with photos of their own (owner 2026-10-19, "2. yes"). */
  'Chairs', 'Ribbons & candles', 'Lights', 'Entourage bouquets', 'Flower accents'];

test('every drawn part is a stored slot with a supplying trade', () => {
  for (const s of STUDIO_INSPIRATION_SLOTS) {
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(s.slotKey), `${s.label} → ${s.slotKey} is not a stored slot`);
    const trades = MOODBOARD_SLOT_TRADES[s.slotKey];
    assert.ok(trades.length > 0, `${s.label} has no supplying trade`);
    for (const t of trades) assert.ok(t in WEDDING_TILE_LABEL, `${s.label} → ${t} is not a taxonomy tile`);
  }
  assert.equal(new Set(STUDIO_INSPIRATION_SLOTS.map((s) => s.slotKey)).size, STUDIO_INSPIRATION_SLOTS.length, 'two cards share one slot');
});

/* 🧩 Step ② (PLAN admin_inspiration_groups_2026-10-25): there is no "waiting for a slot" list any more
   (`AWAITING_A_SLOT` is gone) — a new part is one `inspiration_parts` row with a tier-2 home. What survives is the
   2026-09-03 rule itself: every part maps to REAL taxonomy tiles. */
test('every inspiration part maps to existing taxonomy tiles — the palette alone has none', () => {
  for (const part of fallbackInspirationParts().parts) {
    const tiles = partCategories(part);
    if (part.kind === 'system') {
      assert.deepEqual(tiles, [], `${part.slotKey} is a system part but names a supplier`);
      continue;
    }
    assert.ok(tiles.length > 0, `${part.slotKey} has no home category`);
    for (const t of tiles) assert.ok(t in WEDDING_TILE_LABEL, `${part.slotKey} → ${t} is not a taxonomy tile`);
  }
});

test('the owner’s twelve are every one accounted for', () => {
  const named = STUDIO_INSPIRATION_SLOTS.map((s) => s.label);
  assert.deepEqual([...named].sort(), [...OWNERS_TWELVE].sort());
  /* 👗 The four attire boards are accounted for by being DRAWN (a stored slot each), not by waiting. */
  for (const label of ['Groomsmen', 'Bridesmaids', 'Flower girl', 'Ring bearer']) {
    assert.ok(STUDIO_INSPIRATION_SLOTS.some((s) => s.label === label), `${label} is not drawn`);
  }
});
