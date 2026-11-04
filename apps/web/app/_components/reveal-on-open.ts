'use client';

/**
 * 🔭 REVEAL ON OPEN (owner 2026-11-04, APP-WIDE) — the ONE implementation. After a user opens a section and its motion
 * settles, if any of it sits below the visible area, the scroll glides so its HEAD sits on the pin line. Fits → nothing.
 * The rule itself is `reveal-engine.ts`; this is its DOM side:
 *
 *   · `useRevealOnOpen` — every expand/collapse joins with one call (the shared `Fold`, `Collapsible`,
 *     `FeatureAccordion`). Only a closed → open CHANGE that a user caused reveals: never a fold open on load, restored
 *     state, or a `#hash` (that path scrolls on its own).
 *   · `RevealDetailsOnOpen` — the same for every native `<details>`, from one listener in the root layout.
 *
 * THE PIN LINE: in the page, `--sn-pin-top` (`pinned-row/pin-line.ts`, joined while it runs so the number is fresh);
 * inside a box that scrolls on its own (a sheet, a panel), that box's top. Plus one slim line (`FOLD_SLIM_PX`) per OPEN
 * fold around the section — their heads pin slim there, so this head lands flush under them, never behind them.
 * THE VISIBLE BOTTOM: the box's bottom; in the page, the window less the bottom dock (`--sn-bottomdock-h`).
 *
 * 🖥 From 701 a supplier list opens a row in the RIGHT column (`supplier-open-row.tsx`): the row's fold stays SHUT
 * there, so nothing reveals — the content is already beside the list.
 * 🔒 app/_components/reveal-on-open.test.ts · app/_components/every-fold-reveals-on-open.test.ts
 */
import { useEffect, useRef } from 'react';
import { joinPinLine } from '@/app/_components/pinned-row/pin-line';
import { isUserOpen, revealAfterSettle } from './reveal-engine';

/** One slim pinned head (`fold.tsx` FOLD_SLIM_PX) — kept here as a number so this file does not import the fold. */
const SLIM_PX = 40;
/** A user's tap or key counts as the cause of an open that lands within this long of it. */
const GESTURE_MS = 1000;

/** The box this element scrolls in: the nearest ancestor that scrolls on its own, or null for the page. */
export function scrollBoxOf(el: Element): HTMLElement | null {
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
  return p && p !== document.body && p !== document.documentElement ? p : null;
}

const px = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/** Glide `head`…`end` into view, under the pin line, once it settles. Returns cancel. */
export function revealSection(head: Element, end: Element = head, opts: { minWaitMs?: number } = {}): () => void {
  const box = scrollBoxOf(head);
  let depth = 0;
  for (let p = head.parentElement; p && p !== box; p = p.parentElement) if (p.hasAttribute('data-fold-open')) depth += 1;
  const leave = box ? null : joinPinLine();
  const cancel = revealAfterSettle(
    {
      now: () => performance.now(),
      frame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
      section: () => ({ top: head.getBoundingClientRect().top, bottom: end.getBoundingClientRect().bottom }),
      view: () => {
        if (box) {
          const r = box.getBoundingClientRect();
          return { top: r.top + box.clientTop + depth * SLIM_PX, bottom: r.top + box.clientTop + box.clientHeight };
        }
        const h = window.visualViewport?.height ?? window.innerHeight;
        return { top: px('--sn-pin-top') + depth * SLIM_PX, bottom: h - px('--sn-bottomdock-h') };
      },
      getScroll: () => (box ? box.scrollTop : window.scrollY),
      setScroll: (y) => (box ?? window).scrollTo({ top: y, behavior: 'instant' }),
      reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      onInput: (cb) => {
        const kinds = ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const;
        for (const k of kinds) window.addEventListener(k, cb, { capture: true, passive: true });
        return () => {
          for (const k of kinds) window.removeEventListener(k, cb, { capture: true });
        };
      },
    },
    opts,
  );
  return () => {
    cancel();
    leave?.();
  };
}

// ── the user's last tap or key, for openers that do not own the press (Collapsible, <details>) ──
let lastGesture = -Infinity;
let tracking = false;
function trackGestures(): void {
  if (tracking || typeof window === 'undefined') return;
  tracking = true;
  const mark = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
    lastGesture = performance.now();
  };
  window.addEventListener('pointerup', mark, { capture: true, passive: true });
  window.addEventListener('keydown', mark, { capture: true, passive: true });
}
/** Did a user tap or press a key just now? */
export function userJustActed(): boolean {
  return performance.now() - lastGesture < GESTURE_MS;
}

type Section = { head: Element | null; end?: Element | null } | null;

/**
 * THE ONE WAY TO JOIN. `section()` returns the head (and, if the body is a separate element, its end). Returns
 * `intend()`: call it from the head's own press (tap or keyboard — a `<button>`'s onClick is both). An opener that does
 * not own its press passes `{ cause: 'gesture' }` instead, and any tap or key just before the open counts.
 * `intentMs`: how long an `intend()` stays good — a server-streamed body (FeatureAccordion) opens a round trip later.
 */
export function useRevealOnOpen(open: boolean, section: () => Section, opts: { cause?: 'press' | 'gesture'; intentMs?: number; minWaitMs?: number } = {}): () => void {
  const was = useRef(open);
  const intent = useRef(-Infinity);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    if (optsRef.current.cause === 'gesture') trackGestures();
  }, []);
  useEffect(() => {
    const o = optsRef.current;
    const byUser = isUserOpen({
      was: was.current,
      open,
      cause: o.cause ?? 'press',
      pressedAt: intent.current,
      gestureAt: lastGesture,
      now: performance.now(),
      windowMs: o.cause === 'gesture' ? GESTURE_MS : (o.intentMs ?? GESTURE_MS),
    });
    was.current = open;
    intent.current = -Infinity;
    if (!byUser) return;
    const s = sectionRef.current();
    if (!s?.head) return;
    return revealSection(s.head, s.end ?? s.head, { minWaitMs: o.minWaitMs });
  }, [open]);
  return () => {
    intent.current = performance.now();
  };
}

/**
 * Every native `<details>` gets the same rule from ONE capture listener (the `toggle` event does not bubble). A
 * `<details open>` in the markup fires `toggle` on load too — with no tap just before it, it is left alone.
 * `data-no-reveal` on a `<details>` opts it out (a dropdown drawn as `<details>`).
 */
export function RevealDetailsOnOpen(): null {
  useEffect(() => {
    trackGestures();
    const running = new WeakMap<HTMLDetailsElement, () => void>();
    const onToggle = (e: Event) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || d.hasAttribute('data-no-reveal')) return;
      running.get(d)?.();
      running.delete(d);
      if (!d.open || !userJustActed()) return;
      running.set(d, revealSection(d.querySelector(':scope > summary') ?? d, d));
    };
    document.addEventListener('toggle', onToggle, true);
    return () => document.removeEventListener('toggle', onToggle, true);
  }, []);
  return null;
}
