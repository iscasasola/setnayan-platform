'use client';

/**
 * team-summary-chip.tsx — the MOBILE team summary chip
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §5, owner-approved 2026-07-29).
 *
 * PR-3 removed the takeover's 4-chip mobile dock (the page is one scroll; the
 * Coverage Strip is the navigator). Three of those chips needed no replacement,
 * but **Build** did — it was the one that carried live state. This chip is that
 * replacement, and it is strictly better than the tab it replaces: it is itself
 * information.
 *
 *     ● 2 locked · ◕ 3 in build · ₱82,000 to spare      → tap = Your team
 *
 * DELIBERATE CHOICES:
 *   • It is NOT a <SubNav>. SubNav registers itself in a docked-count store and
 *     the global bottom nav collapses to icons-only while that count is > 0 —
 *     re-collapsing the bar is exactly the two-stacked-bars problem PR-3 just
 *     removed. So this borrows SubNav's GEOMETRY (inset 14px, frosted paper,
 *     `--sn-bottomnav-h` + 20px, `z-20` under the nav's `z-30`) and none of its
 *     coordination.
 *   • It PORTALS to <body>. `position: fixed` is relative to the nearest
 *     transformed/filtered ancestor, and the takeover's glass surfaces carry
 *     backdrop-filter — the same reason `category-search-overlay.tsx` portals.
 *   • It flags `<html>` so `globals.css` pads the scroll column clear of it,
 *     reusing the `.subnav-docked` clearance rule rather than inventing a second
 *     magic number.
 *   • Copy comes from the SHIPPED tiles, not the prototype: the buffer string is
 *     `bufferTile()`'s ("₱x to spare" / "₱x over" / "No budget set"), so the chip
 *     and the Buffer tile can never word the same number two ways.
 *   • Lucide icons, never the prototype's ●/◕ glyphs (house rule).
 *
 * Rendered only behind `isExploreReplanEnabled()` by `build-locked.tsx`, and only
 * when there is something to report (≥1 locked or ≥1 candidate) — a chip reading
 * "0 locked · 0 in build" is noise, and the section is one scroll away anyway.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Hammer, Lock } from 'lucide-react';
import { goToBuildTab } from '@/lib/budget-build';
import { haptic } from '@/lib/haptics';

export function TeamSummaryChip({
  lockedCount,
  inBuildCount,
  bufferText,
  bufferTone,
}: {
  lockedCount: number;
  inBuildCount: number;
  /** `bufferTile().text` — already worded ("₱82,000 to spare" / "No budget set"). */
  bufferText: string;
  /** `bufferTile().tone` — 'over' is the only one that earns a colour. */
  bufferTone: 'good' | 'over' | 'none';
}) {
  // Portal target resolves on the client only (no document during SSR), which
  // also means the chip never appears in the server HTML — it slides in with
  // hydration, like the rest of the mobile chrome.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Bottom clearance for the scroll column — shares the removed dock's clearance
  // rule in globals.css but under its OWN class, deliberately: if the chip and a
  // dock ever mount together (e.g. the flag half-flipped mid-rollout), two
  // components add/remove the SAME class and whichever unmounts first strips the
  // clearance the other still needs. Cancelled ≥1024px, where the chip is
  // `lg:hidden`.
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add('teamchip-docked');
    return () => el.classList.remove('teamchip-docked');
  }, []);

  if (!mounted) return null;

  const summary = `${lockedCount} locked, ${inBuildCount} in build, ${bufferText}`;

  return createPortal(
    <button
      type="button"
      aria-label={`Your team — ${summary}. Open Your team.`}
      onClick={() => {
        haptic('tick');
        goToBuildTab('build');
      }}
      // Geometry mirrors <SubNav> so the chip docks exactly where the shelf used
      // to: inset 14px, 8px above the bottom nav's REAL measured height
      // (--sn-bottomnav-h, published by NavShell's ResizeObserver) + its 12px
      // float offset. z-20 sits under the nav (z-30) and far under the category
      // search overlay (z-120).
      className="subnav-lift fixed inset-x-[14px] z-20 flex select-none items-center justify-center gap-2 rounded-full border px-4 py-2.5 backdrop-blur lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + var(--sn-bottomnav-h, 64px) + 20px)',
        background: 'rgba(248, 246, 240, 0.92)',
        borderColor: 'var(--m-line)',
        boxShadow: '0 10px 30px -12px rgba(30, 34, 41, 0.35)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 shrink-0 text-mulberry" strokeWidth={2} aria-hidden />
        <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink">
          {lockedCount} locked
        </span>
      </span>
      <span aria-hidden className="text-ink/25">
        ·
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <Hammer className="h-3.5 w-3.5 shrink-0 text-ink/55" strokeWidth={2} aria-hidden />
        <span className="whitespace-nowrap text-[12.5px] text-ink/70">
          {inBuildCount} in build
        </span>
      </span>
      <span aria-hidden className="text-ink/25">
        ·
      </span>
      {/* Truncates first — the two counts are short and fixed, the money string
          is the one that can run long on a 320px screen. Tone classes are
          LockTile's verbatim, so the chip and the Buffer tile colour the same
          number the same way. */}
      <span
        className={`min-w-0 truncate text-[12.5px] ${
          bufferTone === 'over'
            ? 'font-semibold text-danger-700'
            : bufferTone === 'good'
              ? 'text-success-700'
              : 'text-ink/70'
        }`}
      >
        {bufferText}
      </span>
    </button>,
    document.body,
  );
}
