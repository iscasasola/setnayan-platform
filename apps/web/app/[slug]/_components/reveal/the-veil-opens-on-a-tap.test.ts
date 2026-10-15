/**
 * the-veil-opens-on-a-tap.test.ts — three owner rulings of 2026-10-15, held where they are true.
 *
 *   1. *"before we had double tap to unveil. now we make it simpler. Tap, swipe up to unveil"* — the veil's
 *      ONLY unveil gestures are a tap and a swipe up. No double-tap, no `dblclick`, no tap that bats a petal.
 *   2. *"nothing behind it should be playing until we open the reveal"* — ONE signal (`lib/hub-veil.ts`,
 *      `data-veiled` on `<html>`), written before the body parses wherever an opening is mounted, and read by
 *      every player: CSS animations (one rule), video/audio and Web Animations (the script), the countdown's
 *      clock (`useVeilHeld`).
 *   3. *"when they unveil, the music starts playing upon tap"* — the unveil runs INSIDE the gesture: the
 *      veil's `pointerup` calls `onUnveil` synchronously → `unveilInGesture` releases the page and fires
 *      `hub-unveil` → the music's `play()` runs in that listener. (The music's own half is held in
 *      `lib/the-music-button-has-three-designs.test.ts`, beside the rule it shares a counter with.)
 *
 * The hold script itself is EXECUTED below against a stand-in document, not just grepped: it holds a playing
 * video, leaves a `data-veil-free` one alone, resumes exactly what it held, and lets go by itself when nobody
 * claims the page (fail-visible — the shape `veil-never-traps-the-guest.test.ts` warns about, "block first,
 * release later", is only safe with a release nobody has to remember).
 *
 * The veil itself needs WebGL and a rAF loop; there is no harness here that drives it, so its gesture half is
 * source-level, on comment-stripped source (`lib/strip-comments.ts` — comments quote the retired code).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  HUB_UNVEIL_EVENT,
  HUB_VEIL_RELEASED_EVENT,
  HUB_VEILED_ATTR,
  VEIL_HOLD_FAILSAFE_MS,
  VEIL_HOLD_SCRIPT,
} from '@/lib/hub-veil';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const VEIL = code('app/[slug]/_components/reveal/veil-reveal.tsx');
const OVERLAY = code('app/[slug]/_components/reveal/reveal-overlay.tsx');
const MOUNT = code('app/[slug]/_components/reveal/reveal-mount.tsx');
const HUB_VEIL = code('lib/hub-veil.ts');

/** The body of `const release = (e: PointerEvent) => { … };` — where every gesture is decided. */
function releaseHandler(): string {
  const at = VEIL.indexOf('const release = (e: PointerEvent) => {');
  assert.ok(at > 0, 'the veil’s pointerup handler (`release`) is gone — the gesture guard below would be vacuous');
  return VEIL.slice(at, VEIL.indexOf('\n    };', at));
}

