/**
 * 🙈 NOTHING BEHIND THE VEIL PLAYS UNTIL IT IS OPENED — the ONE signal every player on the guest page reads.
 *
 * Owner, 2026-10-15, verbatim: *"on the reveal. nothing behind it should be playing until we open the reveal.
 * our only reveal at the moment is veil."* — and: *"when they unveil, the music starts playing upon tap"*.
 *
 * ── THE SIGNAL ─────────────────────────────────────────────────────────────────────────────────────────────
 * one `<style data-veil-hold>` in `<head>` (`VEIL_HOLD_ATTR`), present while an opening covers the page and has
 * not been opened. It is written by `VEIL_HOLD_SCRIPT`, an inline script the server writes ONLY where it mounts an opening
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
 *   · CSS animations — the hold's own rule (`VEIL_HOLD_CSS`): `animation-play-state: paused` for everything
 *     outside the opening's own box (`[data-reveal-layer]`). Ambient effects, scene build-ins, auto runs,
 *     theme loops drawn in CSS — all of them, including ones written after today.
 *   · `<video>` / `<audio>` — the script's capture-phase `play` listener pauses any element that starts, and
 *     resumes exactly those on release. Autoplay heroes, scene clips, the main ground loop, theme loops.
 *     An element marked `data-veil-free` is left alone: it only ever plays on the guest's own tap (the music
 *     button) or owns its own wait for the lift (the Save-the-Date film's soundtrack).
 *   · Web Animations (`el.animate`, e.g. the couple's layered logo) — paused frame by frame while held, and
 *     played on release. A press's own feedback (an animation on a button) is never held.
 *   · JS clocks — the few that tick on their own read `useVeilHeld()` (`lib/use-veil-held.ts`; the countdown).
 *   · The cover's WORDS — not drawn at all while held (`COVER_LINE_ATTR`), and every line enters after the unveil
 *     (`VEIL_WORDS_ATTR`, owner 2026-10-16). See `COVER_LINE_ATTR` below.
 *   · THE PAGE ITSELF — it does not scroll (`VEIL_STILL_PAGE_CSS` + the script's `touchmove`), owner 2026-10-17. See below.
 *
 * 🪤 NO REACT IN THIS FILE: `RevealMount` (a server component) imports the script from here, and a hook in
 * the same module breaks the server build ("useSyncExternalStore … only works in a Client Component").
 *
 * When no opening is shown nothing here ever runs: the script is not written, no rule is ever added,
 * and every player behaves exactly as before. Reduced motion: the script does not hold at all (those guests
 * get no opening — `RevealOverlay`).
 */

/**
 * The hold's `<style>` element in `<head>` — present exactly while an opening covers the page and has not been
 * opened. A `<style>` in head, NOT an attribute on `<html>`: an attribute a script writes before hydration is a
 * hydration mismatch on the root (measured on the first lab load: `- data-veiled=""` on `<html>`), while React 19
 * skips unexpected tags in `<head>`.
 */
export const VEIL_HOLD_ATTR = 'data-veil-hold';
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
/**
 * What the hold's `<style>` says: every CSS animation outside the opening's own box waits where it is — ambient
 * effects, a scene's build-in, an auto run, a theme loop drawn in CSS, and ones written after today. It exists
 * only while held, so a page with no opening carries no such rule at all.
 */
export const VEIL_HOLD_CSS =
  'body *:not([data-reveal-layer], [data-reveal-layer] *),' +
  'body *:not([data-reveal-layer], [data-reveal-layer] *)::before,' +
  'body *:not([data-reveal-layer], [data-reveal-layer] *)::after{animation-play-state:paused !important}';

