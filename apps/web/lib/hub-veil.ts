import { useSyncExternalStore } from 'react';

/**
 * 🙈 NOTHING BEHIND THE VEIL PLAYS UNTIL IT IS OPENED — the ONE signal every player on the guest page reads.
 *
 * Owner, 2026-10-15, verbatim: *"on the reveal. nothing behind it should be playing until we open the reveal.
 * our only reveal at the moment is veil."* — and: *"when they unveil, the music starts playing upon tap"*.
 *
 * ── THE SIGNAL ─────────────────────────────────────────────────────────────────────────────────────────────
 * `data-veiled` on `<html>` (`HUB_VEILED_ATTR`) while an opening covers the page and has not been opened. It is
 * set by `VEIL_HOLD_SCRIPT`, an inline script the server writes ONLY where it mounts an opening
 * (`RevealMount`), so it lands before the page body is even parsed — a `<video autoPlay>` cannot start ahead
 * of it. It comes off exactly once, through `releaseVeilHold()`:
 *
 *   · the guest's unveil gesture (the veil's tap or swipe up — `unveilInGesture()`, called synchronously
 *     inside that `pointerup`, which is also what lets the music start there);
 *   · the opening standing down without one (reduced motion switched on, "already seen this visit", a landing
 *     part-way down, no WebGL, No Reveal on a staff build, a rigid opening's own open) — `RevealOverlay`;
 *   · 🛟 FAIL-VISIBLE: if no opening has CLAIMED the page within `VEIL_HOLD_FAILSAFE_MS` (the veil arms its
 *     hit-zone → `claimVeilHold()`), the script lets go by itself — a failed bundle, a veil chunk that never
 *     loaded, must never leave a page whose entrances are frozen at their first frame.
 *
 * ── WHAT HOLDS UNDER IT (one mechanism each, nothing per-widget unless it must be) ────────────────────────
 *   · CSS animations — one rule in `globals.css` ("NOTHING BEHIND THE VEIL PLAYS"): `animation-play-state:
 *     paused` for everything outside the opening's own box (`[data-reveal-layer]`). Ambient effects, scene
 *     build-ins, auto runs, theme loops drawn in CSS — all of them, including ones written after today.
 *   · `<video>` / `<audio>` — the script's capture-phase `play` listener pauses any element that starts, and
 *     resumes exactly those on release. Autoplay heroes, scene clips, the main ground loop, theme loops.
 *     An element marked `data-veil-free` is left alone: it only ever plays on the guest's own tap (the music
 *     button) or owns its own wait for the lift (the Save-the-Date film's soundtrack).
 *   · Web Animations (`el.animate`, e.g. the couple's layered logo) — paused frame by frame while held, and
 *     played on release. A press's own feedback (an animation on a button) is never held.
 *   · JS clocks — the few that tick on their own read `useVeilHeld()` (the countdown).
 *
 * When no opening is shown nothing here ever runs: the script is not written, the attribute is never set,
 * and every player behaves exactly as before. Reduced motion: the script does not hold at all (those guests
 * get no opening — `RevealOverlay`).
 */

/** On `<html>` while an opening covers the page and has not been opened. */
export const HUB_VEILED_ATTR = 'data-veiled';
/** The opening's own box — never held (the veil, its hint, a rigid opening's flaps). */
export const REVEAL_LAYER_ATTR = 'data-reveal-layer';
/** On a media element that only plays on the guest's own tap, or that owns its own wait for the lift. */
export const VEIL_FREE_ATTR = 'data-veil-free';
/**
 * 👆 Who runs INSIDE THE UNVEIL GESTURE (tap / swipe up) — called DIRECTLY, in the gesture's own call stack,
 * not through `dispatchEvent` (DECISION_LOG 2026-06-22: never rely on a dispatched event for iOS gesture
 * credit). A callback that starts sound must call `play()` in itself — not after the lift, not in a timeout —
 * or the browser refuses it (silently, on iOS Safari above all). Returns the unsubscribe.
 */
const unveilCallbacks = new Set<() => void>();
export function onUnveil(cb: () => void): () => void {
  unveilCallbacks.add(cb);
  return () => {
    unveilCallbacks.delete(cb);
  };
}
/** Dispatched on `window` when the hold comes off — by the gesture or by the opening standing down. */
export const HUB_VEIL_RELEASED_EVENT = 'hub-veil-released';
/** No opening claimed the page in this long → the script lets go by itself (fail-visible). */
export const VEIL_HOLD_FAILSAFE_MS = 12000;

type VeilWindow = Window & {
  __veilRelease?: () => void;
  __veilClaimed?: boolean;
};

/**
 * The hold, as one self-contained inline script (no bundle needed — that is what lets it run before the body
 * parses, and what lets its failsafe work when the bundle never arrives). `releaseVeilHold()` calls the
 * `window.__veilRelease` it defines, so there is ONE release, not a script one and a module one.
 */
