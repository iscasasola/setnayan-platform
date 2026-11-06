/**
 * GUARD — THE LOGO IS FRAMED BY HAND (owner 7 Nov, prototype v21 `open_shop_redesign_2026-11-06/open-shop-redesign.html`,
 * the logo step; plan PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07 track A3): *"drag and pinch to zoom"*, *"change and save
 * automatically"*.
 *
 *   1. The keypad is GONE — the Maker's 9-point grid ("Keep area N of 9 in frame") and its "How close" menu were the
 *      first cut (#7345); no logo surface may bring them back.
 *   2. Every logo surface frames through ONE shared control, `app/_components/picture-frame-control.tsx` — anchored PER
 *      SURFACE with a count, so a second, private framer cannot hide behind a file-level match. The profile picture
 *      (A4, #7353) is meant to mount the same control.
 *   3. The control is the gesture the owner asked for: pointer drag + two-finger pinch on the circle (touch-action:
 *      none on the circle only), a non-passive wheel, and − · slider · + over the SAME bounds the store accepts.
 *   4. "Add your logo" saves on its own after a finished change and says ONE "Logo saved" — no Save button.
 *
 * Source-reading, comments stripped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../../lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const CONTROL_PATH = 'app/_components/picture-frame-control.tsx';
const CONTROL = read(CONTROL_PATH);
const LOGO_SCREEN = read('app/open-shop/logo/_components/add-your-logo.tsx');
const MY_SHOP_ROW = read('app/vendor-dashboard/shop/_components/editable-row.tsx');

/** Each surface where a person frames their logo — and how many shared framers it must mount. */
const LOGO_SURFACES: Array<[string, string]> = [
  ['"Add your logo" (/open-shop/logo)', LOGO_SCREEN],
  ['My Shop’s logo row', MY_SHOP_ROW],
];

test('1 · the keypad is gone — no 9-point grid, no "How close" menu, no first-cut control file', () => {
  assert.equal(existsSync(join(WEB, 'app/_components/logo-frame-control.tsx')), false, 'the keypad control file is back');
  for (const [name, src] of [...LOGO_SURFACES, ['the shared control', CONTROL] as [string, string]]) {
    assert.doesNotMatch(src, /HUB_FOCAL_POINTS|HUB_ZOOMS|focalToObjectPosition/, `${name} reads the Maker’s keypad sets`);
    assert.doesNotMatch(src, /Keep area|of 9 in frame/, `${name} draws the keypad`);
    assert.doesNotMatch(src, /How close/, `${name} draws the zoom menu`);
    assert.doesNotMatch(src, /LogoFrameControl/, `${name} mounts the first-cut control`);
  }
  assert.doesNotMatch(read('lib/open-shop-logo.ts'), /hub-canvas/, 'the logo frame went back to the Maker’s 9-point sets');
});

test('2 · each logo surface mounts the ONE shared framer, exactly once', () => {
  for (const [name, src] of LOGO_SURFACES) {
    assert.match(src, /import \{ PictureFrameControl \} from '@\/app\/_components\/picture-frame-control';/, `${name} imports another framer`);
    assert.equal(count(src, /<PictureFrameControl\b/), 1, `${name} should mount the shared framer once`);
  }
});

test('3 · the gesture: drag + pinch on the circle only, a non-passive wheel, − · slider · + over the stored bounds', () => {
  assert.match(CONTROL, /touchAction: 'none'/);
  assert.match(CONTROL, /onPointerDown=\{onPointerDown\}[\s\S]{0,120}onPointerMove=\{onPointerMove\}[\s\S]{0,120}onPointerUp=\{onPointerUp\}/);
  assert.match(CONTROL, /s\.pts\.size === 2/, 'two fingers do not pinch');
  assert.match(CONTROL, /zoomPictureFrameAt\(/);
  assert.match(CONTROL, /panPictureFrame\(/);
  assert.match(CONTROL, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/);
  assert.match(CONTROL, /type="range"\s+min=\{PICTURE_ZOOM_MIN\}\s+max=\{PICTURE_ZOOM_MAX\}/);
  assert.match(CONTROL, /<ActionButton\s+tone="neutral"\s+icon=\{Minus\}\s+label="Zoom out"/);
  assert.match(CONTROL, /<ActionButton\s+tone="neutral"\s+icon=\{Plus\}\s+label="Zoom in"/);
  assert.match(CONTROL, /prefers-reduced-motion: reduce/, 'the reset glide ignores reduced motion');
  // The bounds the slider uses are the bounds the reader and the CHECKs use.
  const lib = read('lib/picture-frame.ts');
  assert.match(lib, /export const PICTURE_ZOOM_MIN = 100;/);
  assert.match(lib, /export const PICTURE_ZOOM_MAX = 300;/);
  const mig = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271316444107_shop_logo_focal_and_zoom.sql'), 'utf8');
  assert.match(mig, /logo_zoom IS NULL OR logo_zoom BETWEEN 100 AND 300/);
  assert.match(mig, /logo_focal_x IS NULL OR logo_focal_x BETWEEN 0 AND 100/);
  assert.match(mig, /logo_focal_y IS NULL OR logo_focal_y BETWEEN 0 AND 100/);
});

test('4 · "Add your logo" saves on its own after a finished change, and says one "Logo saved" — no Save button', () => {
  assert.match(LOGO_SCREEN, /const SAVE_AFTER_MS = 600;/);
  assert.match(LOGO_SCREEN, /onCommit=\{\(f\) => saveSoon\(\{ frame: f \}\)\}/);
  assert.match(LOGO_SCREEN, /if \(next\) saveSoon\(\{ ref: next, frame: latest\.current\.frame \}\)/, 'a finished upload does not save');
  assert.match(LOGO_SCREEN, /startTransition\(\(\) => save\(form\)\)/);
  assert.match(LOGO_SCREEN, /savedLabel="Logo saved"/);
  assert.match(LOGO_SCREEN, /status=\{status\}/);
  assert.equal(count(LOGO_SCREEN, /Logo saved/), 1, 'the saved line is said more than once');
  assert.doesNotMatch(LOGO_SCREEN, /SubmitButton|Save logo/, 'a Save button came back');
  assert.match(LOGO_SCREEN, /unsavedHint=\{null\}/, 'the upload still claims it waits for a button');
  // The status is drawn in ONE place, by the control, live.
  assert.equal(count(CONTROL, /aria-live="polite"/), 1);
});
