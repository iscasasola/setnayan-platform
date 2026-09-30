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
 *   5 · the canvas keeps its place in the tree (moving an iframe reloads it);
 *   6 · the PAIR fits the room the row actually has — scenes list and inspector
 *       open or closed, at 1024 / 1280 / 1440 / 1920 — and never scrolls
 *       sideways (owner 2026-09-30: *"the desktop and mobile on view must adjust
 *       on the screen showing both side to side just exceeded the screen"*).
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
  BOTH_DESKTOP_HEIGHT,
  BOTH_DESKTOP_WIDTH,
  BOTH_PHONE_HEIGHT,
  BOTH_PHONE_MIN_SCALE,
  BOTH_PHONE_WIDTH,
  bothLayout,
  scaledFrame,
} from '../app/dashboard/[eventId]/website/editor/_components/both-view';
import { INSPECTOR_DEFAULT_W, INSPECTOR_MAX_W } from '../app/dashboard/[eventId]/website/editor/_components/tools-resize';

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

test('2 · the desktop is drawn at 1280 × 800 and the phone at 390 × 844, each scaled into its box', () => {
  assert.equal(BOTH_DESKTOP_WIDTH, 1280);
  assert.equal(BOTH_DESKTOP_HEIGHT, 800);
  assert.equal(BOTH_PHONE_WIDTH, 390);
  assert.equal(BOTH_PHONE_HEIGHT, 844);
  const fit = bothLayout(1000, 700)!;
  assert.ok(fit, 'a 1000 × 700 row holds both');
  // Each keeps its shape: the box is the drawn size times the scale.
  for (const f of [fit.desktop, fit.phone]) {
    assert.ok(Math.abs(f.boxWidth - f.width * f.scale) < 1 && Math.abs(f.boxHeight - f.height * f.scale) < 1);
  }
  assert.equal(fit.desktop.width, 1280);
  assert.equal(fit.phone.width, 390);
  // A row with room to spare draws the desktop at scale 1, wider than 1280 — never stretched.
  const big = bothLayout(2600, 1100)!;
  assert.equal(big.desktop.scale, 1);
  assert.ok(big.desktop.width > 1280 && big.desktop.boxWidth === big.desktop.width);
  assert.equal(big.phone.scale, 1, 'the phone is never drawn larger than a phone');
  assert.equal(bothLayout(0, 500), null, 'an unmeasured row is not scaled to nothing');
  assert.equal(bothLayout(500, 0), null);
  // The frames are drawn at their own size and scaled from the top-left.
  assert.deepEqual(scaledFrame({ width: 1280, height: 800, scale: 0.5, boxWidth: 640, boxHeight: 400 }), {
    position: 'absolute', left: 0, top: 0, width: 1280, height: 800, transform: 'scale(0.5)', transformOrigin: '0 0',
  });
  assert.match(frameWith('frameRef={frameRef}'), /style=\{bothFit \? scaledFrame\(bothFit\.desktop\) : undefined\}/, 'the canvas is scaled in Both');
  assert.match(frameWith('frameRef={bothFrameRef}'), /style=\{bothFit \? scaledFrame\(bothFit\.phone\) : undefined\}/, 'the phone is scaled in Both');
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
  assert.match(WORK, /\{both \? \(\s*<div\s+data-maker-both-phone=""/, 'the phone pane is mounted only under `both`');
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

/**
 * The room the canvas row has in a Maker window `win` px wide and `tall` px
 * high: the scenes list (168 px) and the inspector (`INSPECTOR_DEFAULT_W`)
 * when open, the section's `lg:px-6` (24 + 24), and — vertically — the Maker's
 * toolbar, the section's `lg:pt-4 lg:pb-5` and the Event Bar row under the
 * canvas. Approximate chrome; the assertion is on what `bothLayout` returns
 * for it, and the real row is MEASURED in the shell.
 */
function rowRoom(win: number, tall: number, nav: boolean, tools: boolean, toolsW = INSPECTOR_DEFAULT_W) {
  return { width: win - (nav ? 168 : 0) - (tools ? toolsW : 0) - 48, height: tall - 52 - 36 - 32 };
}

test('6 · the pair never exceeds the room — 1024 / 1280 / 1440 / 1920, scenes list and inspector open or closed', () => {
  const windows: Array<[number, number]> = [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]];
  const fits: string[] = [];
  for (const [win, tall] of windows) {
    for (const nav of [true, false]) {
      for (const tools of [true, false]) {
        for (const toolsW of tools ? [INSPECTOR_DEFAULT_W, INSPECTOR_MAX_W] : [0]) {
          const room = rowRoom(win, tall, nav, tools, toolsW);
          const fit = bothLayout(room.width, room.height);
          const at = `${win}×${tall} list ${nav ? 'open' : 'closed'} · inspector ${tools ? `open ${toolsW}` : 'closed'} (row ${room.width}×${room.height})`;
          if (!fit) continue; // Desktop is drawn instead — nothing beside it to overflow.
          fits.push(at);
          const total = fit.desktop.boxWidth + fit.gap + fit.phone.boxWidth;
          assert.ok(total <= room.width, `${at}: the pair is ${total} px in a ${room.width} px row`);
          assert.ok(fit.desktop.boxHeight <= room.height && fit.phone.boxHeight <= room.height, `${at}: taller than the row`);
          assert.ok(fit.phone.scale >= BOTH_PHONE_MIN_SCALE, `${at}: the phone is too small to read`);
        }
      }
    }
  }
  // Both is not "fitted" by never being drawn: these must hold the pair.
  for (const must of [
    '1280×800 list open · inspector open 340',
    '1280×800 list closed · inspector closed',
    '1440×900 list open · inspector open 340',
    '1920×1080 list open · inspector open 340',
    '1024×768 list closed · inspector closed',
  ]) {
    assert.ok(fits.some((f) => f.startsWith(must)), `${must}: Both should be drawn, not fall back`);
  }
  // A row too small for two readable frames draws Desktop (null), never a squeeze.
  assert.equal(bothLayout(468, 648), null, '1024 with the list and inspector open is Desktop');
});

test('6b · the shell measures the ROW and sizes both boxes from it — nothing drawn at 1280 widens the page', () => {
  // The section may shrink below its content: a 1280 px frame inside it once made
  // its min-content width 1280 + phone, and pushed the pair off the screen.
  assert.match(WORK, /aria-label="Preview"[\s\S]{0,120}className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col/);
  assert.match(WORK, /const bothRow = usePaneSize\(bothRowRef, view === 'both'\);/);
  assert.match(WORK, /const bothFit = view === 'both' && bothRow \? bothLayout\(bothRow\.width, bothRow\.height\) : null;/);
  assert.match(WORK, /const both = bothFit !== null;/, 'a row too small for Both draws Desktop');
  assert.match(WORK, /ref=\{bothRowRef\}\s*data-maker-both=\{both/, 'the measured element is the row itself');
  assert.match(WORK, /style=\{bothFit \? \{ width: bothFit\.desktop\.boxWidth, height: bothFit\.desktop\.boxHeight \} : undefined\}/);
  assert.match(WORK, /style=\{bothFit \? \{ width: bothFit\.phone\.boxWidth, height: bothFit\.phone\.boxHeight \} : undefined\}/);
  // Both boxes are fixed and clip their scaled frame; neither grows with the page drawn inside.
  const desk = WORK.slice(WORK.indexOf('data-maker-both-desktop='), WORK.indexOf('<BufferedCanvasFrame'));
  assert.match(desk, /'relative shrink-0 overflow-hidden/);
  const phone = WORK.slice(WORK.indexOf('data-maker-both-phone=""'), WORK.indexOf('frameRef={bothFrameRef}'));
  assert.match(phone, /className="relative shrink-0 overflow-hidden/);
  // The fallback is said, not silent.
  assert.match(WORK, /\{bothTooNarrow \? \(\s*<p data-maker-both-too-narrow=""/);
});
