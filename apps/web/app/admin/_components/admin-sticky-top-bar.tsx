'use client';

/**
 * admin-sticky-top-bar.tsx — the admin top bar's sticky behaviour, kept.
 *
 * One Shell slice 3. The admin console used to compose its top bar through
 * `SidebarShell`'s `topBar` slot, and that slot — not the bar — owned three
 * things: the sticky position, the frosted background, and the UNIVERSAL
 * TOP-NAV RULE (owner 2026-06-15: a sticky top bar hides on scroll-down and
 * reveals on scroll-up, the same behaviour as the marketing site nav).
 *
 * 🪤 THE SHELL IS GONE FROM THIS TREE, SO THE SLOT'S BEHAVIOUR WOULD HAVE GONE
 * WITH IT — silently. The bar would still render, still be right-aligned, still
 * carry every control; it would simply have stopped being sticky and stopped
 * obeying an owner-locked rule, with nothing to throw and nothing to log. This
 * component is that slot, moved into the admin tree and nowhere else.
 *
 * ⚠ IT WRAPS, IT DOES NOT REBUILD. The bar's own markup stays in
 * `admin/layout.tsx` and arrives as `children`, so the SLA escalation pill, the
 * bell, the role badge, the display name and the account menu cannot be
 * dropped by a rewrite that never touched them.
 *
 * `shell-topbar` is kept as the class name deliberately: it is a stable hook
 * pages use to hide the strip (`.shell-topbar{display:none}`), and renaming it
 * here would break those pages from a file they never mention.
 */

import type { ReactNode } from 'react';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';

export function AdminStickyTopBar({ children }: { children: ReactNode }) {
  const hidden = useHideOnScroll(true);

  return (
    <div
      className={`shell-topbar sticky top-0 z-20 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{
        background: 'rgba(255,255,255,.55)',
        backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
        borderBottom: '1px solid var(--m-line)',
      }}
    >
      {children}
    </div>
  );
}
