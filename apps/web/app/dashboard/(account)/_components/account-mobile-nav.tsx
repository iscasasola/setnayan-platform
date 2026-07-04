'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { AccountSidebar } from './account-sidebar';

/**
 * AccountMobileNav — the mobile (< lg) navigation for the account surface.
 *
 * The shared SidebarShell hides the desktop sidebar below 1024px and expects
 * each doorway to supply its own mobile chrome. The account surface previously
 * supplied only the top-bar utilities (unread bell + account-switcher pill) and
 * NO way to reach the account nav (My Events · People · Memories Hub · Setnayan
 * AI · Notifications · Profile & Settings · Marketplace · New event) on a phone
 * — the sidebar is `hidden lg:flex`. This adds a hamburger → left drawer that
 * REUSES the exact desktop <AccountSidebar> (so labels/icons stay registry-
 * driven — no forked nav list), closing on navigation, backdrop tap, Escape, or
 * the close button. Rendered only < lg; on desktop the trigger is hidden and
 * the real sidebar takes over.
 */
export function AccountMobileNav({
  navSlots,
}: {
  navSlots?: Record<string, NavSlotLite>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Close when the route changes (a nav link inside the drawer was tapped).
  useEffect(() => setOpen(false), [pathname]);

  // While open: lock body scroll + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 text-ink transition-colors hover:bg-ink/5 lg:hidden"
      >
        <Menu aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Account menu"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute inset-0 h-full w-full bg-ink/40"
              />
              <div
                className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col overflow-y-auto border-r border-ink/10 p-3 shadow-xl"
                style={{ background: 'var(--m-paper, #FBFBFA)' }}
              >
                <div className="mb-1 flex items-center justify-between px-2 pb-1">
                  <span className="text-sm font-semibold text-ink">Menu</span>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-ink/5"
                  >
                    <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </div>
                <AccountSidebar navSlots={navSlots} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
