/**
 * 🎨 A PART FOLLOWS ITS MAIN COLOUR UNTIL IT IS SET (owner 2026-10-05,
 * DECISION_LOG "APPROVED — THE 5 MAIN COLOURS, ONE JOB EACH; EVERYTHING ELSE
 * FOLLOWS THEM UNTIL SET"): florals + lighting = Dominant · linens =
 * Supporting · chairs = Accent · walls / base drapes = Neutral · ribbons,
 * candles, details = Accent 2.
 *
 * Studio › Mood Board › Colours says it on every row ("Follows Neutral" / "Set
 * by you") and paints the row in the colour that is actually used. This holds
 * the mapping, that a followed part changes when its main colour does, and
 * that a part set by hand stops following — until "Follow … again" clears it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLORIST_LANE_PARTS, ROOM_LANE_PARTS, lanePartColour, type LanePart } from './colour-access';
import { resolveRoomDressing, type RolePalette } from './mood-board';
import { withMainColour, withPartColour } from './mood-board-studio';

const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];
const part = (label: string): LanePart => {
  const p = [...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS].find((x) => x.label === label);
  assert.ok(p, `no part ${label}`);
  return p!;
};

test('each part follows the main colour the venue rule names', () => {
  const follows = (label: string) => lanePartColour(part(label), FIVE, { reception: FIVE }).followsLabel;
  assert.equal(follows('Walls'), 'Neutral');
  assert.equal(follows('Ribbons & candles'), 'Accent 2');
  assert.equal(follows('Table linens'), 'Supporting');
  assert.equal(follows('Chairs'), 'Accent');
  assert.equal(follows('Lights · warmth'), 'Dominant');
  assert.equal(follows('Centrepieces'), 'Dominant');
  assert.equal(follows('Bridal bouquet'), 'Dominant');
});

test('a followed part wears its main colour — and the room the 3D scene draws agrees', () => {
  const palette: RolePalette = { reception: FIVE };
  const room = resolveRoomDressing(palette);
  for (const p of [...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS]) {
    const c = lanePartColour(p, FIVE, palette);
    assert.equal(c.setByYou, false, p.label);
    assert.equal(c.hex, FIVE[p.follows], p.label);
    if (p.field) assert.equal(c.hex, room[p.field], `${p.label}: the row and the room disagree`);
  }
});

test('change the main colour and every part that follows it moves with it', () => {
  const before: RolePalette = { reception: FIVE };
  const after = withMainColour(before, FIVE, 3, '#FFFFFF');
  assert.equal(lanePartColour(part('Walls'), after.reception!, after).hex, '#FFFFFF');
  assert.equal(lanePartColour(part('Chairs'), after.reception!, after).hex, FIVE[2]);
});

test('set by you: the part keeps its own colour through a main-colour change', () => {
  let p: RolePalette = withPartColour({ reception: FIVE }, 'linens', '#123456');
  const linens = part('Table linens');
  assert.deepEqual(lanePartColour(linens, FIVE, p), { hex: '#123456', setByYou: true, followsLabel: 'Supporting' });
  p = withMainColour(p, FIVE, 1, '#ABCDEF');
  assert.equal(lanePartColour(linens, p.reception!, p).hex, '#123456');
});
