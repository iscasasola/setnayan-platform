'use client';

/**
 * Count + Fill — RULES 2 AND 3 of the button rule (owner 2026-10-07, corpus
 * `BUTTON_RULE_2026-10-07_fable.md`; reference `count()` / `money$()` /
 * `num$()` and `[data-fill]` / `.meter-fill` in
 * `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 *   Count — every number a person reads counts to its value: 0 → value on
 *           load, old → new on a change, ease-out over 420–900 ms (longer for
 *           a bigger jump), formatted on EVERY frame (₱ with separators,
 *           grouped integer, %).
 *   Fill  — every bar whose width stands for a value grows from 0 on load and
 *           slides old → new on a change (≈700 ms, ease-out).
 *
 * Both key on a stable `id`: the last value shown under that id is kept for
 * the life of the page, so a re-render — or a remount of the same figure —
 * starts from where it was, and only a REAL change moves. Reduced motion →
 * the value at once. SSR renders the final value (no hydration mismatch, JS
 * off still reads true).
 *
 * ONE ENGINE. `useCountTo` below is also what `app/_components/count-up.tsx`
 * (the shipped `CountUp` the dashboard tiles use) runs on — extended here,
 * not written twice.
 *
 * Exempt: the guest Event Hub (`app/[slug]/**`).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Last value shown per stable id — page lifetime, shared by Count and Fill. */
const lastShown = new Map<string, number>();

/**
 * Where a figure under `key` starts: the value last shown under that key, or
 * 0 the first time — and remember `value` as the new last. A re-render with
 * the same value therefore starts AT the value (no replay); only a real change
 * moves. Pure apart from the page-lifetime map; the guard runs it directly.
 */
export function startFor(key: string, value: number): number {
  const from = lastShown.get(key) ?? 0;
  lastShown.set(key, value);
  return from;
}

/** Test hook: forget every remembered value. */
export function __resetCountMemory(): void {
  lastShown.clear();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 420 ms for a small step, up to 900 ms for a big jump (the prototype's curve). */
export function countDurationMs(from: number, to: number): number {
  return Math.min(900, 420 + Math.abs(to - from) * 0.002);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export type CountToOptions = {
  /** Stable id — remembers the last value shown so re-renders do not replay. */
  id?: string;
  /** Fixed duration; omit for the 420–900 ms rule. */
  durationMs?: number;
  /** Wait before counting (CountUp's per-tile stagger). */
  delayMs?: number;
  /** Always count from 0, on load AND on change (the shipped CountUp's behaviour). */
  alwaysFromZero?: boolean;
  /** Skip the animation entirely for values ≤ 0 (CountUp's behaviour). */
  skipNonPositive?: boolean;
};

/**
 * The engine: returns the number to print this frame. First paint is the
 * final value (SSR-safe); after mount it animates from the remembered value
 * (or 0) to `value`.
 */
export function useCountTo(value: number, opts: CountToOptions = {}): number {
  const { id, durationMs, delayMs = 0, alwaysFromZero = false, skipNonPositive = false } = opts;
  const [display, setDisplay] = useState(value);
  const instanceLast = useRef<number | null>(null);

  useEffect(() => {
    const remembered = id !== undefined ? startFor(id, value) : instanceLast.current ?? 0;
    const from = alwaysFromZero ? 0 : remembered;
    instanceLast.current = value;

    if (!Number.isFinite(value) || (skipNonPositive && value <= 0) || from === value || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const d = durationMs ?? countDurationMs(from, value);
    let raf = 0;
    let start = 0;
    let shown = from;
    let done = false;
    setDisplay(from);
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / d);
        shown = Math.round(from + (value - from) * easeOutCubic(t));
        setDisplay(shown);
        if (t < 1) raf = requestAnimationFrame(tick);
        else done = true;
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      // Cut short (a newer value, or StrictMode's mount-unmount-mount): remember
      // the figure actually on screen, so the next run starts from it rather
      // than believing the old target was reached.
      if (!done) {
        if (id !== undefined) lastShown.set(id, shown);
        instanceLast.current = shown;
      }
    };
    // `id`/options are identity, not inputs — only a new value animates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export type CountFormat = 'int' | 'peso' | 'pct';

const FORMATS: Record<CountFormat, (n: number) => string> = {
  int: (n) => formatCount(n, 0),
  peso: (n) => formatPhpRounded(n),
  pct: (n) => `${formatCount(n, 0)}%`,
};

/**
 * `<Count value={12500} format="peso" id="budget-left" />` → "₱12,500",
 * counted. `format` is a name (serialisable from a server component) or, from
 * a client component, a function.
 */
export function Count({
  value,
  format = 'int',
  id,
  className,
  style,
}: {
  value: number;
  format?: CountFormat | ((n: number) => string);
  id?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const n = useCountTo(value, { id });
  const fmt = typeof format === 'function' ? format : FORMATS[format];
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }} data-count={id}>
      {fmt(n)}
    </span>
  );
}

/**
 * `<Fill value={62} id="budget-spoken" className="h-full bg-terracotta" />` —
 * a bar whose width (or height) is `value`% of its track. Grows from 0 (or the
 * remembered value) on mount, slides on change; `.fill-bar` in globals.css
 * owns the 700 ms transition and the reduced-motion jump.
 */
export function Fill({
  value,
  id,
  axis = 'width',
  className,
  style,
}: {
  /** 0–100. Clamped. */
  value: number;
  id?: string;
  axis?: 'width' | 'height';
  className?: string;
  style?: CSSProperties;
}) {
  const to = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const el = useRef<HTMLDivElement | null>(null);
  const instanceLast = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const node = el.current;
    const key = id !== undefined ? `fill:${id}` : undefined;
    const from = key !== undefined ? startFor(key, to) : instanceLast.current ?? 0;
    instanceLast.current = to;
    if (!node || from === to || prefersReducedMotion()) return;
    // Paint `from` with no transition, force a reflow, then let `.fill-bar` slide to `to`.
    node.style.transition = 'none';
    node.style[axis] = `${from}%`;
    void node.offsetWidth;
    node.style.transition = '';
    let fired = false;
    const raf = requestAnimationFrame(() => {
      fired = true;
      node.style[axis] = `${to}%`;
    });
    return () => {
      cancelAnimationFrame(raf);
      // Cut short before the slide began (StrictMode's mount-unmount-mount):
      // forget `to`, so the next run slides again instead of leaving `from`.
      if (!fired) {
        if (key !== undefined) lastShown.set(key, from);
        instanceLast.current = from;
      }
    };
    // `id` is identity, not an input — only a new value slides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, axis]);

  return (
    <div
      ref={el}
      className={['fill-bar', className].filter(Boolean).join(' ')}
      style={{ ...style, [axis]: `${to}%` }}
      data-fill={id}
      role="presentation"
    />
  );
}
