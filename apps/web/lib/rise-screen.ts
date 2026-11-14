/**
 * rise-screen.ts — ⤴ RISE FULL SCREEN, THE PURE HALF: where a rise comes from, and its frames (Build 5 · Lane A, owner
 * 2026-11-10 *"risefull screen is what we call it"* · *"fullscreen everything"*; HOUSE_TEMPLATES T4). The client part is
 * `app/_components/rise/rise-screen.tsx`.
 *
 * ── WHERE IT COMES FROM ─────────────────────────────────────────────────────────────────────────────────────────────
 * Rise full screen grows out of the tapped row, card, badge or ⚙ and falls back into it on ✕. Most doors open their
 * screen through state or the address (`?gear=1`, `?sheet=qr`), so the screen that mounts does not hold the element that
 * was pressed. Rather than thread a ref through every door, the document notes its LAST PRESS (pointer, or Enter/Space on
 * a focused control) and `RiseScreen` reads it on mount — the approved prototype's own `window.__riseFrom`
 * (`supplier-menu-r2.v119.html`, `riseSheet(html, from)`).
 *   · Only a fresh press counts (`RISE_ORIGIN_FRESH_MS`): a screen opened by a deep link, a reload or a notification has
 *     no tap behind it and simply appears — the picked client's hard-load rule (`picked-motion.ts`).
 *   · Only a pressable thing counts (`RISE_ORIGIN_PRESSABLE`) — never the page's background.
 *   · An origin that left the page (its list redrew) is dropped: the close then simply leaves instead of shrinking into
 *     nothing.
 *
 * ── HOW IT MOVES ────────────────────────────────────────────────────────────────────────────────────────────────────
 * The picked client's motion, measured against the whole screen: a `clip-path` from the tapped thing's rect
 * (`rectClip`) to the full screen, on THE ONE rise (`RISE_MS` · `RISE_EASE` — 0.7 s once #7431 lands; no number here),
 * the content coming up from 60 % (v119 `riseSheet`). The close plays the SAME frames with `direction: 'reverse'`, so it
 * is the exact reverse by construction. 🎞 Since 2026-11-13 ("Motion system approved") the whole grow — shape, page
 * behind, label, three content steps, chrome last, close = mirror at 80 % — is `playRiseScreen` below. Reduced motion: the short cross-fade (`RISE_REDUCED_MS`).
 *
 * 🔒 app/_components/rise/the-rise-screen-is-one-full-screen.test.ts
 */
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';
import { bodySteps, labelFrames, playGrow } from '@/lib/grow-motion';

/** How long a press stays "the thing you just tapped". A state change, an address write and a stream all land within it. */
export const RISE_ORIGIN_FRESH_MS = 1500;

/** What may be a rise's origin — the pressable things (frames only on what you press, T18). */
export const RISE_ORIGIN_PRESSABLE = 'button,a[href],[role="button"],[role="tab"],[role="switch"],summary,[data-rise-from]';

export type RisePress<E> = { el: E; at: number } | null;
export type RiseRect = { top: number; left: number; width: number; height: number };
export type RiseViewport = { width: number; height: number };

/**
 * The origin for a rise opening at `now`: the last press, if it is fresh and still on the page; otherwise none (the
 * screen simply appears). Pure — `connected` is the caller's `el.isConnected`.
 */
export function pickRiseOrigin<E>(press: RisePress<E>, now: number, connected: (el: E) => boolean): E | null {
  if (!press) return null;
  if (now - press.at < 0 || now - press.at > RISE_ORIGIN_FRESH_MS) return null;
  return connected(press.el) ? press.el : null;
}

/** `clip-path` that frames `rect` inside the screen — the open's first frame and the close's last (`rectClip`'s rule). */
export function riseClip(rect: RiseRect, vp: RiseViewport): string {
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, vp.width - (rect.left + rect.width));
  const bottom = Math.max(0, vp.height - (rect.top + rect.height));
  const r = (n: number) => Math.round(n * 10) / 10;
  return `inset(${r(top)}px ${r(right)}px ${r(bottom)}px ${r(left)}px round 14px)`;
}