export const VEIL_HOLD_SCRIPT = `(function(){try{
var d=document.documentElement,w=window;
if(w.__veilRelease)return;
if(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
d.setAttribute('${HUB_VEILED_ATTR}','');
var held=[],anims=[],raf=0;
var free=function(el){return !el||!el.closest||el.closest('[${REVEAL_LAYER_ATTR}],[${VEIL_FREE_ATTR}]')};
var hold=function(m){if(free(m))return;try{m.pause()}catch(e){}if(held.indexOf(m)<0)held.push(m)};
var onPlay=function(e){var m=e.target;if(!d.hasAttribute('${HUB_VEILED_ATTR}'))return;if(m&&(m.tagName==='VIDEO'||m.tagName==='AUDIO'))hold(m)};
document.addEventListener('play',onPlay,true);
var ms=document.querySelectorAll('video,audio');for(var i=0;i<ms.length;i++){if(!ms[i].paused)hold(ms[i])}
var scan=function(){raf=0;if(!d.hasAttribute('${HUB_VEILED_ATTR}'))return;
if(document.getAnimations){var as=document.getAnimations();for(var j=0;j<as.length;j++){var a=as[j];
if(w.CSSAnimation&&a instanceof w.CSSAnimation)continue;if(w.CSSTransition&&a instanceof w.CSSTransition)continue;
if(a.playState!=='running')continue;var t=a.effect&&a.effect.target;
if(free(t)||(t&&t.closest&&t.closest('button,a,[role=button]')))continue;
try{a.pause();anims.push(a)}catch(e){}}}
raf=w.requestAnimationFrame?w.requestAnimationFrame(scan):0};
scan();
w.__veilRelease=function(){
if(!d.hasAttribute('${HUB_VEILED_ATTR}'))return;
d.removeAttribute('${HUB_VEILED_ATTR}');
document.removeEventListener('play',onPlay,true);
if(raf&&w.cancelAnimationFrame)w.cancelAnimationFrame(raf);
var hs=held;held=[];for(var k=0;k<hs.length;k++){var m=hs[k];if(m.isConnected){var p=m.play();if(p&&p.catch)p.catch(function(){})}}
var an=anims;anims=[];for(var n=0;n<an.length;n++){try{an[n].play()}catch(e){}}
try{w.dispatchEvent(new Event('${HUB_VEIL_RELEASED_EVENT}'))}catch(e){}
};
setTimeout(function(){if(!w.__veilClaimed)w.__veilRelease()},${VEIL_HOLD_FAILSAFE_MS});
}catch(e){try{document.documentElement.removeAttribute('${HUB_VEILED_ATTR}')}catch(e2){}}})()`;

/**
 * Hold the page from the client — for a client-side navigation, where the server's inline script is not run
 * (React never executes a `dangerouslySetInnerHTML` script it inserts). Same script, so one behaviour.
 * A no-op when the hold is already installed.
 */
export function ensureVeilHold(): void {
  if (typeof document === 'undefined') return;
  const w = window as VeilWindow;
  if (w.__veilRelease) return;
  const s = document.createElement('script');
  s.textContent = VEIL_HOLD_SCRIPT;
  document.head.appendChild(s);
  s.remove();
}

/** The opening is really up (the veil armed its hit-zone) — the failsafe stands down. */
export function claimVeilHold(): void {
  if (typeof window === 'undefined') return;
  (window as VeilWindow).__veilClaimed = true;
}

/** Let the page play: everything held starts again, `data-veiled` comes off. Idempotent. */
export function releaseVeilHold(): void {
  if (typeof document === 'undefined') return;
  const w = window as VeilWindow;
  if (w.__veilRelease) {
    w.__veilRelease();
    return;
  }
  // No script on this page (an opening the server never wrote one for) — nothing is held but the mark.
  if (document.documentElement.hasAttribute(HUB_VEILED_ATTR)) {
    document.documentElement.removeAttribute(HUB_VEILED_ATTR);
    window.dispatchEvent(new Event(HUB_VEIL_RELEASED_EVENT));
  }
}

/**
 * 👆 THE UNVEIL, INSIDE THE GESTURE. Call it synchronously from the tap's / swipe's own handler: the page is
 * released first (so a player starting now is not held), then every `onUnveil` callback runs — directly, in
 * the same call stack — so the music starts in the same activation.
 */
export function unveilInGesture(): void {
  releaseVeilHold();
  for (const cb of [...unveilCallbacks]) {
    try {
      cb();
    } catch {
      /* one callback never stops the unveil */
    }
  }
}

/** True while an opening holds the page. */
export function isVeilHeld(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute(HUB_VEILED_ATTR);
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(HUB_VEIL_RELEASED_EVENT, cb);
  return () => window.removeEventListener(HUB_VEIL_RELEASED_EVENT, cb);
}

/**
 * For a JS clock that ticks on its own (the countdown): true while the veil holds the page — hold the tick,
 * start it when this turns false. False on the server and wherever no opening is shown.
 */
export function useVeilHeld(): boolean {
  return useSyncExternalStore(subscribe, isVeilHeld, () => false);
}
