'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * (I) menu — iteration 0000 § (I) menu (locked 2026-05-14 single-strip
 * top-nav row). A custom dropdown anchored to the avatar-circle on the
 * right side of the dashboard chrome. Replaces the prior plain-Link avatar.
 *
 * Rows:
 *   - Profile & settings  →  /dashboard/profile (consolidated in V1 per
 *     iteration 0025; spec lists "Profile / Settings" as two rows but the
 *     current app exposes a single combined page — TODO: split into two
 *     menu rows once `/dashboard/settings` ships as a distinct route).
 *   - Sign out             →  POST /auth/sign-out (form action; preserves
 *     the existing server-side signOut + redirect flow).
 */

type Props = {
  email: string;
  /** Optional notification href so callers can route the bell-less variant. */
  ariaLabel?: string;
  /** Popover open direction. Default `'down'` matches the existing horizontal
   *  toolbar (top-strip) UX. `'up'` is used by the desktop sidebar consolidation
   *  (2026-05-23 owner directive · BottomNav.desktop sidebar) where the avatar
   *  sits near the bottom edge of the sidebar — `'down'` would push the popover
   *  past the viewport bottom. */
  align?: 'down' | 'up';
};

export function ProfileMenu({ email, ariaLabel = 'Account menu', align = 'down' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initial = email?.charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={`absolute right-0 z-30 w-56 rounded-2xl border border-ink/10 bg-cream p-2 shadow-lg ${
            align === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <p
            className="truncate px-3 pt-1 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45"
            title={email}
          >
            {email || 'Signed in'}
          </p>
          <Link
            role="menuitem"
            href="/dashboard/profile"
            className="block rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10 hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Profile &amp; settings
          </Link>
          <form action="/auth/sign-out" method="post" className="mt-0.5">
            <button
              role="menuitem"
              type="submit"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink/85 hover:bg-terracotta/10 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
