'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Resizable left sidebar for the event-scoped dashboard.
 *
 * Owner directive 2026-05-23: "make sidebar resizable also." Mirrors
 * the column-divider pattern shipped in EventHomeSplitView (PR #384):
 * pointer events for drag, localStorage for persistence, keyboard
 * nudges, double-click to reset. Handle sits on top of the sidebar's
 * right border (the visible divider between sidebar and body), 12px-
 * wide hit zone centered on that border.
 *
 * Architecture — CSS variable on <html>:
 *   - SSR renders both the layout's body padding and the BottomNav
 *     sidebar's width at the 240px default (no FOUC because the
 *     CSS-variable fallback in `var(--sidebar-width, 240px)` resolves
 *     during SSR + first paint before this component mounts).
 *   - On mount, this component reads localStorage and writes the
 *     persisted width to `document.documentElement.style.setProperty
 *     ('--sidebar-width', ...)`. Layout + sidebar both read the
 *     variable so they update in lockstep — no prop drilling, no
 *     React context for cross-tree styling.
 *   - On drag / keyboard / double-click, the same setProperty fires.
 *     localStorage write happens in the same handler so reloads
 *     replay the user's last value.
 *
 * Why CSS variable over context: the layout is a SERVER component
 * (it reads auth, role grants, locale, switcher events) and the
 * BottomNav is a CLIENT component (uses usePathname). Threading a
 * shared client-context provider between them would require wrapping
 * the layout's children in a new client boundary, which would force
 * every server-component descendant to re-evaluate as a client tree.
 * CSS-variable approach keeps both trees untouched — the variable
 * lives on <html>, the styles read it, no React state crossing
 * boundaries.
 *
 * Mobile (<lg): handle renders nothing (`hidden lg:block`) and the
 * sidebar is hidden by the existing `lg:flex` class on BottomNav.
 * The CSS variable still gets set, but no element consumes it below
 * the lg breakpoint, so it's a no-op.
 *
 * Hydration: SSR renders with --sidebar-width unset → fallback 240px
 * applies. Client mounts, reads localStorage, sets the variable. If
 * the persisted value differs from 240px, the layout shifts on the
 * first useEffect tick — accepted tradeoff vs cookie-based SSR pre-
 * read (more infra, same end-state). Mirrors the same one-frame flash
 * pattern EventHomeSplitView accepted in PR #384.
 */

const STORAGE_KEY = 'setnayan:dashboard-sidebar-width';
const CSS_VAR = '--sidebar-width';
const DEFAULT_WIDTH_PX = 240;
const MIN_WIDTH_PX = 200; // any narrower hides labels
const MAX_WIDTH_PX = 360; // don't dominate the viewport
const KEYBOARD_STEP_PX = 10;
const DESKTOP_BREAKPOINT_PX = 1024;

function clamp(value: number): number {
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, value));
}

function setCssVar(widthPx: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(CSS_VAR, `${widthPx}px`);
}

export function SidebarResizeHandle() {
  const [widthPx, setWidthPx] = useState<number>(DEFAULT_WIDTH_PX);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const handleRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount. Set the CSS variable in the
  // same tick so the layout doesn't re-render — Tailwind classes
  // consume var(--sidebar-width), so DOM updates without React
  // re-rendering the layout tree.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First-visit case: explicitly set the var to the default so
      // any later style queries see a concrete value, not "fall back
      // to the inline default". Belt-and-suspenders.
      setCssVar(DEFAULT_WIDTH_PX);
      return;
    }
    const parsed = parseFloat(stored);
    if (Number.isFinite(parsed)) {
      const clamped = clamp(parsed);
      setWidthPx(clamped);
      setCssVar(clamped);
    }
  }, []);

  // Persist + push to CSS on every state change. The setCssVar call
  // here covers keyboard + double-click paths (drag handler also calls
  // it directly for low-latency updates, but this useEffect is the
  // canonical persistence hook so React state stays the source of
  // truth for non-drag interactions).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(widthPx));
    setCssVar(widthPx);
  }, [widthPx]);

  // Cleanup on unmount: clear the body's select-none class would-be
  // lingering from a drag-in-progress unmount. Defensive — React
  // strict mode double-mounts components in dev, this guards against
  // a stale select-none surviving a remount cycle.
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('select-none');
      }
    };
  }, []);

  const isDesktop = useCallback(() => {
    return typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT_PX;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop()) return;
      e.preventDefault();
      setIsDragging(true);
      handleRef.current?.setPointerCapture(e.pointerId);
      // Lock text selection on the whole body during drag — the cursor
      // sweeps over sidebar links + body content and we don't want
      // partial-selection halos lighting up.
      document.body.classList.add('select-none');
    },
    [isDesktop],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      // Width = horizontal cursor position relative to viewport left
      // edge (sidebar is `lg:left-0` so viewport-left = sidebar-left).
      // Clamp inline to keep the drag responsive even past min/max.
      const clamped = clamp(e.clientX);
      // Direct CSS-variable write for low-latency drag — bypasses
      // React reconciliation. React state still updates so the
      // persistence + keyboard handlers stay coherent, but the
      // sidebar + body padding react to the variable change
      // immediately (no React tick required).
      setCssVar(clamped);
      setWidthPx(clamped);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      handleRef.current?.releasePointerCapture(e.pointerId);
      document.body.classList.remove('select-none');
    },
    [isDragging],
  );

  const onDoubleClick = useCallback(() => {
    setWidthPx(DEFAULT_WIDTH_PX);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setWidthPx((w) => Math.max(MIN_WIDTH_PX, w - KEYBOARD_STEP_PX));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setWidthPx((w) => Math.min(MAX_WIDTH_PX, w + KEYBOARD_STEP_PX));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setWidthPx(MIN_WIDTH_PX);
    } else if (e.key === 'End') {
      e.preventDefault();
      setWidthPx(MAX_WIDTH_PX);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setWidthPx(DEFAULT_WIDTH_PX);
    }
  }, []);

  return (
    // Drag handle — desktop-only. Fixed-positioned to align with the
    // sidebar's right border (the visible divider). 12px-wide hit zone
    // centered on the border via `-translate-x-1/2` + `left: var(...)`.
    // Sits at z-40 so it floats above the sidebar (z-30) — without this
    // the handle would be occluded by the sidebar's right edge.
    // touchAction:none prevents iPad pull-to-scroll during drag.
    // tabIndex=0 makes it keyboard-reachable via Tab from the sidebar.
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar — drag to adjust, double-click to reset"
      aria-valuemin={MIN_WIDTH_PX}
      aria-valuemax={MAX_WIDTH_PX}
      aria-valuenow={Math.round(widthPx)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={`hidden transition-colors lg:fixed lg:top-0 lg:bottom-0 lg:z-40 lg:block lg:w-3 lg:-translate-x-1/2 lg:cursor-col-resize ${
        isDragging
          ? 'lg:bg-terracotta/20'
          : 'lg:bg-transparent lg:hover:bg-terracotta/10'
      } lg:focus-visible:outline lg:focus-visible:outline-2 lg:focus-visible:outline-terracotta/40`}
      style={{
        left: `var(${CSS_VAR}, ${DEFAULT_WIDTH_PX}px)`,
        touchAction: 'none',
      }}
    />
  );
}
