/**
 * the-maker-both-view-is-live.test.ts — VIEW ▾ BOTH: THE PHONE AND THE DESKTOP,
 * SIDE BY SIDE, FROM ONE DRAFT, THROUGH ONE MECHANISM.
 *
 * DECISION_LOG 2026-09-28 ("THE MAKER'S TOOLBARS ARE BUILT AFTER KEYNOTE +
 * PAGES"): *"View ▾ (Desktop · Phone · Both)"*. #6075 hid "Both" because it was
 * not built; this holds the build:
 *
 *   1 · the menu offers Both only at 1024 px and wider, and a narrowed window
 *       draws Desktop (the pick kept) — never a second pane on a small screen;
 *   2 · the desktop is drawn at 1280 px and scaled to its pane;
 *   3 · the phone pane is ONE more buffered frame of the SAME address, keyed on
 *       the SAME held stamp, reached by the SAME broadcast — and it holds no
 *       warm stages of its own (one extra frame, only while Both is on);
 *   4 · a tap in either pane selects the same part in the other;
 *   5 · the canvas keeps its place in the tree (moving an iframe reloads it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  makerShownDevice,
  makerViewOptions,
  isMakerDevice,
  MAKER_BOTH_MIN_WIDTH,
} from '../app/dashboard/[eventId]/launch/_components/maker-bar';
import {
  BOTH_DESKTOP_WIDTH,
  BOTH_PHONE_WIDTH,
  bothDesktopFit,
} from '../app/dashboard/[eventId]/website/editor/_components/both-view';

const WEB = join(__dirname, '..');
const WORK = stripComments(
  readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
);

/** The JSX of the `<BufferedCanvasFrame … />` whose props include `marker`. */
function frameWith(marker: string): string {
  const frames = WORK.split('<BufferedCanvasFrame').slice(1).map((s) => s.slice(0, s.indexOf('/>')));
  const hit = frames.filter((f) => f.includes(marker));
  assert.equal(hit.length, 1, `exactly one canvas frame carries ${marker} (found ${hit.length})`);
  return hit[0]!;
}

test('1 · Both is offered only at 1024 px and wider; narrower, Both is drawn as Desktop', () => {
  assert.equal(MAKER_BOTH_MIN_WIDTH, 1024);
  assert.deepEqual(makerViewOptions(true).map((o) => o.label), ['Desktop', 'Phone', 'Both']);
  assert.deepEqual(makerViewOptions(false).map((o) => o.label), ['Desktop', 'Phone']);
  assert.equal(makerShownDevice('both', true), 'both');
  assert.equal(makerShownDevice('both', false), 'desktop', 'a narrow window never draws a second pane');
  assert.equal(makerShownDevice('phone', false), 'phone');
  assert.equal(makerShownDevice('desktop', true), 'desktop');
  for (const v of ['desktop', 'phone', 'both']) assert.equal(isMakerDevice(v), true);
  for (const v of ['tablet', '', null, undefined, 3]) assert.equal(isMakerDevice(v), false);
  // The shell hands the canvas what it SHOWS, and reads the width from the one hook.
  const shell = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx'), 'utf8'),
  );
  assert.match(shell, /const wide = useIsDesktop\('lg'\);/);
  assert.match(shell, /const shownDevice = makerShownDevice\(device, wide\);/);
  assert.match(shell, /device: shownDevice,/, 'the context carries the view the canvas shows');
});

test('2 · the desktop is drawn at 1280 px and scaled to fit its pane', () => {
  assert.equal(BOTH_DESKTOP_WIDTH, 1280);
  assert.equal(BOTH_PHONE_WIDTH, 390);
  assert.deepEqual(bothDesktopFit(640, 400), { width: 1280, height: 800, scale: 0.5 });
  // A pane wider than 1280 draws the page at its own width — never stretched.
  assert.deepEqual(bothDesktopFit(1500, 700), { width: 1500, height: 700, scale: 1 });
  assert.equal(bothDesktopFit(0, 500), null, 'an unmeasured pane is not scaled to nothing');
  assert.equal(bothDesktopFit(500, 0), null);
  assert.match(WORK, /const deskFit = both && deskPane \? bothDesktopFit\(deskPane\.width, deskPane\.height\) : null;/);
  const canvas = frameWith('frameRef={frameRef}');
  assert.match(canvas, /transform: `scale\(\$\{deskFit\.scale\}\)`/, 'the canvas is scaled in Both');
});

