/**
 * search-pin.ts — 📌 A SEARCH SHOWS ITS FIRST RESULT (owner 2026-10-24, live, on the Guest list: *"When we search
 * something on their respective search bars, it does not pin up to the first search result … there is a result but I
 * need to scroll up to find them."* — and, on a name that matched nobody, the "＋ Add …" row sat under the band).
 *
 * Why it happened: a typed search shrinks the page under the reader, and the browser keeps the scroll where it was — at
 * the foot of a list that is now much shorter, so the hit is ABOVE the screen; and with the keyboard up, what is left of
 * the screen is a strip between the top chrome and the typing band, so the no-match block's Add button (the last thing
 * in a tall block) sat behind the band and the keyboard.
 *
 * ONE MECHANISM, for every bottom search (`useRidingRow` in `typing-band.tsx` calls `useSearchPin`, so every ThumbRow
 * and every other riding row has it, with nothing at the call): when the words in the row's field change, and once
 * they have been still for `PIN_IDLE_MS`, the page scrolls so that —
 *   · the FIRST RESULT sits just under the page's top chrome (the shell bar, a sticky head, a sticky section head):
 *     the first `[data-search-result]` on the page, else the start of `[data-search-results]` (a page marks the one it
 *     has — a row, or the box its results draw in);
 *   · with no result, the ADD row is what shows: `[data-search-add]` (SearchAddRow) or `[data-search-none]` (a page's
 *     own no-match add) stands just ABOVE the band (its foot on the band's top, never its top under the chrome).
 * Results that draw later (a server read, a re-render) are followed for `PIN_WATCH_MS` after the last key.
 * 🖐 NEVER WHILE THE READER SCROLLS: a finger moving on the page or a wheel stops the pin until the next key.
 *
 * The page only marks what is a result. The arithmetic is pure (`pinDelta`), and held by
 * `lib/a-search-pins-its-first-result.test.ts`.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { readKeyboard } from '@/lib/keyboard-ride';

/** Still for this long after the last key → pin (no jump on every keystroke). */
export const PIN_IDLE_MS = 150;
/** Results drawn after the pin (a server read, a re-render) are followed this long after the last key. */
export const PIN_WATCH_MS = 4000;
/** A hand on the page this recently → no pin. */
export const PIN_HANDS_OFF_MS = 600;
/** Once more after the chrome has stopped moving (the sticky block eases its `top` over 300 ms). */
export const PIN_SETTLE_MS = 360;
/** Room kept between the pinned box and the chrome / the band. */
export const PIN_GAP = 8;

/** What a page marks, in the order the pin looks for it. `edge` = which edge of the screen's clear strip it pins to. */
export const PIN_ORDER: ReadonlyArray<{ selector: string; edge: 'top' | 'bottom' }> = [
  { selector: '[data-search-result]', edge: 'top' },
  { selector: '[data-search-results]', edge: 'top' },
  { selector: '[data-search-add]', edge: 'bottom' },
  { selector: '[data-search-none]', edge: 'bottom' },
];

type Span = { top: number; bottom: number };

/**
 * How far to scroll (positive = further down the page). `top`: the box's top just under the chrome. `bottom`: the box's
 * foot just above the band — but never so far that its top goes under the chrome (a box taller than the strip shows its
 * top).
 */
export function pinDelta(box: Span, clear: Span, edge: 'top' | 'bottom', gap = PIN_GAP): number {
  const byTop = box.top - (clear.top + gap);
  if (edge === 'top') return Math.round(byTop);
  const byFoot = box.bottom - (clear.bottom - gap);
  return Math.round(Math.min(byFoot, byTop));
}

/** Whether a pin may run now: words in the box, and no hand on the page. */
export function mayPin(s: { words: string; now: number; handAt: number; touching: boolean }): boolean {
  return s.words.trim().length > 0 && !s.touching && s.now - s.handAt >= PIN_HANDS_OFF_MS;
}

