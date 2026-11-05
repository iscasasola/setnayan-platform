'use client';

/**
 * 🔭 REVEAL ON OPEN (owner 2026-11-04, APP-WIDE) — the ONE implementation. After a user opens a section and its motion
 * settles, if any of it sits below the visible area, the scroll glides so its HEAD sits on the pin line. Fits → nothing.
 * The rule itself is `reveal-engine.ts`, its DOM side `reveal-dom.ts` — both loaded on the FIRST open (⚡ this file is
 * in every page's first load, the Maker's included, so it carries only the press and the lazy call). It holds:
 *
 *   · `useRevealOnOpen` — every expand/collapse joins with one call (the shared `Fold`, `Collapsible`,
 *     `FeatureAccordion`). Only a closed → open CHANGE that a user caused reveals: never a fold open on load, restored
 *     state, or a `#hash` (that path scrolls on its own).
 *   · `RevealDetailsOnOpen` — the same for every native `<details>`, from one listener in the root layout.
 *
 * Where the pin line and the visible bottom are: `reveal-dom.ts`.
 *
 * 🖥 From 701 a supplier list opens a row in the RIGHT column (`supplier-open-row.tsx`): the row's fold stays SHUT
 * there, so nothing reveals — the content is already beside the list.
 * 🔒 app/_components/reveal-on-open.test.ts · app/_components/every-fold-reveals-on-open.test.ts
 */
import { useEffect, useRef } from 'react';
import { isUserOpen } from './reveal-intent';

/** A user's tap or key counts as the cause of an open that lands within this long of it. */
const GESTURE_MS = 1000;

const INPUT = ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const;

/**
 * Glide `head`…`end` into view, under the pin line, once it settles. Returns cancel. The engine is import()ed here; a
 * touch, wheel or key while it is still on its way cancels it, exactly as one does mid-glide.
 */
export function revealSection(head: Element, end: Element = head, opts: { minWaitMs?: number } = {}): () => void {
  let cancel: (() => void) | null = null;
  let gone = false;
  const stop = () => {
    gone = true;
    for (const k of INPUT) window.removeEventListener(k, stop, { capture: true });
    cancel?.();
  };
  for (const k of INPUT) window.addEventListener(k, stop, { capture: true, passive: true });
  void import('./reveal-dom').then((m) => {
    for (const k of INPUT) window.removeEventListener(k, stop, { capture: true });
    if (!gone) cancel = m.revealSection(head, end, opts);
  });
  return stop;
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
