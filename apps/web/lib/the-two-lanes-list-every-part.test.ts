/**
 * 🛋💐 THE TWO LANES LIST EVERY PART — Studio › Mood Board › Colours (owner
 * 2026-10-06, DECISION_LOG "MOOD BOARD PARTS ADDED: CEILING · BRIDAL BOUQUET ·
 * WALL · TUNNEL · STAGE · CENTREPIECES": *"ceiling, bridal boquet, wall, tunnel,
 * stage"* · *"centerpieces"*).
 *
 * The room — for your stylist = Stage · Ceiling · Walls · Tunnel · Table linens ·
 * Chairs · Ribbons & candles · Lights · warmth; Flowers — for your florist =
 * Bridal bouquet · Entourage bouquets · Centrepieces · Accents. Exactly these,
 * in this order — a part dropped from a lane is a part the couple can no
 * longer see their stylist or florist is dressing.
 *
 * And the lanes are the shipped MB16 lanes (`laneForVendorCategory`): the room
 * belongs to `reception_decor` (decor + the five main colours), the flowers to
 * `florist` (florals). A part that stores its own colour stores it in a field
 * of exactly that lane, or the supplier's grant could not reach it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECOR_DRESSING_FIELDS,
  FLORAL_DRESSING_FIELD,
  FLORIST_LANE_PARTS,
  ROOM_LANE_PARTS,
  domainCovers,
  laneForVendorCategory,
} from './colour-access';

test('the room — for your stylist lists every part, in order', () => {
  assert.deepEqual(
    ROOM_LANE_PARTS.map((p) => p.label),
    ['Stage', 'Ceiling', 'Walls', 'Tunnel', 'Table linens', 'Chairs', 'Ribbons & candles', 'Lights · warmth'],
  );
});

test('flowers — for your florist lists every part, in order', () => {
  assert.deepEqual(FLORIST_LANE_PARTS.map((p) => p.label), ['Bridal bouquet', 'Entourage bouquets', 'Centrepieces', 'Accents']);
});

test('a part that stores its own colour stores it inside its supplier’s lane', () => {
  assert.deepEqual(laneForVendorCategory('reception_decor'), ['decor', 'main_colours']);
  assert.deepEqual(laneForVendorCategory('florist'), ['florals']);
  for (const p of ROOM_LANE_PARTS) {
    if (!p.field) continue;
    assert.ok((DECOR_DRESSING_FIELDS as readonly string[]).includes(p.field), `${p.label} → ${p.field} is not a decor field`);
    assert.ok(domainCovers('decor', 'room_dressing', p.field), `the stylist's grant cannot reach ${p.label}`);
  }
  for (const p of FLORIST_LANE_PARTS) {
    if (!p.field) continue;
    assert.equal(p.field, FLORAL_DRESSING_FIELD, `${p.label} must store in the florals field`);
    assert.ok(domainCovers('florals', 'room_dressing', p.field));
  }
});

test('every stored room-dressing field appears in exactly one lane', () => {
  const fields = [...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS].flatMap((p) => (p.field ? [p.field] : []));
  assert.deepEqual([...fields].sort(), ['chairs', 'florals', 'lighting_warmth', 'linens']);
});
