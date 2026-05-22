'use client';

import { useRouter } from 'next/navigation';

/**
 * Desktop-only click-to-select wrapper for planning cards (Finder-column UX
 * lock 2026-05-22 — CLAUDE.md owner directive).
 *
 * Clicking the card BACKGROUND (any area that's not a Link / button / role
 * button) sets `?card=<groupId>` so the right-pane EventHomeDetailPane
 * renders the selected card's expanded view. Clicks on inner interactive
 * elements (Search vendors button, Add custom dropdown, Compare drawer,
 * pick rows, paperwork sub-link, recommended-vendor row, etc.) keep their
 * native behavior — the inner element's own onClick / href runs and the
 * URL-update short-circuits via closest('a, button, [role="button"]').
 *
 * Why this pattern (vs an overlay Link absolutely positioned over the card):
 * inner interactive elements would each need explicit `relative z-10` to
 * sit above an absolute overlay, which would touch the ~30 inner CTAs +
 * sub-components in GroupCard / LockedCard. The wrapper-with-onClick
 * approach intercepts at the outer boundary with one DOM check, leaving
 * the card body unchanged.
 *
 * Why this needs to be a client component: useRouter + window viewport
 * check. The check ensures mobile (<1024px) is a complete no-op so the
 * URL stays clean for mobile users (who don't see a right pane).
 *
 * router.replace + scroll:false keeps the scroll position pinned to where
 * the host clicked — no jarring jump to the top of the page.
 */
const DESKTOP_BREAKPOINT_PX = 1024; // Tailwind's `lg:` breakpoint.

export function CardSelectable({
  groupId,
  isSelected,
  children,
}: {
  groupId: string;
  isSelected: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      className={`rounded-xl transition-shadow lg:cursor-pointer ${
        isSelected
          ? 'lg:ring-2 lg:ring-terracotta/45 lg:ring-offset-2 lg:ring-offset-cream'
          : ''
      }`}
      onClick={(e) => {
        if (typeof window === 'undefined') return;
        if (window.innerWidth < DESKTOP_BREAKPOINT_PX) return;
        const target = e.target as HTMLElement;
        if (target.closest('a, button, [role="button"], input, select, textarea, label')) {
          return;
        }
        router.replace(`?card=${groupId}`, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
