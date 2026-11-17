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
 *   3 · RiseScreen paints its shell on the tap's frame and renders the body right after, in a transition — only behind a
 *       tap; a deep link or the server's HTML still has the body at once.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-17): `usePortalHost` back to useState+useEffect → 1 red (test 1); the picked
 * close's `onItsOwnLayer(` removed → 1 red (test 2); `{bodyIn ? children : null}` → `{children}` → 1 red (test 3); `off` never called on
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

test('3 · RiseScreen: shell first behind a tap, the body in a transition; at once without one', () => {
  const screen = code('app/_components/rise/rise-screen.tsx');
  assert.match(screen, /useState\(\(\) => typeof window === 'undefined' \|\| riseOriginNow\(\) === null\)/, 'a deep link would wait for its body');
  assert.match(screen, /if \(!bodyIn\) startTransition\(\(\) => setBodyIn\(true\)\);/, 'the body is not rendered after the shell');
  assert.match(screen, /\{bodyIn \? children : null\}/, 'the body renders in the tap’s own frame again');
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
