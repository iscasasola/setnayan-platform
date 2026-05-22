'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Resizable column divider for event-home (Claude Desktop pattern).
 *
 * Owner directive 2026-05-22 follow-up: "the column divider can be
 * adjusted just like claude desktop." Replaces the static 50/50 split
 * with a draggable boundary the host can drop anywhere in the 30–70%
 * range. Preference persists per browser via localStorage; double-
 * clicking the handle (or pressing Space/Enter when focused) snaps
 * back to 50/50. Arrow keys nudge 2% at a time when focused; Home /
 * End jump to the min / max.
 *
 * Mobile (<lg): no split, no handle. The component still renders the
 * inline `gridTemplateColumns` style but it's a no-op because the
 * `lg:grid` class doesn't activate `display: grid` until 1024px+.
 * The handle is `hidden` below the lg breakpoint.
 *
 * Why a client component: useState for the split position, useEffect
 * for localStorage hydration, pointer events for the drag, refs for
 * setPointerCapture (smooth drag even when the cursor leaves the
 * handle's hit area).
 *
 * Hydration: SSR renders with DEFAULT_SPLIT (50%), client hydrates,
 * useEffect reads localStorage and updates to the persisted value.
 * Brief one-frame flash on first paint after hydration — accepted
 * tradeoff vs cookie-based SSR pre-read (more infra).
 */

const STORAGE_KEY = 'setnayan:event-home-split';
const DEFAULT_SPLIT = 50;
const MIN_SPLIT = 30;
const MAX_SPLIT = 70;
const KEYBOARD_STEP_PCT = 2;
const DESKTOP_BREAKPOINT_PX = 1024;

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

export function EventHomeSplitView({ left, right }: Props) {
  const [splitPct, setSplitPct] = useState<number>(DEFAULT_SPLIT);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = parseFloat(stored);
    if (Number.isFinite(parsed) && parsed >= MIN_SPLIT && parsed <= MAX_SPLIT) {
      setSplitPct(parsed);
    }
  }, []);

  // Persist on change. Runs even on the initial hydration write so the
  // localStorage value matches what's rendered if the user opens the
  // page on a fresh browser (initial write = DEFAULT_SPLIT).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(splitPct));
  }, [splitPct]);

  const isDesktop = useCallback(() => {
    return typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT_PX;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop()) return;
      e.preventDefault();
      setIsDragging(true);
      handleRef.current?.setPointerCapture(e.pointerId);
    },
    [isDesktop],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      const clamped = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, pct));
      setSplitPct(clamped);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      handleRef.current?.releasePointerCapture(e.pointerId);
    },
    [isDragging],
  );

  const onDoubleClick = useCallback(() => {
    setSplitPct(DEFAULT_SPLIT);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPct((p) => Math.max(MIN_SPLIT, p - KEYBOARD_STEP_PCT));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPct((p) => Math.min(MAX_SPLIT, p + KEYBOARD_STEP_PCT));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitPct(MIN_SPLIT);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSplitPct(MAX_SPLIT);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setSplitPct(DEFAULT_SPLIT);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative lg:grid lg:items-start ${
        isDragging ? 'select-none' : ''
      }`}
      style={{
        gridTemplateColumns: `${splitPct}% 1fr`,
      }}
    >
      <section className="space-y-8 lg:min-w-0 lg:pr-8">{left}</section>

      <aside className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:border-l lg:border-ink/10 lg:pl-8">
        {right}
      </aside>

      {/* Drag handle — desktop-only. Sits on top of the aside's left border
       *  line (the visible divider). Wider hit area (12px) than the visible
       *  border (1px) so it's easy to grab; centered on the boundary via
       *  -translate-x-1/2. Cursor switches to col-resize on hover, subtle
       *  terracotta tint signals "interactive"; firmer tint while dragging.
       *  touchAction:none prevents iPad pull-to-scroll during a drag. */}
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns — drag to adjust, double-click to reset"
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        aria-valuenow={Math.round(splitPct)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        className={`hidden transition-colors lg:absolute lg:top-0 lg:bottom-0 lg:block lg:w-3 lg:-translate-x-1/2 lg:cursor-col-resize ${
          isDragging
            ? 'lg:bg-terracotta/20'
            : 'lg:bg-transparent lg:hover:bg-terracotta/10'
        } lg:focus-visible:outline lg:focus-visible:outline-2 lg:focus-visible:outline-terracotta/40`}
        style={{
          left: `${splitPct}%`,
          touchAction: 'none',
        }}
      />
    </div>
  );
}