test('3 · the phone pane is one more buffered frame of the same address, held stamp and broadcast — never warm', () => {
  assert.equal((WORK.match(/<BufferedCanvasFrame\b/g) ?? []).length, 2, 'the canvas and the phone pane — no third');
  const canvas = frameWith('frameRef={frameRef}');
  const phone = frameWith('frameRef={bothFrameRef}');
  // Same address, same key — a held pick reloads neither; a release reloads both, buffered.
  assert.match(phone, /frameKey=\{`\$\{stage\}:\$\{canvasStamp\}:\$\{maker\.viewAsHref \?\? ''\}`\}/);
  assert.equal(
    phone.match(/frameKey=\{[^}]*\}[^}]*\}/)?.[0],
    canvas.match(/frameKey=\{[^}]*\}[^}]*\}/)?.[0],
    'the phone pane is keyed exactly as the canvas',
  );
  assert.match(phone, /src=\{canvasSrc\}/);
  assert.doesNotMatch(phone, /renderStamp/, 'a key on renderStamp reloads the phone on every element save');
  // ⚖ One extra frame: no warm stages of its own, on any device.
  assert.doesNotMatch(phone, /\bwarm(Max|Gen)?=/, 'the phone pane holds no warm stages');
  // The same broadcast: every pick the bridge draws reaches it.
  assert.match(phone, /broadcastRef=\{bothBroadcast\}/);
  const bc = WORK.slice(WORK.indexOf('const broadcastToCanvas = (message: unknown) => {'));
  assert.match(bc.slice(0, bc.indexOf('};')), /bothBroadcast\.current\?\.\(message\);/, 'broadcastToCanvas skips the phone pane');
  // Only while Both is on, and guarded like the canvas.
  assert.match(WORK, /\{both \? \(\s*<div data-maker-both-phone=""/, 'the phone pane is mounted only under `both`');
  assert.ok(
    WORK.indexOf('data-maker-both-phone') < WORK.indexOf('frameRef={bothFrameRef}'),
    'the phone frame lives inside the pane mounted only under `both`',
  );
  assert.match(WORK, /<CanvasStaysOnThePage\s+frameRef=\{bothFrameRef\}/, 'the phone pane never shows a page that is not the couple’s');
});

test('4 · a tap in either pane selects the same part in the other; the phone is re-marked like the canvas', () => {
  assert.match(
    WORK,
    /for \(const f of \[frameRef\.current, bothFrameRef\.current\]\) \{\s*const w = f\?\.contentWindow;\s*if \(w && w !== except\) w\.postMessage/,
  );
  const edit = WORK.slice(WORK.indexOf("data.t !== 'edit'"), WORK.indexOf("const match = Object.entries(rows)"));
  assert.ok(edit.length > 200, 'found the canvas tap handler');
  assert.match(edit, /postToShownCanvases\(\s*\{ source: 'setnayan-editor', t: 'markEl', key: data\.key, el: typeof data\.el === 'string' \? data\.el : null \},\s*event\.source,\s*\)/);
  assert.match(edit, /postToShownCanvases\(\{ source: 'setnayan-editor', t: 'scrollTo', key: data\.key \}, event\.source\)/);
  // The navigator's tile and the part sheet reach both panes.
  const scroll = WORK.slice(WORK.indexOf('const scrollPreviewTo = useCallback('));
  assert.match(scroll.slice(0, 300), /postToShownCanvases\(\{ source: 'setnayan-editor', t: 'scrollTo', key: anchor \}\)/);
  assert.match(WORK, /onPart=\{\(el\) => \{\s*postToShownCanvases\(/);
  // The phone's own ready / swap re-marks it (its ready never feeds the tiles or the Event Bar).
  assert.match(frameWith('frameRef={bothFrameRef}'), /onSwapped=\{\(\) => reMarkBoth\(false\)\}/);
  assert.match(WORK, /if \(!w \|\| event\.source !== w\) return;[\s\S]{0,200}reMarkBoth\(true\);/);
});

test('5 · the canvas keeps its place in the tree in every view — Both re-sizes it, never moves it', () => {
  const canvas = frameWith('frameRef={frameRef}');
  // One canvas element (`frameWith` holds exactly one), mounted unconditionally
  // inside the row: nothing between the row and the canvas renders conditionally.
  const row = WORK.indexOf('data-maker-both={both');
  const at = WORK.indexOf('<BufferedCanvasFrame');
  assert.ok(row > 0 && at > row, 'the canvas sits inside the Both row');
  assert.doesNotMatch(WORK.slice(row, at), /\? \(|&& \(|\? <|&& </, 'the canvas is rendered conditionally — a view change would remount it');
  assert.match(canvas, /className=\{\s*both\s*\?/, 'the view changes the canvas’s box, not its element');
  // The tiles are pictures of the canvas — in Both, the desktop.
  assert.match(WORK, /const device: 'desktop' \| 'phone' = view === 'phone' \? 'phone' : 'desktop';/);
  assert.match(WORK, /initialView=\{view\}/, 'the scene templates open in the view being edited, Both included');
});