export const RISE_FULL_CLIP = 'inset(0px 0px 0px 0px round 0px)';

/**
 * The rise as frames + timing. The close plays these same frames backwards. Reduced motion → the short fade. No origin
 * → null: it simply appears, and simply leaves.
 */
export function riseScreenMotion(
  from: RiseRect | null,
  vp: RiseViewport,
  reduced: boolean,
): { frames: Keyframe[]; timing: KeyframeAnimationOptions } | null {
  if (reduced) return { frames: [{ opacity: 0 }, { opacity: 1 }], timing: { duration: RISE_REDUCED_MS, easing: 'linear' } };
  if (!from) return null;
  // 🎞 2026-11-13: the shape is the clip alone, on one layer (the approved grow — no half-faded start); 360 ms emphasized.
  return {
    frames: [{ clipPath: riseClip(from, vp) }, { clipPath: RISE_FULL_CLIP }],
    timing: { duration: RISE_MS, easing: RISE_EASE },
  };
}

/**
 * 🎞 PLAY THE GROW on a Rise full screen (owner 2026-11-13, "Motion system approved"): the shape (the clip from the
 * tapped thing), the page behind stepping back to .96 under a dim, the tapped thing's words travelling into the title,
 * the content in three steps 40 ms apart, ✕ / ⓘ and the thumb bar last — and on `close` the mirror at 80 %, chrome
 * first, into the same thing. Reads the screen's own anchors (`data-rise-head` · `data-rise-body` · `data-rise-close` ·
 * `data-rise-info-button` · `data-rise-thumb`). Reduced motion: the 120 ms cross-fade alone. Resolves when it has played.
 */
export function playRiseScreen(
  el: HTMLElement,
  m: { frames: Keyframe[] },
  origin: HTMLElement | null,
  { close = false, reduced = false }: { close?: boolean; reduced?: boolean } = {},
): Promise<void> {
  const title = el.querySelector<HTMLElement>('[data-rise-head] b');
  const words = origin && title ? riseRectOf(origin) : null;
  const lands = title ? riseRectOf(title) : null;
  const inner = el.querySelector('[data-rise-body]')?.firstElementChild ?? null;
  return playGrow(
    {
      shape: { el, frames: m.frames },
      label: title && words && lands ? { el: title, frames: labelFrames({ ...words, width: lands.width }, lands) } : null,
      ...bodySteps(el.querySelector('[data-rise-head] small'), inner),
      chrome: Array.from(el.querySelectorAll('[data-rise-close], [data-rise-info-button]')),
      bar: Array.from(el.querySelectorAll('[data-rise-thumb]')),
      behind: true,
      layer: el,
    },
    { close, reduced },
  );
}

function riseRectOf(el: Element): RiseRect | null {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

// ── the client half: noting presses ─────────────────────────────────────────────────────────────────────────────────

let last: RisePress<HTMLElement> = null;
let installed = false;

function note(target: EventTarget | null) {
  const el = typeof Element !== 'undefined' && target instanceof Element ? target.closest<HTMLElement>(RISE_ORIGIN_PRESSABLE) : null;
  if (el) last = { el, at: Date.now() };
}

/** Start noting presses (idempotent; client only). Capture phase, passive — it never stops or changes a tap. */
export function watchRiseOrigins(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', (e) => note(e.target), { capture: true, passive: true });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') note(e.target);
    },
    { capture: true, passive: true },
  );
}

/**
 * The element a rise opening now should grow out of — or null (it simply appears). Read, never consumed: React's dev
 * double-effect reads it twice for one opening, and a later rise is told apart by its own, newer press.
 */
export function riseOriginNow(): HTMLElement | null {
  return pickRiseOrigin(last, Date.now(), (x) => x.isConnected);
}
