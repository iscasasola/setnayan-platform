/**
 * lib/body-panel.test.ts — the in-body panel's box and clip frames (Build 2 §10 #33 · #40, lane B2-B).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyPanelBox, panelClip } from './body-panel';

test('the box sits between the top bar and the bottom nav, across the page column', () => {
  const box = bodyPanelBox({ vw: 375, vh: 812, topBarBottom: 56, dockTop: 740, frame: { left: 0, width: 375 } });
  assert.deepEqual(box, { top: 56, left: 0, width: 375, height: 684 });
});

test('no bar on screen → the panel runs to the edge it would have stopped at', () => {
  assert.deepEqual(bodyPanelBox({ vw: 375, vh: 812, topBarBottom: null, dockTop: null, frame: null }), { top: 0, left: 0, width: 375, height: 812 });
});

test('never a negative box — a bar past the viewport clamps', () => {
  const box = bodyPanelBox({ vw: 375, vh: 812, topBarBottom: 900, dockTop: 100, frame: { left: -20, width: 999 } });
  assert.equal(box.height, 0);
  assert.equal(box.left, 0);
  assert.equal(box.width, 375);
});

test('a wide screen: the panel keeps to the column', () => {
  const box = bodyPanelBox({ vw: 1280, vh: 800, topBarBottom: 64, dockTop: null, frame: { left: 256, width: 768 } });
  assert.deepEqual(box, { top: 64, left: 256, width: 768, height: 736 });
});

test('the clip starts on the tapped tile and ends on the whole body', () => {
  const box = { top: 56, left: 0, width: 375, height: 684 };
  assert.equal(panelClip({ top: 300, left: 16, width: 166, height: 104 }, box), 'inset(244px 193px 336px 16px round 16px)');
  assert.equal(panelClip(null, box), 'inset(0px 0px 0px 0px round 0px)');
});

test('a tile half under the top bar starts from where it shows (insets clamp at 0)', () => {
  const box = { top: 56, left: 0, width: 375, height: 684 };
  assert.match(panelClip({ top: 20, left: 16, width: 166, height: 104 }, box), /^inset\(0px /);
});
