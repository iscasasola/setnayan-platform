/**
 * ⌨ ONE TAB STOP PER CONTROL (27 Nov 2026, MASTER-PLAN A1 + A2 — walkthrough W2-2 / W2-3: "the password eye",
 * "hidden file inputs are Tab stops; map Zoom +/−/© add 6 stops per venue").
 *
 *   1. An uploader: the hidden file input leaves the Tab order only where a visible button opens the picker; where a
 *      <label> is the only way in, the input stays the keyboard's way in.
 *   2. The pin map (event settings' venues, onboarding, the supplier's branches): the map is the one stop — it pans
 *      with the arrows and zooms with + / − — so Zoom in, Zoom out and the © link are not Tab stops.
 *   3. The Leaflet maps (the shop's service editor, open-shop's city pin): their corner links leave the Tab order.
 *   4. `ActionButton` takes `tabIndex={-1}` and puts it on the button.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAP_CORNER_CONTROLS, mapControlsLeaveTabOrder } from './map-controls-leave-tab-order';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('(1) an uploader is one Tab stop — the hidden input steps aside only beside a visible button', () => {
  const src = read('app/_components/file-upload.tsx');
  assert.match(src, /const inputBesideButton = thumbMode \|\| \(pillMode && items\.length > 0\);/);
  assert.match(src, /type="file"/);
  assert.match(src, /tabIndex=\{inputBesideButton \? -1 : undefined\}/, 'the hidden file input is a second Tab stop beside its button');
  // The two button modes really do open the picker from a visible button.
  assert.ok((src.match(/onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}/g) ?? []).length >= 2);
});

test('(2) the pin map is one Tab stop: its keys pan and zoom, so the corner controls are not stops', () => {
  const src = read('app/vendor-dashboard/_components/branch-pin-map.tsx');
  assert.match(src, /tabIndex=\{0\}\s*role="application"/, 'the map itself is no longer the keyboard stop');
  for (const k of ["case '+':", "case '-':", "case 'ArrowUp':"]) assert.ok(src.includes(k), `the map lost its ${k} key — the zoom buttons must come back to the Tab order`);
  assert.match(src, /label="Zoom in" onClick=\{\(\) => bumpZoom\(1\)\} className="!h-11 !w-11" tabIndex=\{-1\}/);
  assert.match(src, /label="Zoom out" onClick=\{\(\) => bumpZoom\(-1\)\} className="!h-11 !w-11" tabIndex=\{-1\}/);
  assert.match(src, /href="https:\/\/www\.openstreetmap\.org\/copyright"\s*target="_blank"\s*tabIndex=\{-1\}/);
});

test('(3) a Leaflet map’s corner links leave the Tab order', () => {
  for (const rel of ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'app/open-shop/_components/city-pin.tsx']) {
    assert.match(read(rel), /\}\)\.addTo\(map\);\s*mapControlsLeaveTabOrder\(map\.getContainer\(\)\);/, `${rel}: the zoom and credit links are Tab stops`);
  }
  assert.equal(MAP_CORNER_CONTROLS, '.leaflet-control a, .leaflet-control button');
  const els = [{ tabIndex: 0 }, { tabIndex: 0 }];
  let asked = '';
  mapControlsLeaveTabOrder({ querySelectorAll: (sel: string) => ((asked = sel), els) } as unknown as ParentNode);
  assert.equal(asked, MAP_CORNER_CONTROLS);
  assert.deepEqual(els.map((e) => e.tabIndex), [-1, -1]);
  assert.doesNotThrow(() => mapControlsLeaveTabOrder(null));
});

test('(4) ActionButton carries tabIndex={-1} to its button', () => {
  const src = read('components/action-button.tsx');
  assert.match(src, /tabIndex\?: -1;/);
  assert.match(src, /tabIndex=\{p\.tabIndex\}/);
});

test('(5) the ✕ that appears in every type box while typing is not a Tab stop — Tab goes box → box', () => {
  assert.match(read('components/clear-field.tsx'), /tabIndex=\{tabIndex\}/);
  assert.match(read('app/_components/global-clear-field.tsx'), /<ClearButton\s+label="Clear"\s+tabIndex=\{-1\}/, 'the app-wide ✕ sits between Email and Password in the Tab order');
});
