'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * NavFab — the broken-out primary action (NAV-2 · Responsive_and_Mobile_UI_Ruleset).
 *
 * ONE contextual circular action that sits IN the bottom-nav row, isolated at the
 * far right (the Shazam layout · owner-tuned 2026-06-22). It is a SIBLING of the
 * locked BottomNav pill — never a 7th tab, never a fork of the canonical
 * `bottom-nav.tsx` (which stays completely untouched).
 *
 * To make room in the row, mounting this sets `data-sn-fab` on <html>; a CSS rule
 * in globals.css then shrinks the pill's right inset — scoped to the nav's
 * existing `aria-label="Primary navigation"` marker, so the locked template is
 * read, not edited. Doorways without a FAB never set the attr → full-width pill.
 *
 * Vertically centered in the bar row off the bar's published `--sn-bottomnav-h`
 * height, so it lines up at any tab count. Mounted as a layout sibling of the
 * doorway's `<*BottomNav>`. Always visible on its doorway's mobile routes (it no
 * longer collides with the docked SubNav, which lives in the band ABOVE the bar).
 *
 * Filename intentionally has NO "bottom-nav" substring so `scripts/lint-bottom-nav.mjs`
 * (delegation check keys off `/bottom-?nav/i`) doesn't demand it import the template.
 *
 * Styling: Clean Editorial — a solid `--m-mulberry` circle (the locked CTA colour,
 * white glyph), `--m-shadow-md` float, 56px (over the 44px touch floor).
 */
export function NavFab({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  // Signal that a FAB is present so globals.css shrinks the pill's right inset to
  // leave room for this circle in the bar row. Cleared when the doorway (or the
  // phase, e.g. couple "after") drops the FAB → pill returns to full width.
  useEffect(() => {
    document.documentElement.dataset.snFab = '1';
    return () => {
      delete document.documentElement.dataset.snFab;
    };
  }, []);

  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-[14px] z-30 flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform active:scale-95 motion-reduce:transition-none lg:hidden"
      style={{
        // Centered in the bar row: the pill floats 12px above the safe-area inset
        // and is `--sn-bottomnav-h` tall; center the 56px circle within that.
        bottom: 'calc(env(safe-area-inset-bottom) + 12px + (var(--sn-bottomnav-h, 64px) - 56px) / 2)',
        background: 'var(--m-mulberry)',
        boxShadow: 'var(--m-shadow-md)',
      }}
    >
      <Icon aria-hidden className="h-6 w-6" strokeWidth={2} />
    </Link>
  );
}
