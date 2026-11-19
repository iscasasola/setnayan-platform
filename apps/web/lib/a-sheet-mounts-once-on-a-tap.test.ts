/**
 * ⚡ A SHEET MOUNTS ONCE ON A TAP, AND A RISE MOVES ON ITS OWN LAYER (owner 2026-11-17 *"we need a fix on how pages grow
 * full screen. since it shows, it feels like it is lagging"*).
 *
 * Three causes, each held here:
 *   1 · `usePortalHost` was `useState(null)` + `useEffect(setHost(body))`: a sheet opened by a tap rendered in place,
 *       then again as a portal — a different element, so React threw the first render away and mounted every child a
 *       second time before the first frame. It now reads <body> in the tap's own render (null only while hydrating).
 *   2 · The rise animates `clip-path`; unpromoted, that repaints the whole screen every frame. Both rises (the ONE
 *       RiseScreen and the picked client) go on their own layer for the motion — open AND close — and come off after.
 *   3 · (Merge with main, 2026-11-19) The branch also rendered RiseScreen's body a beat after the shell, in a transition.
 *       Main's motion standard (Phase 6) now steps the body's first blocks in AT the open (`playGrowParts(riseParts(el))`),
 *       which needs the body in the DOM on that frame — so the deferral was dropped and main's grow kept. Test 3 now holds
 *       the body in the first render instead.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-17): `usePortalHost` back to useState+useEffect → 1 red (test 1); the picked
 * close's `onItsOwnLayer(` removed → 1 red (test 2); `off` never called on
 * a cancelled motion (`a.finished.then(off)`) → 1 red (test 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { onItsOwnLayer, RISE_LAYER_WILL_CHANGE } from '@/lib/rise-layer';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the portal host is <body> in the first client render — null only from the server snapshot', () => {
  const host = code('lib/use-portal-host.ts');
  assert.match(host, /useSyncExternalStore\(never, body, none\)/, 'the host is not read in the first render');
  assert.match(host, /const body = \(\) => document\.body;/);
  assert.match(host, /const none = \(\) => null;/, 'the server snapshot is not null — hydration would disagree');
  assert.doesNotMatch(host, /useEffect|useState/, 'the host waits for an effect again — every sheet mounts twice');
  // The ⚙ sheet's own copy is the shared one now.
  assert.doesNotMatch(code('app/_components/menu-settings-button.tsx'), /setHost\(document\.body\)/, 'the ⚙ keeps its own late host');
});

test('2 · both rises move on their own layer, open and close', () => {
  const screen = code('app/_components/rise/rise-screen.tsx');
  const picked = code('app/_components/picked/picked-shell.tsx');
  assert.equal((screen.match(/onItsOwnLayer\(el, el\.animate\(/g) ?? []).length, 2, 'RiseScreen: open or close repaints every frame');
  assert.equal((picked.match(/onItsOwnLayer\(el, el\.animate\(m\.frames/g) ?? []).length, 2, 'picked client: open or close repaints every frame');
});

test('3 · RiseScreen: the body is in the open’s own render, so main’s grow can step its blocks in', () => {
  const screen = code('app/_components/rise/rise-screen.tsx');
  assert.match(screen, /<RiseCloseContext\.Provider value=\{close\}>\{children\}<\/RiseCloseContext\.Provider>/, 'the body is held back — playGrowParts finds no blocks');
  assert.doesNotMatch(screen, /bodyIn/, 'the body waits for a transition again');
});

test('4 · the layer comes off when the motion ends — finished or cancelled — and never lingers', async () => {
  for (const outcome of ['finish', 'cancel'] as const) {
    let settle!: (ok: boolean) => void;
    const finished = new Promise<void>((res, rej) => (settle = (ok) => (ok ? res() : rej(new Error('cancelled')))));
    finished.catch(() => {});
    const a = { finished, playState: 'running' } as unknown as Animation;
    const el = { style: { willChange: '' }, getAnimations: () => [a] } as unknown as HTMLElement;
    assert.equal(onItsOwnLayer(el, a), a, 'the motion is not handed back');
    assert.equal(el.style.willChange, RISE_LAYER_WILL_CHANGE, 'not promoted while it moves');
    settle(outcome === 'finish');
    await finished.catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(el.style.willChange, '', `the layer lingers after a ${outcome}`);
  }
});
