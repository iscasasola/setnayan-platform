/**
 * the-veil-opens-on-a-tap.test.ts — three owner rulings of 2026-10-15, held where they are true.
 *
 *   1. *"before we had double tap to unveil. now we make it simpler. Tap, swipe up to unveil"* — the veil's
 *      ONLY unveil gestures are a tap and a swipe up. No double-tap, no `dblclick`, no tap that bats a petal.
 *   2. *"nothing behind it should be playing until we open the reveal"* — ONE signal (`lib/hub-veil.ts`,
 *      a `<style data-veil-hold>` in `<head>`), written before the body parses wherever an opening is mounted,
 *      and read by every player: CSS animations (its one rule), video/audio and Web Animations (the script), the countdown's
 *      clock (`useVeilHeld`).
 *   3. *"when they unveil, the music starts playing upon tap"* — the unveil runs INSIDE the gesture: the
 *      veil's `pointerup` calls `onUnveil` synchronously → `unveilInGesture` releases the page and calls
 *      the `onUnveil` callbacks directly → the music's `play()` runs in that call. (The music's own half is held in
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
  onUnveil,
  unveilInGesture,
  HUB_VEIL_RELEASED_EVENT,
  VEIL_HOLD_ATTR,
  VEIL_HOLD_CSS,
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

test('👆 the unveil frees the page AT ONCE — the grab-zone does not stay full screen while the cloth rises (Batch 8 R2)', () => {
  const r = releaseHandler();
  // Both unveils hand the page back in the same pointerup: capture released, the zone dropped to the top band.
  assert.match(r, /unveil\(\);\s*setLift\(1\);\s*freeThePage\(e\.pointerId\);/, 'a swipe up leaves the full-screen grab-zone up while the cloth rises');
  assert.match(r, /unveil\(\);\s*startAuto\(\);\s*freeThePage\(e\.pointerId\);/, 'a tap leaves the full-screen grab-zone up for the whole ~6 s hands-free lift — the page cannot be scrolled');
  assert.match(VEIL, /releasePointerCapture\?\.\(pointerId\)/, 'the unveil no longer releases the pointer capture');
  // The loop must not put the full-screen zone back while the lift is still low.
  assert.match(VEIL, /const wantTopBand = freed \|\|/, 'the loop resizes the zone back to full screen while a freed lift is still low');
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
  const rel = fn.indexOf('releaseVeilHold()');
  assert.ok(rel > 0 && rel < fn.indexOf('cb()'), 'the unveil must release the page, before its callbacks, or the song is held');
  // Called DIRECTLY — never through dispatchEvent (DECISION_LOG 2026-06-22: no gesture credit through a dispatched event).
  assert.equal(/dispatchEvent/.test(fn.slice(0, fn.indexOf('\n}'))), false, 'the unveil reaches the music through a dispatched event');
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

test('🪤 the hold module stays server-safe — RevealMount (a server component) imports it', () => {
  // A hook here broke the server build on the first lab load ("useSyncExternalStore … only works in a Client Component").
  assert.equal(/from 'react'|from "react"/.test(HUB_VEIL), false, 'lib/hub-veil.ts imports React — the server mount cannot import it');
  assert.match(code('lib/use-veil-held.ts'), /useSyncExternalStore\(subscribe, isVeilHeld, \(\) => false\)/);
});

test('🙈 the players read the one signal', () => {
  // CSS animations: the hold's own rule — everything outside the opening's box waits.
  assert.equal(
    VEIL_HOLD_CSS,
    'body *:not([data-reveal-layer], [data-reveal-layer] *),body *:not([data-reveal-layer], [data-reveal-layer] *)::before,body *:not([data-reveal-layer], [data-reveal-layer] *)::after{animation-play-state:paused !important}',
    'the hold no longer pauses every CSS animation behind the opening',
  );
  assert.ok(VEIL_HOLD_SCRIPT.includes(`st.textContent='${VEIL_HOLD_CSS}'`), 'the hold no longer writes its rule');
  assert.equal(VEIL_HOLD_ATTR, 'data-veil-hold');
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
  const head = {
    kids: [] as Array<{ parentNode: unknown }>,
    appendChild(el: { parentNode: unknown }) { head.kids.push(el); el.parentNode = head; },
    removeChild(el: { parentNode: unknown }) { head.kids = head.kids.filter((k) => k !== el); el.parentNode = null; },
  };
  const document = {
    head,
    createElement: () => {
      const el = { parentNode: null as unknown, textContent: '', attrs: {} as Record<string, string>, setAttribute(n: string, v: string) { el.attrs[n] = v; } };
      Object.defineProperty(el, 'isConnected', { get: () => el.parentNode !== null });
      return el;
    },
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
  const held = () => head.kids.some((k) => (k as unknown as { attrs: Record<string, string> }).attrs[VEIL_HOLD_ATTR] === '');
  return { attrs, window, winEvents, timers, media, run, play, held, head };
}

test('🙈 the hold, run: it holds what starts, leaves the veil-free alone, and resumes exactly what it held', () => {
  const s = standIn();
  s.run();
  assert.ok(s.held(), 'the script did not hold the page');
  assert.equal(s.attrs.size, 0, 'the script wrote an attribute on <html> — a hydration mismatch on the root');
  const hero = s.media(false);
  const song = s.media(true);
  hero.play();
  s.play(hero);
  song.play();
  s.play(song);
  assert.equal(hero.paused, true, 'a video behind the veil kept playing');
  assert.equal(song.paused, false, 'a veil-free element (the song the guest asked for) was held');
  (s.window.__veilRelease as () => void)();
  assert.equal(s.held(), false, 'the release left the page held');
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
  assert.equal(a.held(), false, 'unclaimed, the hold never let go');

  const b = standIn();
  b.run();
  b.window.__veilClaimed = true;
  b.timers.find((t) => t.ms === VEIL_HOLD_FAILSAFE_MS)!.fn();
  assert.ok(b.held(), 'a claimed hold (the veil is up) let go before the guest opened it');
});

test('♿ reduced motion: no hold at all (those guests get no opening)', () => {
  const s = standIn({ reduce: true });
  s.run();
  assert.equal(s.held(), false);
  assert.equal(s.window.__veilRelease, undefined);
});

test('the unveil calls its callbacks in the same call stack, and a refused one never stops the rest', () => {
  const calls: string[] = [];
  const off1 = onUnveil(() => calls.push('song'));
  const off2 = onUnveil(() => {
    throw new Error('refused');
  });
  const off3 = onUnveil(() => calls.push('after'));
  unveilInGesture();
  assert.deepEqual(calls, ['song', 'after'], 'the unveil did not call every callback synchronously');
  off1();
  off2();
  off3();
  unveilInGesture();
  assert.deepEqual(calls, ['song', 'after'], 'an unsubscribed callback still ran');
  assert.equal(HUB_VEIL_RELEASED_EVENT, 'hub-veil-released');
});