/**
 * 🎭 BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW (owner 2026-10-16, DECISION_LOG "BEHIND THE VEIL, NONE OF THE
 * COVER'S WORDS SHOW", verbatim: *"Yes — behind the veil, none of the cover's words show. After the unveil, every line
 * enters with the cover's entrance (lines with no Build in get the cover's default)."*).
 *
 * Every line of the cover (`COVER_LINE_ATTR`, stamped by `pahina-masthead.tsx` — eyebrow, mark with its hairlines,
 * names, line, date, time, venue, link, caption, the rule, the day's badge) is drawn at opacity 0 while held. Its place
 * is kept (opacity, not display), so nothing moves when it enters. The cover's GROUND is not a line: the photo, clip
 * or scene stays behind the veil as before (and does not play — the rule above).
 *
 * 🔴 WHY: live on cale-ice the date, the venue and the mark's two hairlines showed THROUGH the sheer fabric — they
 * had no Build in, so there was no paused first frame to hide them; the names did (their Build in's first frame).
 */
export const COVER_LINE_ATTR = 'data-cover-line';
/** `COVER_LINE_ATTR`'s value on a line with a Build in of its own — it keeps it; every other line is `""`. */
export const COVER_LINE_OWN = 'own';
const VEIL_HOLD_WORDS_CSS = `[${COVER_LINE_ATTR}]{opacity:0 !important}`;
/**
 * 🧱 THE PAGE STAYS STILL UNTIL THE UNVEIL (owner 2026-10-17, verbatim, on live `/cale-ice` with the veil closed:
 * *"website will not scroll until reveal starts/opens/ etc. i notice i can already scroll"* — the 2026-10-15 ruling
 * "NOTHING BEHIND IT PLAYS UNTIL IT IS OPENED" covers the page's own scroll).
 *
 * MEASURED BEFORE (controller, live, veil closed): `scrollY` 0 of a 9,259 px document in a 1,092 px screen; `<html>`
 * and `<body>` `overflow: clip visible` (y free); `data-reveal-up` present. Nothing ever locked the document: that mark
 * is read only by the scrub hand-overs (`hub-scrub.tsx`), and the only barrier was the veil's own hit-zone
 * (`touch-action: none`), which stops a touch pan that STARTS on the armed veil and nothing else — never a wheel, a
 * trackpad, the keys, or a touch before the WebGL veil has loaded and armed.
 *
 * So, while held, the document is not a user scroller: `overflow: hidden` on `<html>` and `<body>` (wheel, trackpad,
 * keys, touch on iOS 16+), `overscroll-behavior: none` (no rubber band), the gutter kept so nothing jumps when it
 * lets go — and, in the script, a non-passive `touchmove` that cancels any pan outside the opening's own box (older
 * iOS Safari scrolls a hidden body by touch). The veil's swipe up is pointer events on its own box, untouched.
 * It comes off with the hold — the moment the unveil STARTS (`unveilInGesture`), not when the cloth has risen — so
 * the drape and the cover's entrance play while the guest can already move. Where the hold is never written (no
 * opening, reduced motion, the Maker's canvas, the ▶ preview) the page was never locked; after the unveil the hold is
 * gone for the visit (`__veilRelease` runs once), so a returning cover and its drape never lock it again.
 */
export const VEIL_STILL_PAGE_CSS =
  'html,body{overflow:hidden !important;overscroll-behavior:none !important}html{scrollbar-gutter:stable}';
/** The hold's whole rule: everything waits, the cover's words are not drawn, and the page stays still. */
const VEIL_HOLD_FULL_CSS = VEIL_HOLD_CSS + VEIL_HOLD_WORDS_CSS + VEIL_STILL_PAGE_CSS;
/**
 * …and AFTER the unveil every line ENTERS. One `<style data-veil-words>` in `<head>`, written beside the hold and
 * NEVER taken off: it says "this page opened under a veil", and `globals.css` gives every line with no Build in of its
 * own the cover's default entrance under it, in reading order (`--cover-at`, numbered by the release — the line's
 * place among the cover's lines, top to bottom). A page with no opening never has it, so nothing changes there.
 */
export const VEIL_WORDS_ATTR = 'data-veil-words';
/**
 * 🎬 THE COVER'S DEFAULT ENTRANCE — the shipped default Build in, `HUB_PRESET_BODY[HUB_DEFAULT_PRESET]` (Calm): a fade
 * (`hub-in-fade`), 1.1 s, on the timed ease, a 0.12 s stagger. Written into `globals.css` (the rule reads these
 * numbers literally); `app/[slug]/_components/the-veil-hides-the-cover-words.test.ts` holds the two equal.
 */
