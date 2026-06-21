'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useSubNavDocked } from './sub-nav';

/**
 * NavFab — the broken-out primary action (NAV-2 · Responsive_and_Mobile_UI_Ruleset_2026-06-21).
 *
 * ONE contextual circular action that floats above the right end of the locked
 * BottomNav pill on mobile (`lg:hidden`). It is a SIBLING of the pill — never a
 * 7th tab, never a fork of the canonical `bottom-nav.tsx` template (which is left
 * completely untouched). The locked pill is full-width (inset 14px each edge), so
 * the Shazam "beside the pill" placement isn't possible without editing the
 * locked geometry; this floats ABOVE the pill's right end instead (the standard
 * FAB pattern), anchored off the bar's published `--sn-bottomnav-h` height so the
 * gap stays constant at any tab count.
 *
 * Hides whenever the docked SubNav is up (`useSubNavDocked`) — the SubNav occupies
 * the same band above the bar, and a section's sub-tabs already own the context
 * there. Mounted as a layout sibling of the doorway's `<*BottomNav>`.
 *
 * Filename intentionally has NO "bottom-nav" substring so `scripts/lint-bottom-nav.mjs`
 * (which keys its delegation check off `/bottom-?nav/i`) doesn't demand this file
 * import/delegate to the template — it legitimately doesn't render the bar.
 *
 * Styling: Clean Editorial — a solid `--m-mulberry` circle (the locked CTA colour,
 * white glyph reads on it at AAA), `--m-shadow-md` float, ≥56px (well over the
 * 44px touch floor). Reduced-motion-safe (press scale only, no transition).
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
  const subnavDocked = useSubNavDocked();
  if (subnavDocked) return null;

  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-[14px] z-30 flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform active:scale-95 motion-reduce:transition-none lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + var(--sn-bottomnav-h, 64px) + 24px)',
        background: 'var(--m-mulberry)',
        boxShadow: 'var(--m-shadow-md)',
      }}
    >
      <Icon aria-hidden className="h-6 w-6" strokeWidth={2} />
    </Link>
  );
}
