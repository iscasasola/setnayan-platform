/**
 * a-risen-screen-owns-the-status-row.test.ts — 📱 THE DYNAMIC ISLAND ROW IS THE SCREEN'S OWN COLOUR (owner 18 Nov 2026,
 * on his iPhone, the supplier's "Your page" risen from a Today task: *"why is the dynamic island row blacked out. it
 * should look continuous"*).
 *
 * The app runs with `viewportFit: 'cover'`, so a full-screen part must reach under the status bar and pad its own head
 * by the inset — then the row above its title is ITS colour. Measured in the iOS simulator's Safari (static
 * reproduction of the rise, 18 Nov): the black was the grow's DIM — a `position: fixed; inset: 0; background: #000`
 * layer that lived 320 ms at 18 %. WebKit colours the system's edge bands from the FIXED layers that reach the screen's
 * edges; it read that layer's black whatever its opacity and kept it after the layer was removed. The same dim drawn
 * `absolute` over the same box left the band the risen screen's cream.
 *
 * Held here, for every full-screen part that rises (`RiseScreen`, the picked client's shell):
 *   1. it is fixed to all four edges, on its own solid ground;
 *   2. its head pads `env(safe-area-inset-top)` and paints that row in the head's own ground;
 *   3. the grow's end state is the whole screen — inset 0 on every side — so the shape covers the inset;
 *   4. nothing the rise adds is a FIXED black layer: the dim is not `position: fixed`;
 *   5. the page still declares `viewportFit: 'cover'` and a light `theme-color` (the home-screen app's status bar is
 *      `default`, never `black`).
 *
 * 🛡 SABOTAGE (seen RED once each, 2026-11-18, then restored): `RISE_DIM_BOX`'s `position:absolute` → `position:fixed`
 * (4) · `pt-[env(safe-area-inset-top)]` removed from RiseScreen's head (2) · RiseScreen's root `inset-0` → `inset-x-0
 * bottom-0 top-[env(safe-area-inset-top)]` (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { RISE_DIM_BOX, RISE_FULL_CLIP, riseScreenMotion } from '@/lib/rise-screen';
import { THEME_COLOR } from '@/lib/appearance';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCREEN = code('app/_components/rise/rise-screen.tsx');
const PICKED = code('app/_components/picked/picked-shell.tsx');

test('1 · every risen full screen is fixed to all four edges, on its own solid ground', () => {
  assert.match(SCREEN, /className="fixed inset-0 z-sn-pop flex h-\[100dvh\] flex-col bg-cream /, 'RiseScreen no longer reaches the top edge on its own ground');
  assert.match(PICKED, /className="fixed inset-0 flex h-\[100dvh\] flex-col bg-cream /, 'the picked client no longer reaches the top edge on its own ground');
  for (const [name, src] of [['RiseScreen', SCREEN], ['the picked client', PICKED]] as const) {
    assert.doesNotMatch(src, /top-\[env\(safe-area-inset-top\)\]|mt-\[env\(safe-area-inset-top\)\]/, `${name} starts BELOW the status row — the row above it is whatever lies behind`);
  }
});

test('2 · its head pads the inset and paints that row in the head’s own ground', () => {
  assert.match(SCREEN, /<div className="shrink-0 border-b border-ink\/10 bg-cream pt-\[env\(safe-area-inset-top\)\]" data-rise-head="">/, 'RiseScreen’s head does not paint the status row');
  assert.match(PICKED, /<div className="shrink-0 bg-\[rgb\(var\(--color-cream\)\)\] pt-\[env\(safe-area-inset-top\)\]">/, 'the picked client’s head does not paint the status row');
});

test('3 · the grow ends on the whole screen — the shape covers the inset', () => {
  assert.equal(RISE_FULL_CLIP, 'inset(0px 0px 0px 0px round 0px)');
  const m = riseScreenMotion({ top: 300, left: 16, width: 358, height: 64 }, { width: 390, height: 844 }, false)!;
  assert.deepEqual(m.frames[1], { clipPath: RISE_FULL_CLIP });
  for (const kind of ['stack', 'zoom', 'picture'] as const) {
    const k = riseScreenMotion({ top: 300, left: 16, width: 358, height: 64 }, { width: 390, height: 844 }, false, 14, kind)!;
    assert.equal((k.frames[1] as { transform: string }).transform, 'none', `${kind} does not end at rest over the whole screen`);
  }
});

test('4 · the rise adds no FIXED black layer — the dim is absolute, the size of the screen', () => {
  assert.match(RISE_DIM_BOX, /^position:absolute;/, 'the dim is a fixed layer again — iPhone paints the status row from it, in black');
  assert.doesNotMatch(RISE_DIM_BOX, /fixed/);
  const lib = code('lib/rise-screen.ts');
  assert.match(lib, /dim\.style\.cssText = `\$\{RISE_DIM_BOX\};pointer-events:none;background:#000;opacity:0;z-index:var\(--sn-z-pop\)`;/);
  assert.match(lib, /dim\.style\.transform = `translate\(\$\{-box\.left\}px, \$\{-box\.top\}px\)`;/, 'the dim is not placed over the screen');
  const behind = lib.slice(lib.indexOf('export function playBehind('), lib.indexOf('export function picturePlan('));
  assert.ok(behind.length > 400, 'premise: the page-behind player');
  assert.doesNotMatch(behind, /position:\s*fixed/, 'the page-behind player draws a fixed layer');
  // The player's own animations still touch only transform and opacity on it.
  assert.match(lib, /dim\.animate\(\[\{ opacity: 0 \}, \{ opacity: plan\.behind\.dim \}\]/);
});

test('5 · the page covers the notch, on a light theme colour, with the default status bar', () => {
  const layout = code('app/layout.tsx');
  assert.match(layout, /viewportFit:\s*'cover'/);
  assert.match(layout, /themeColor:\s*THEME_COLOR\.light/);
  assert.equal(THEME_COLOR.light, '#FBFBFA');
  assert.match(layout, /statusBarStyle:\s*'default'/, 'a black / black-translucent home-screen status bar paints the row dark');
});