/* ── the hand on the page (one listener for every row) ─────────────────────────────────────────────────────────── */
let handAt = -Infinity;
let touching = false;
let handListeners = 0;
const handWatchers = new Set<() => void>();
const onHand = () => {
  handAt = performance.now();
  for (const fn of handWatchers) fn();
};
const onTouchStart = () => {
  touching = true;
};
const onTouchEnd = () => {
  touching = false;
};
const onTouchMove = () => {
  touching = true;
  onHand();
};
function listenForHands(): () => void {
  if (handListeners++ === 0) {
    window.addEventListener('wheel', onHand, { passive: true, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
  }
  return () => {
    if (--handListeners === 0) {
      window.removeEventListener('wheel', onHand, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      touching = false;
    }
  };
}

/* ── the DOM half ──────────────────────────────────────────────────────────────────────────────────────────────── */
const drawn = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden';
};

/** The box to pin, and to which edge. */
export function searchPinTarget(doc: Document = document): { el: HTMLElement; edge: 'top' | 'bottom' } | null {
  for (const { selector, edge } of PIN_ORDER) {
    for (const el of doc.querySelectorAll<HTMLElement>(selector)) if (drawn(el)) return { el, edge };
  }
  return null;
}

const stuck = (el: Element) => {
  const p = getComputedStyle(el).position;
  return p === 'fixed' || p === 'sticky';
};

/** The top of what can be seen under the chrome: stacked fixed / sticky boxes from the visible top down (the shell bar,
 *  a sticky page head, a sticky section head) — never one that holds the target. */
function chromeFoot(target: Element, from: number): number {
  let y = from;
  const xs = [0.25, 0.5, 0.75].map((f) => Math.round(window.innerWidth * f));
  for (let pass = 0; pass < 5; pass++) {
    let next = y;
    for (const x of xs) {
      for (const hit of document.elementsFromPoint(x, y + 1)) {
        for (let n: Element | null = hit; n && n !== document.body; n = n.parentElement) {
          if (!stuck(n) || n.contains(target)) continue;
          const r = n.getBoundingClientRect();
          // A bar at the foot, a sheet, or anything taller than half the screen is not top chrome.
          if (r.top > y + 1 || r.bottom <= y || r.height > window.innerHeight * 0.45) continue;
          next = Math.max(next, r.bottom);
        }
      }
    }
    if (next <= y) break;
    y = next;
  }
  return y;
}

/**
 * 🧷 THE HEADS THAT WILL STICK OVER THE RESULT (owner 2026-10-25, live, Guest list: *"Search is still not showing the
 * first search result properly"* — the first hit sat UNDER the sticky "VIP · 2" section head). `chromeFoot` reads what
 * is stuck NOW; a section head sitting in the flow above its first row only sticks once the pin has scrolled the page
 * under it, and the page's own sticky block animates its `top`, so the hit-test missed it. This reads every sticky box
 * that comes BEFORE the target inside one of its containers (the section head, the page's sticky block) by its own
 * resolved `top` — where it WILL rest once stuck — so the result is pinned under its foot, stuck yet or not.
 * 🛑 It stops at `scroller` (the result's own `overflow:auto` box): inside it a sticky `top` is measured from the
 * scroller's top edge (the caller adds `s.top`), and anything stuck outside it is already the scroller's top or
 * `chromeFoot`'s — counting it here as well would add the page head twice and pin the result too low.
 */
export function stickyHeadsFoot(target: Element, scroller: Element | null = null): number {
  let foot = 0;
  const t = target.getBoundingClientRect();
  for (let child: Element = target, box = target.parentElement; box && box !== document.body; child = box, box = box === scroller ? null : box.parentElement) {
    for (const sib of Array.from(box.children)) {
      if (sib === child) break; // only what comes before the target's branch
      if (getComputedStyle(sib).position !== 'sticky') continue;
      const r = sib.getBoundingClientRect();
      if (r.height <= 0 || r.height > window.innerHeight * 0.45) continue;
      // Only a head ABOVE the result — a sticky rail BESIDE it (a desktop column) never covers it.
      if (r.right <= t.left || r.left >= t.right) continue;
      const top = parseFloat(getComputedStyle(sib).top);
      if (Number.isFinite(top)) foot = Math.max(foot, top + r.height);
    }
  }
  return foot;
}

/** The top of the band and the riding row (the band is drawn above the row, outside its layer's box), else the
 *  keyboard's top, else the bottom bar's — whichever is highest. */
function bandTop(): number {
  const k = readKeyboard();
  let floor = k.present ? Math.min(window.innerHeight, k.offsetTop + k.height) : window.innerHeight;
  for (const el of document.querySelectorAll('[data-ride-band], [data-ride-row], [data-bottom-dock], [data-thumb-row]')) {
    if (!drawn(el)) continue;
    const r = el.getBoundingClientRect();
    // Only what stands at the foot (a top-pinned desktop bar is chrome, not a floor).
    if (r.top > window.innerHeight * 0.4) floor = Math.min(floor, r.top);
  }
  return floor;
}

/** The box that scrolls `el` — its nearest scrolling ancestor, else the page (null). */
function scrollerOf(el: Element): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll' || o === 'overlay') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Pin once. Returns how far it scrolled (0 when there was nothing to pin or it already sat there). */
export function pinFirstResult(): number {
  if (typeof window === 'undefined') return 0;
  const t = searchPinTarget();
  if (!t) return 0;
  const scroller = scrollerOf(t.el);
  let moved = 0;
  // Two passes: a sticky head only sticks once the page has scrolled under it.
  for (let pass = 0; pass < 2; pass++) {
    const k = readKeyboard();
    const s = scroller?.getBoundingClientRect();
    const top = Math.max(
      chromeFoot(t.el, Math.max(k.present ? k.offsetTop : 0, s?.top ?? 0)),
      s?.top ?? 0,
      // Heads that stick over the result once the page moves under them (a section head, a sticky page head).
      t.edge === 'top' ? (s?.top ?? 0) + stickyHeadsFoot(t.el, scroller) : 0,
    );
    const bottom = Math.min(bandTop(), s?.bottom ?? Infinity);
    const r = t.el.getBoundingClientRect();
    const by = pinDelta({ top: r.top, bottom: r.bottom }, { top, bottom }, t.edge);
    if (Math.abs(by) < 1) break;
    const before = scroller ? scroller.scrollTop : window.scrollY;
    (scroller ?? window).scrollBy({ top: by, behavior: 'instant' as ScrollBehavior });
    const did = (scroller ? scroller.scrollTop : window.scrollY) - before;
    moved += did;
    if (Math.abs(did) < 1) break; // the page cannot go further
  }
  return moved;
}

/**
 * 📌 THE HOOK — `useRidingRow` mounts it on its row. `poke(words)` after a key: pin once the words are still, then follow
 * late results for a while. On mount, a field that already holds words (a `?q=` the page arrived with) pins too.
 */
export function useSearchPin(rowRef: RefObject<HTMLElement | null>): { poke: (words: string) => void } {
  const words = useRef('');
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const until = useRef(0);
  const watch = useRef<MutationObserver | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
    watch.current?.disconnect();
    watch.current = null;
    until.current = 0;
  }, []);

  const pinNow = useCallback(() => {
    idle.current = null;
    if (!mayPin({ words: words.current, now: performance.now(), handAt, touching })) return;
    pinFirstResult();
    // The chrome may still be moving (the sticky block's `top` eases over 300 ms when the shell bar hides or shows) —
    // pin once more after it has come to rest, still only with no hand on the page.
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      settle.current = null;
      if (mayPin({ words: words.current, now: performance.now(), handAt, touching })) pinFirstResult();
    }, PIN_SETTLE_MS);
  }, []);

  const later = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(pinNow, PIN_IDLE_MS);
  }, [pinNow]);

  const poke = useCallback(
    (w: string) => {
      words.current = w;
      if (!w.trim()) return stop();
      until.current = performance.now() + PIN_WATCH_MS;
      later();
      if (!watch.current && typeof MutationObserver !== 'undefined') {
        watch.current = new MutationObserver(() => {
          if (performance.now() > until.current) {
            watch.current?.disconnect();
            watch.current = null;
            return;
          }
          later();
        });
        watch.current.observe(document.body, { childList: true, subtree: true });
      }
    },
    [later, stop],
  );

  useEffect(() => {
    const unlisten = listenForHands();
    // A hand on the page, or a press anywhere but the row (a result opened), ends the follow until the next key.
    const handsOn = () => stop();
    handWatchers.add(handsOn);
    const onPress = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) stop();
    };
    window.addEventListener('pointerdown', onPress, true);
    // Arrived with words (`?q=`): pin them.
    const field = rowRef.current?.querySelector<HTMLInputElement>('input[type="search"], input[type="text"], input:not([type])');
    if (field?.value.trim()) poke(field.value);
    return () => {
      handWatchers.delete(handsOn);
      window.removeEventListener('pointerdown', onPress, true);
      unlisten();
      stop();
    };
    // Mount-only: the row and its field are the same for the row's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { poke };
}
