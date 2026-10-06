/**
 * A STYLE PICK REACHES THE CANVAS IN ONE RENDER OF THE PAGE — IN PLACE.
 *
 * Owner, live on iPhone 2026-10-06: Maker › Invitation › Countdown › Format ›
 * Style → "Big number", and the canvas kept the four boxes. Also: "When i
 * change palette style it still resets the page."
 *
 * MEASURED in the dev Maker lab with production's latencies
 * (`/dev/maker-lab?slow=1`). A scene style is a different component, so the
 * bridge cannot draw it. The save was UNHELD, so the only path to the canvas
 * was the whole-Maker render it owed (save, then a 3–6 s Maker render, then the
 * canvas page loading behind). Nothing changed for 20 s. Every Maker render
 * also mounted a NEW frame for each page frame (keyed on the render stamp), so
 * Look's page loaded from the top. With this fix the lab showed "Big number"
 * about 3 s after the tap: the same document, the same scroll, and no Maker
 * render.
 *
 *   1 · the pure core: ONE redraw after the LAST redraw save lands, none for a
 *       burst that saved nothing;
 *   2 · every pick the bridge cannot draw goes through `makerRedrawSave`: a
 *       scene's Style (and the Venue map switch beside it), the Dress code
 *       palette look, a fixed part's style, and a background that changes who
 *       draws the card;
 *   3 · the redraw reaches every page the Maker shows, IN PLACE: the canvas
 *       and its warm stages through the bridge's `router.refresh()`, and every
 *       page frame (Look, Hero, Reveal, a guided step, the RSVP page) keyed on
 *       its PAGE, never on a render stamp.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CANVAS_REFRESH_MESSAGE, MAKER_CANVAS_REDRAW_EVENT, createCanvasRedrawer } from '@/lib/maker-refresh';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ED = 'app/dashboard/[eventId]/website/editor/_components/';
const LAUNCH = 'app/dashboard/[eventId]/launch/_components/';

/** A promise and the hand that settles it. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const p = new Promise<T>((r) => (resolve = r));
  return { p, resolve };
}

// ── 1 · the pure core ───────────────────────────────────────────────────────

test('1 · ONE redraw, after the LAST redraw save in flight lands', async () => {
  let redraws = 0;
  const r = createCanvasRedrawer(() => (redraws += 1));
  const a = deferred<{ ok: boolean }>();
  const b = deferred<{ ok: boolean }>();
  const sa = r.save(() => a.p);
  const sb = r.save(() => b.p);
  assert.equal(r.inFlight(), 2);
  a.resolve({ ok: true });
  await sa;
  assert.equal(redraws, 0, 'redrew while a later pick was still on its way — it would draw the older page');
  b.resolve({ ok: true });
  await sb;
  assert.equal(redraws, 1, 'the burst did not end in exactly one redraw');
});

test('1 · a burst that saved nothing redraws nothing; one success in it still redraws', async () => {
  let redraws = 0;
  const r = createCanvasRedrawer(() => (redraws += 1));
  await r.save(async () => ({ ok: false }));
  assert.equal(redraws, 0, 'a refused save redrew the page');
  const a = deferred<{ ok: boolean }>();
  const sa = r.save(() => a.p);
  await r.save(async () => ({ ok: false }));
  a.resolve({ ok: true });
  await sa;
  assert.equal(redraws, 1);
  // A save that throws still lets the burst end.
  await assert.rejects(r.save(async () => Promise.reject(new Error('offline'))));
  assert.equal(r.inFlight(), 0);
});

// ── 2 · every pick the bridge cannot draw ───────────────────────────────────

test('2 · a scene canvas pick marked `redraw` is held and redrawn — never a Maker render', () => {
  const hook = code(`${ED}use-scene-canvas.ts`);
  assert.match(hook, /opts\.redraw\s*\?\s*await makerRedrawSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\)\)/);
  // The Maker's own copy stands in for the render it no longer waits for…
  assert.match(hook, /else if \(opts\.redraw\) noteDraftedCanvas\(widgetType, next, canvas\);/);
  // …and the Apply count comes back with the save (no render brings it).
  assert.match(hook, /if \(opts\.redraw\) fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);/, 'a held pick leaves the Apply count stale');
  // The redraw save IS a held save — dropped, it is the original bug (unheld → a whole-Maker render).
  const refresh = code('lib/maker-refresh.ts');
  assert.match(refresh, /return redrawer\.save\(\(\) => makerSave\(send, refresh, \{ held: true, ok \}\), ok\);/, 'makerRedrawSave is not held');
  const row = code(`${ED}scene-style-row.tsx`);
  const style = row.slice(row.indexOf('export function SceneStyleCanvasRow'), row.indexOf('export function PaletteLookCanvasRow'));
  assert.match(style, /useSceneCanvas\(eventId, widgetType, canvas, draftAction, undefined, \{ redraw: true \}\)/, 'a scene Style pick waits for a whole-Maker render');
  const palette = row.slice(row.indexOf('export function PaletteLookCanvasRow'));
  assert.match(palette, /\{ redraw: true \}/, 'a palette look pick waits for a whole-Maker render');
});

test('2 · a fixed part’s style and a background that redraws the card are redrawn too', () => {
  const fixed = code(`${ED}fixed-scene-style-row.tsx`);
  assert.match(fixed, /await makerRedrawSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\)\)/);
  assert.doesNotMatch(fixed, /await makerSave\(/);
  const bg = code(`${ED}scene-background-row.tsx`);
  assert.match(bg, /redrawsBox\s*\?\s*makerRedrawSave\(/);
  // …and the shell holds it rather than reloading the canvas for a Maker render.
  const shell = code(`${ED}editor-shell.tsx`);
  const row = shell.slice(shell.indexOf('<SceneBackgroundRow'), shell.indexOf('/>', shell.indexOf('<SceneBackgroundRow')));
  assert.doesNotMatch(row, /releaseCanvas\(\)/, 'a box change still reloads the canvas through a Maker render');
});

// ── 3 · in place, everywhere the Maker shows a page ─────────────────────────

test('3 · the canvas and its warm stages re-render themselves in place', () => {
  assert.deepEqual(CANVAS_REFRESH_MESSAGE, { source: 'setnayan-editor', t: 'refresh' });
  const shell = code(`${ED}editor-shell.tsx`);
  assert.match(shell, /window\.addEventListener\(MAKER_CANVAS_REDRAW_EVENT, redraw\)/);
  const redraw = shell.slice(shell.indexOf('const redraw = () => {'), shell.indexOf('window.addEventListener(MAKER_CANVAS_REDRAW_EVENT'));
  assert.match(redraw, /broadcastToCanvasRef\.current\(CANVAS_REFRESH_MESSAGE\)/, 'the redraw must reach the shown frame AND the warm stages');
  assert.match(redraw, /if \(makerUnheldSavesInFlight\(\) === 0\) canvasHold\.current = holdChange\(/, 'a redraw must not hold the canvas over an unheld write still on its way');
  const bridge = code('app/[slug]/_components/editor-bridge.tsx');
  const branch = bridge.slice(bridge.indexOf("data.t === 'refresh'"), bridge.indexOf("data.t === 'sceneBg'"));
  assert.match(branch, /routerRef\.current\.refresh\(\);/, 'the page does not re-render itself');
  assert.doesNotMatch(branch, /location\.reload|location\.href|location\.assign/, 'a reload loses the place on the page');
  assert.equal(MAKER_CANVAS_REDRAW_EVENT, 'setnayan:maker-canvas-redraw');
});

test('3 · a page frame is keyed on its PAGE — a Maker render or a redraw refreshes it in place', () => {
  const frame = code(`${LAUNCH}maker-page.tsx`);
  const fn = frame.slice(frame.indexOf('export function MakerPageFrame'), frame.indexOf('export function MakerPageSwitch'));
  assert.match(fn, /w\.postMessage\(CANVAS_REFRESH_MESSAGE, window\.location\.origin\)/);
  assert.match(fn, /window\.addEventListener\(MAKER_CANVAS_REDRAW_EVENT, onRedraw\)/);
  assert.match(fn, /if \(refreshOn === undefined \|\| lastRefresh\.current === refreshOn\) return;/);
  // A page with no bridge to ask is still loaded again — never left stale.
  assert.match(fn, /else setReload\(\(n\) => n \+ 1\);/);
  // Every user: no render stamp in a frame key; the stamp rides `refreshOn`.
  const users = [code(`${LAUNCH}details-look-pages.tsx`), code(`${LAUNCH}maker-page.tsx`)].join('\n');
  const keys = [...users.matchAll(/<MakerPageFrame[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(keys.length >= 5, `only ${keys.length} MakerPageFrame mounts found — the scan is not reading them`);
  for (const k of keys) {
    assert.doesNotMatch(k, /frameKey=\{`[^`]*(renderStamp|stamp)\}`\}/, `a frame keyed on a render stamp loads from the top on every save:\n${k}`);
    assert.match(k, /refreshOn=\{/, `a page frame that never refreshes:\n${k}`);
  }
  assert.match(users, /const frameKey = `\$\{item\}:\$\{src\}`;/);
});
