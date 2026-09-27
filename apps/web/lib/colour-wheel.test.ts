/**
 * colour-wheel.test.ts — the Colour panel's wheel, brightness and opacity turn
 * a panel position into hex digits, and back, without drifting; and a colour
 * below 100% opacity is stored and measured as what a guest SEES.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { colourOpacity, hexToHsv, hsvToHex, wheelPoint, wheelPosition, withOpacity } from './colour-wheel';
import { hubColorOver, hubElementColor, hubElementContrast } from './element-style';

test('hex → HSV → hex is the same colour', () => {
  for (const hex of ['#000000', '#ffffff', '#8a1c2b', '#a9834b', '#3b4e67', '#4f6b4a', '#ff0000', '#00ff00', '#0000ff']) {
    assert.equal(hsvToHex(hexToHsv(hex)!), hex);
  }
  assert.equal(hexToHsv('red'), null);
});

test('the wheel: red at the top, hue round the rim, saturation from the centre', () => {
  assert.deepEqual(wheelPoint(0, -50, 50), { h: 0, s: 1 });
  assert.equal(Math.round(wheelPoint(50, 0, 50).h), 90);
  assert.equal(wheelPoint(0, 0, 50).s, 0);
  assert.equal(wheelPoint(0, -200, 50).s, 1, 'outside the rim is the rim');
  const at = wheelPosition(210, 0.5, 80);
  const back = wheelPoint(at.x, at.y, 80);
  assert.equal(Math.round(back.h), 210);
  assert.equal(Math.round(back.s * 100), 50);
});

test('opacity: six digits at 100%, eight below; one spelling per colour', () => {
  assert.equal(withOpacity('#8a1c2b', 100), '#8a1c2b');
  assert.equal(withOpacity('#8a1c2b', 50), '#8a1c2b80');
  assert.equal(colourOpacity('#8a1c2b80'), 50);
  assert.equal(colourOpacity('#8a1c2b'), 100);
  assert.equal(hubElementColor('#8A1C2BFF'), '#8a1c2b', 'a fully opaque eight-digit colour is stored as six');
  assert.equal(hubElementColor('#8a1c2b80'), '#8a1c2b80');
  assert.equal(hubElementColor('#8a1c2b8'), null);
});

test('the contrast warning measures a see-through colour as it is SEEN over its ground', () => {
  assert.equal(hubColorOver('#00000080', '#ffffff'), '#7f7f7f');
  const solid = hubElementContrast('#000000', '#ffffff');
  const faint = hubElementContrast('#00000033', '#ffffff');
  assert.ok(solid.ok);
  assert.ok(!faint.ok, 'black at 20% on white is hard to read, and the warning says so');
});
