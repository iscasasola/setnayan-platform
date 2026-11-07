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
 *   5. The circle shows the BARE picture — one <img> and nothing drawn over it (controller review of logo-390, 7 Nov:
 *      dashed lines + a dotted corner read as keypad leftovers; they were the lab fixture's own pixels, and this
 *      line keeps the control honest either way).
 *   6. ONE picture per logo surface: the upload under the circle draws no second picture — only
 *      `[Replace photo] [Remove]` (`pills`), Remove in the danger tone, the shipped "verified" line only until saved.
 *   7. The server scans for a QR once per PICTURE, not once per frame move — decided from the stored row, never a form flag.
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

test('5 · the circle shows the bare picture — one <img>, nothing drawn over it', () => {
  const open = CONTROL.indexOf('data-picture-frame-circle=""');
  assert.ok(open > 0, 'the circle lost its anchor');
  const body = CONTROL.slice(open, CONTROL.indexOf('</div>', open));
  assert.equal(count(body, /<[A-Za-z]/), 1, 'something besides the picture is drawn inside the circle');
  assert.equal(count(body, /<img\b/), 1);
  assert.doesNotMatch(body, /dashed|dotted|grid|::before|::after|backgroundImage|linear-gradient|conic-gradient/i, 'an overlay is drawn on the circle');
  assert.doesNotMatch(CONTROL, /border-dashed|border-dotted|borderStyle: 'dashed'|borderStyle: 'dotted'/, 'a guide line is drawn in the framer');
  // The lab frames a real photo (v21's own), never a screenshot that carries another screen's guides.
  assert.doesNotMatch(read('app/dev/open-shop-lab/page.tsx'), /feature-shots\/logo-maker/);
});

test('6 · one picture per logo surface: the upload is `[Replace photo] [Remove]`, no second preview', () => {
  // My Shop's row file holds every field's editor — read only the logo's.
  const logoPart = (src: string) =>
    src.includes('function LogoRowControl') ? src.slice(src.indexOf('function LogoRowControl'), src.indexOf('function FieldControl')) : src;
  for (const [name, whole] of LOGO_SURFACES) {
    const src = logoPart(whole);
    assert.ok(src.length > 200, `${name}: the logo editor moved`);
    assert.match(src, /roundPreview\s+pills=\{\{ replace: 'Replace photo' \}\}/, `${name} draws a second picture under the circle`);
    assert.doesNotMatch(src, /\brow=\{/, `${name} still draws the 72 px file row`);
    // The framer comes first: the circle, then the upload's pills.
    assert.ok(src.indexOf('<PictureFrameControl') < src.indexOf('<FileUpload'), `${name} draws the upload above the circle`);
  }
  const upload = read('app/_components/file-upload.tsx');
  assert.match(upload, /const pillMode = pills != null && roundPreview && variant === 'square' && !multiple;/);
  assert.match(upload, /isSingleImagePreview && !rowMode && !pillMode/, 'pill mode still draws the big preview');
  assert.match(upload, /<ActionButton\s+tone="neutral"\s+icon=\{ImagePlus\}\s+label=\{pills!\.replace\}/);
  assert.match(upload, /<ActionButton\s+tone="danger"\s+icon=\{Trash2\}\s+label="Remove"/, 'Remove is not the danger tone');
  assert.match(upload, /const currentCount = \(pillMode(?: \|\| thumbMode)? \? 0 : items\.length\) \+ inFlight\.length;/, 'Replace is refused as "already have one file"');
  // Remove saves on its own too; the shipped "verified" line is one line, only until a logo is in.
  assert.match(LOGO_SCREEN, /else saveSoon\(\{ ref: '', frame: DEFAULT_LOGO_FRAME \}, true\);/, 'Remove does not save');
  assert.match(LOGO_SCREEN, /\{hasSaved \? null : \(\s*<span className="block text-xs"[^>]*>\s*\{LOGO_LATER\.hint\}/);
  assert.equal(count(LOGO_SCREEN, /LOGO_LATER\.hint/), 1);
});

test('7 · the QR scan runs once per picture — a frame-only save skips it, decided from the stored row', async () => {
  const { logoNeedsQrScan } = await import('../../lib/open-shop-logo');
  assert.equal(logoNeedsQrScan('r2://media/a.png', 'r2://media/a.png'), false, 'a frame move re-scans');
  assert.equal(logoNeedsQrScan('r2://media/b.png', 'r2://media/a.png'), true, 'a new picture skips the scan');
  assert.equal(logoNeedsQrScan('r2://media/a.png', null), true, 'a first logo skips the scan');
  assert.equal(logoNeedsQrScan('r2://media/a.png', undefined), true, 'a failed read skips the scan');
  assert.equal(logoNeedsQrScan(null, 'r2://media/a.png'), false);
  const actions = read('app/vendor-dashboard/actions.ts');
  const start = actions.indexOf("case 'logo': {");
  const logoCase = actions.slice(start, actions.indexOf('break;', start));
  assert.match(logoCase, /\.from\('vendor_profiles'\)\s*\.select\('logo_url'\)\s*\.eq\('vendor_profile_id', shopId\)/);
  assert.match(logoCase, /if \(logoNeedsQrScan\(logoRef, storedLogo\) && \(await vendorQrGuardRejects\(\[logoRef\]\)\)\)/);
  assert.equal(count(logoCase, /vendorQrGuardRejects\(/), 1);
  assert.doesNotMatch(logoCase, /formData\.get\('(?!logo_url')/, 'the skip trusts a form field');
});