test('👆 the veil’s only unveil gestures are a tap and a swipe up — no double-tap, no dblclick', () => {
  assert.equal(/dblclick|ondblclick|onDoubleClick/i.test(VEIL), false, 'a dblclick handler is back on the veil');
  assert.equal(/lastTap/.test(VEIL), false, 'a double-tap timer (`lastTap`) is back on the veil');
  assert.equal(/doRevealAuto/.test(VEIL), false, 'the double-tap toggle (`doRevealAuto`) is back');
  const r = releaseHandler();
  // Exactly two unveils in the handler: the swipe up and the tap.
  assert.equal((r.match(/\bunveil\(\);/g) ?? []).length, 2, 'the veil should unveil on exactly two gestures (tap · swipe up)');
  // The swipe up unveils then lifts…
  assert.match(r, /if \(up > 40 && dur < 460 && up > Math\.abs\(dxC\) \* 1\.0\)\s*\{\s*unveil\(\);\s*setLift\(1\);/, 'swipe up no longer unveils');
  // …and a TAP (short, still) unveils with the same hands-free lift the preview plays.
  assert.match(
    r,
    /if \(dur < 300 && net < 18\)\s*\{\s*if \(!locked && liftTarget < 1\)\s*\{\s*unveil\(\);\s*startAuto\(\);/,
    'a tap no longer unveils with the hands-free lift (startAuto)',
  );
  // The retired petal-bat: a tap means "unveil" now, never "bat a petal".
  assert.equal(/bounceAt/.test(r), false, 'a tap bats a petal again — a tap means unveil');
});

test('🎵 the unveil runs inside the gesture: onUnveil first, synchronously, in the pointerup', () => {
  const at = VEIL.indexOf('const unveil = () => {');
  assert.ok(at > 0, 'the veil’s `unveil` is gone');
  const body = VEIL.slice(at, VEIL.indexOf('\n    };', at));
  const cb = body.indexOf('onUnveilRef.current?.()');
  assert.ok(cb > 0, '`unveil` no longer calls onUnveil');
  assert.equal(/setTimeout|requestAnimationFrame|await|\.then\(/.test(body), false, '`unveil` defers — a deferred play() is refused');
  assert.ok(cb < body.indexOf("'std-go-fullscreen'"), 'onUnveil must run first, while the activation is fresh');
  // The pointerup is where it is wired.
  assert.match(VEIL, /window\.addEventListener\('pointerup', release\)/, 'the gestures no longer run on pointerup');
  // The guest overlay hands the veil the one in-gesture unveil.
  assert.match(OVERLAY, /onUnveil=\{unveilInGesture\}/, 'the guest overlay no longer unveils inside the gesture');
  // …which lets the page play FIRST, then tells the music.
  const fn = HUB_VEIL.slice(HUB_VEIL.indexOf('export function unveilInGesture'));
  assert.ok(fn.indexOf('releaseVeilHold()') < fn.indexOf('HUB_UNVEIL_EVENT'), 'release must come before hub-unveil, or the song is held');
});

test('🙈 the hold is written only where an opening is mounted, and the overlay decides whether it stays', () => {
  assert.match(MOUNT, /\{mountOverlay \? \(\s*<script[\s\S]*?__html: VEIL_HOLD_SCRIPT/, 'RevealMount no longer writes the hold with the overlay');
  assert.equal((MOUNT.match(/VEIL_HOLD_SCRIPT/g) ?? []).length, 2, 'the hold is written somewhere other than beside the overlay');
  // Every stand-down releases; a real opening keeps it (the veil claims once armed, a rigid one at once).
  assert.match(OVERLAY, /if \(!active \|\| gone\) \{\s*releaseVeilHold\(\);/, 'a stood-down opening no longer lets the page play');
  assert.match(OVERLAY, /if \(!veil\) claimVeilHold\(\);/);
  assert.match(VEIL, /claimVeilHold\(\);\s*raf = requestAnimationFrame\(loop\);/, 'the veil no longer claims the page when it arms');
  // The opening's own box is never held.
  assert.equal((OVERLAY.match(/\[REVEAL_LAYER_ATTR\]: ''/g) ?? []).length, 2, 'both opening wrappers (veil · rigid) must be the reveal layer');
});

test('🙈 the players read the one signal', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(
    css,
    /html\[data-veiled\] body \*:not\(\[data-reveal-layer\], \[data-reveal-layer\] \*\)[^{]*\{\s*animation-play-state: paused !important;/,
    'the stylesheet no longer holds CSS animations under the veil',
  );
  assert.equal(HUB_VEILED_ATTR, 'data-veiled');
  assert.match(code('app/[slug]/_components/countdown.tsx'), /const veiled = useVeilHeld\(\);[\s\S]*?if \(veiled\) return;\s*const id = window\.setInterval/, 'the countdown ticks under the veil');
  const film = code('app/[slug]/_components/save-the-date-film.tsx');
  assert.equal((film.match(/\[VEIL_FREE_ATTR\]: ''/g) ?? []).length, 3, 'the film’s soundtrack and both clips own their wait — they must be veil-free');
  assert.match(code('app/[slug]/_components/background-music.tsx'), /<audio ref=\{audioRef\}[^>]*\[VEIL_FREE_ATTR\]: ''/, 'the song the guest asks for would be held');
});

/* ── The script, run ─────────────────────────────────────────────────────────────────────────────────── */

type Listener = (e: { target: unknown }) => void;
function standIn(opts: { reduce?: boolean } = {}) {
  const attrs = new Set<string>();
  const docListeners: Record<string, Listener[]> = {};
  const winEvents: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const media = (free: boolean) => {
    const m = {
      tagName: 'VIDEO',
      paused: true,
      isConnected: true,
      plays: 0,
      closest: (sel: string) => (free && /data-veil-free/.test(sel) ? {} : null),
      pause() { m.paused = true; },
      play() { m.plays++; m.paused = false; return Promise.resolve(); },
    };
    return m;
  };
  const root = {
    setAttribute: (n: string) => void attrs.add(n),
    removeAttribute: (n: string) => void attrs.delete(n),
    hasAttribute: (n: string) => attrs.has(n),
  };
  const document = {
    documentElement: root,
    addEventListener: (t: string, f: Listener) => void (docListeners[t] ??= []).push(f),
    removeEventListener: (t: string, f: Listener) => void (docListeners[t] = (docListeners[t] ?? []).filter((x) => x !== f)),
    querySelectorAll: () => [],
    getAnimations: () => [],
  };
  const window: Record<string, unknown> = {
    matchMedia: () => ({ matches: Boolean(opts.reduce) }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    dispatchEvent: (e: Event) => void winEvents.push(e.type),
  };
  const run = () =>
    new Function('window', 'document', 'setTimeout', VEIL_HOLD_SCRIPT)(window, document, (fn: () => void, ms: number) =>
      timers.push({ fn, ms }),
    );
  const play = (m: unknown) => (docListeners.play ?? []).forEach((f) => f({ target: m }));
  return { attrs, window, winEvents, timers, media, run, play };
}

test('🙈 the hold, run: it holds what starts, leaves the veil-free alone, and resumes exactly what it held', () => {
  const s = standIn();
  s.run();
  assert.ok(s.attrs.has(HUB_VEILED_ATTR), 'the script did not mark the page veiled');
  const hero = s.media(false);
  const song = s.media(true);
  hero.play();
  s.play(hero);
  song.play();
  s.play(song);
  assert.equal(hero.paused, true, 'a video behind the veil kept playing');
  assert.equal(song.paused, false, 'a veil-free element (the song the guest asked for) was held');
  (s.window.__veilRelease as () => void)();
  assert.equal(s.attrs.has(HUB_VEILED_ATTR), false, 'the release left the page veiled');
  assert.equal(hero.paused, false, 'the release did not start what it held');
  assert.equal(hero.plays, 2);
  assert.equal(song.plays, 1, 'the release touched an element it never held');
  assert.deepEqual(s.winEvents, [HUB_VEIL_RELEASED_EVENT]);
  // After the release nothing is held any more.
  const late = s.media(false);
  late.play();
  s.play(late);
  assert.equal(late.paused, false, 'a player started after the unveil was held');
});

test('🛟 fail-visible: unclaimed, it lets go by itself; claimed, it waits for the guest', () => {
  const a = standIn();
  a.run();
  const fs = a.timers.find((t) => t.ms === VEIL_HOLD_FAILSAFE_MS);
  assert.ok(fs, 'the hold has no failsafe — a failed bundle would freeze the page’s entrances');
  fs.fn();
  assert.equal(a.attrs.has(HUB_VEILED_ATTR), false, 'unclaimed, the hold never let go');

  const b = standIn();
  b.run();
  b.window.__veilClaimed = true;
  b.timers.find((t) => t.ms === VEIL_HOLD_FAILSAFE_MS)!.fn();
  assert.ok(b.attrs.has(HUB_VEILED_ATTR), 'a claimed hold (the veil is up) let go before the guest opened it');
});

test('♿ reduced motion: no hold at all (those guests get no opening)', () => {
  const s = standIn({ reduce: true });
  s.run();
  assert.equal(s.attrs.has(HUB_VEILED_ATTR), false);
  assert.equal(s.window.__veilRelease, undefined);
});

test('the event names are the ones the players listen for', () => {
  assert.equal(HUB_UNVEIL_EVENT, 'hub-unveil');
  assert.equal(HUB_VEIL_RELEASED_EVENT, 'hub-veil-released');
});
