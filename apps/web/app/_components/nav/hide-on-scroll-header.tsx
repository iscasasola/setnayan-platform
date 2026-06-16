'use client';

/**
 * HideOnScrollHeader — thin client wrapper that applies the universal top-nav
 * hide-on-scroll-down / reveal-on-scroll-up rule (see useHideOnScroll) to a
 * sticky `<header>`.
 *
 * WHY A WRAPPER: some top-nav surfaces (e.g. OuterDashboardHeader) are server
 * components, so they can't call the hook directly. They render this client
 * wrapper around their existing sticky header content instead — the children
 * (EventSwitcher, bell, profile menu, …) render server-side and pass straight
 * through, keeping the parent a server component.
 *
 * The caller passes the SAME className it would have put on its own `<header>`
 * (sticky / z-index / palette / breakpoint visibility). This wrapper only adds
 * the transform + transition that slides it out of / into view.
 */

import type { ReactNode } from 'react';
import { useHideOnScroll } from './use-hide-on-scroll';

export function HideOnScrollHeader({
  className = '',
  enabled = true,
  children,
}: {
  /** The caller's own header classes (sticky / z / palette / breakpoints). */
  className?: string;
  /** Opt out (e.g. a non-sticky variant) without breaking rules-of-hooks. */
  enabled?: boolean;
  children: ReactNode;
}) {
  const hidden = useHideOnScroll(enabled);
  return (
    <header
      className={`transition-transform duration-300 ease-out motion-reduce:transition-none ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${className}`}
    >
      {children}
    </header>
  );
}
