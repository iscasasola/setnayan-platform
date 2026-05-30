'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * (I) menu — iteration 0000 § (I) menu (locked 2026-05-14 single-strip
 * top-nav row). A custom dropdown anchored to the avatar-circle on the
 * right side of the dashboard chrome. Replaces the prior plain-Link avatar.
 *
 * Rows (2026-05-30 split):
 *   - Profile   →  /dashboard/profile (lands at top · Personal info +
 *                  Change password + account-identity section).
 *   - Settings  →  /dashboard/profile#settings (anchor-scrolls to the
 *                  Planner mode / Display language / Appearance /
 *                  Privacy & data preferences block · iteration 0025
 *                  Profile + Settings tab list rendered as anchor
 *                  sections of one page in V1 · no separate
 *                  /dashboard/settings route exists or is needed).
 *   - Sign out  →  POST /auth/sign-out (form action; preserves
 *                  the existing server-side signOut + redirect flow).
 *
 * 2026-05-30 (CLAUDE.md decision-log): the avatar trigger button is now
 * h-11 w-11 (44×44) instead of h-9 w-9 (36×36). WHY: the global rule in
 * apps/web/app/globals.css `button { min-height: 44px }` (44pt touch
 * target per the kickoff multi-platform spec) was forcibly stretching
 * the h-9 (36px) height to 44px while leaving w-9 (36px) untouched →
 * 44h × 36w oblong pill. UnreadBellBadge next to it renders as <Link>
 * (an `<a>` tag) which the global rule doesn't match, so the bell
 * stayed a perfect circle but the avatar shipped oblong. Bumping to
 * h-11 w-11 puts both axes at 44px → true circle. Adds overflow-hidden
 * so an uploaded profile photo crops round (the photo upload surface
 * is V1.x; this readies the geometry for the optional `photoUrl` prop).
 */

type Props = {
  email: string;
  /**
   * Optional uploaded profile photo URL. When present, renders inside
   * the avatar circle as an <img> with object-cover so the photo is
   * cropped round. When absent, falls back to the email initial. The
   * photo upload surface itself is V1.x scope; this prop scaffolds the
   * contract so the wiring is one line when upload lands.
   */
  photoUrl?: string | null;
  /** Optional aria-label override. */
  ariaLabel?: string;
};

export function ProfileMenu({
  email,
  photoUrl,
  ariaLabel = 'Account menu',
}: Props) {
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
        className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          // ^ Profile photo URL points at a Supabase/R2 host that's already
          // dimensioned for the 44×44 avatar surface — no Next.js Image
          // optimization gain at this size, and inline <img> keeps the
          // markup simple inside the rounded button. object-cover + the
          // parent's overflow-hidden + rounded-full = circular crop.
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-ink/10 bg-cream p-2 shadow-lg"
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
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/dashboard/profile#settings"
            className="block rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10 hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action="/auth/sign-out" method="post" className="mt-2 border-t border-ink/10 pt-2">
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
