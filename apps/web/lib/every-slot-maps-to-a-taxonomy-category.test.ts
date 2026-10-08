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
import { AWAITING_A_SLOT, STUDIO_INSPIRATION_SLOTS } from './inspiration-slots';

/* The owner's twelve parts (2026-10-06/07), with the bride's card named "Bridal gown" and his attire
   boards added (2026-10-08: Groom's suit drawn on the stored `groom` slot; Groomsmen · Bridesmaids ·
   Flower girl · Ring bearer awaiting a slot of their own). */
const OWNERS_TWELVE = ['Flowers', 'Tables', 'Venue & decor', 'Bridal gown', 'Groom’s suit', 'Entourage', 'Cake', 'Bridal bouquet', 'Centrepieces', 'Stage', 'Ceiling', 'Wall', 'Tunnel', 'Groomsmen', 'Bridesmaids', 'Flower girl', 'Ring bearer'];

test('every drawn part is a stored slot with a supplying trade', () => {
  for (const s of STUDIO_INSPIRATION_SLOTS) {
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(s.slotKey), `${s.label} → ${s.slotKey} is not a stored slot`);
    const trades = MOODBOARD_SLOT_TRADES[s.slotKey];
    assert.ok(trades.length > 0, `${s.label} has no supplying trade`);
    for (const t of trades) assert.ok(t in WEDDING_TILE_LABEL, `${s.label} → ${t} is not a taxonomy tile`);
  }
  assert.equal(new Set(STUDIO_INSPIRATION_SLOTS.map((s) => s.slotKey)).size, STUDIO_INSPIRATION_SLOTS.length, 'two cards share one slot');
});

test('a part with no slot yet still maps to existing taxonomy tiles — and is not drawn', () => {
  for (const a of AWAITING_A_SLOT) {
    assert.ok(a.trades.length > 0);
    for (const t of a.trades) assert.ok(t in WEDDING_TILE_LABEL, `${a.label} → ${t} is not a taxonomy tile`);
    assert.ok(!STUDIO_INSPIRATION_SLOTS.some((s) => s.label === a.label), `${a.label} is drawn with nowhere to store its photos`);
  }
});

test('the owner’s twelve are every one accounted for', () => {
  const named = [...STUDIO_INSPIRATION_SLOTS.map((s) => s.label), ...AWAITING_A_SLOT.map((a) => a.label)];
  assert.deepEqual([...named].sort(), [...OWNERS_TWELVE].sort());
});