export const COVER_DEFAULT_ENTRANCE = {
  keyframe: 'hub-in-fade',
  durationS: 1.1,
  staggerS: 0.12,
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

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
var st=document.createElement('style');st.setAttribute('${VEIL_HOLD_ATTR}','');st.textContent='${VEIL_HOLD_FULL_CSS}';
(document.head||d).appendChild(st);
var ws=document.createElement('style');ws.setAttribute('${VEIL_WORDS_ATTR}','');(document.head||d).appendChild(ws);
var on=function(){return st.isConnected!==false&&!!st.parentNode};
var held=[],anims=[],raf=0;
var free=function(el){return !el||!el.closest||el.closest('[${REVEAL_LAYER_ATTR}],[${VEIL_FREE_ATTR}]')};
var hold=function(m){if(free(m))return;try{m.pause()}catch(e){}if(held.indexOf(m)<0)held.push(m)};
var onPlay=function(e){var m=e.target;if(!on())return;if(m&&(m.tagName==='VIDEO'||m.tagName==='AUDIO'))hold(m)};
document.addEventListener('play',onPlay,true);
var still=function(e){if(on()&&e.cancelable&&!free(e.target))e.preventDefault()};
document.addEventListener('touchmove',still,{passive:false});
var ms=document.querySelectorAll('video,audio');for(var i=0;i<ms.length;i++){if(!ms[i].paused)hold(ms[i])}
var scan=function(){raf=0;if(!on())return;
if(document.getAnimations){var as=document.getAnimations();for(var j=0;j<as.length;j++){var a=as[j];
if(w.CSSAnimation&&a instanceof w.CSSAnimation)continue;if(w.CSSTransition&&a instanceof w.CSSTransition)continue;
if(a.playState!=='running')continue;var t=a.effect&&a.effect.target;
if(free(t)||(t&&t.closest&&t.closest('button,a,[role=button]')))continue;
try{a.pause();anims.push(a)}catch(e){}}}
raf=w.requestAnimationFrame?w.requestAnimationFrame(scan):0};
scan();
w.__veilRelease=function(){
if(!on())return;
try{var ls=document.querySelectorAll('[${COVER_LINE_ATTR}]');for(var c=0;c<ls.length;c++){ls[c].style.setProperty('--cover-at',String(c))}}catch(e){}
if(st.parentNode)st.parentNode.removeChild(st);
document.removeEventListener('play',onPlay,true);
document.removeEventListener('touchmove',still,{passive:false});
if(raf&&w.cancelAnimationFrame)w.cancelAnimationFrame(raf);
var hs=held;held=[];for(var k=0;k<hs.length;k++){var m=hs[k];if(m.isConnected){var p=m.play();if(p&&p.catch)p.catch(function(){})}}
var an=anims;anims=[];for(var n=0;n<an.length;n++){try{an[n].play()}catch(e){}}
try{w.dispatchEvent(new Event('${HUB_VEIL_RELEASED_EVENT}'))}catch(e){}
};
setTimeout(function(){if(!w.__veilClaimed)w.__veilRelease()},${VEIL_HOLD_FAILSAFE_MS});
}catch(e){try{var x=document.querySelector('style[${VEIL_HOLD_ATTR}]');if(x&&x.parentNode)x.parentNode.removeChild(x)}catch(e2){}}})()`;

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

/** Let the page play: everything held starts again, the hold's `<style>` comes off. Idempotent. */
export function releaseVeilHold(): void {
  if (typeof document === 'undefined') return;
  const w = window as VeilWindow;
  if (w.__veilRelease) {
    w.__veilRelease();
    return;
  }
  // No script ran on this page — nothing can be held.
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
  return typeof document !== 'undefined' && document.querySelector(`style[${VEIL_HOLD_ATTR}]`) !== null;
}
