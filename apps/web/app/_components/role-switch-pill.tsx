'use client';

import Link from 'next/link';
import { ChevronDown, ShieldCheck, Store, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Always-visible "Switch view" pill — iteration 0000 chrome
 * (locked 2026-05-11 dual-role row in CLAUDE.md decision log; spec
 * § "Event switcher" line 221 calls it the *complement* to the
 * switcher-sheet role rows: the rows live inside the event sheet,
 * the pill is global chrome on every surface — admin, vendor, customer).
 *
 * Renders only when the user has at least one OTHER role they can
 * switch into. Single-role users see nothing — no dead-end button.
 *
 * The pill itself is anchored top-right of the chrome bar; clicking
 * opens a dropdown listing the alternate consoles. Active console is
 * implied by which surface you're on — we don't list the current role
 * as a target.
 */

export type RoleSwitchRole = 'customer' | 'vendor' | 'admin';

export type RoleSwitchVendorTarget = {
  vendor_profile_id: string;
  business_name: string;
  logo_url: string | null;
};

type Props = {
  currentRole: RoleSwitchRole;
  hasCustomerAccess: boolean;
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: RoleSwitchVendorTarget[];
  /** Popover open direction. Default `'down'` matches the existing horizontal
   *  toolbar (top-strip) UX. `'up'` is used by the desktop sidebar consolidation
   *  (2026-05-23 owner directive · BottomNav.desktop sidebar) where the pill
   *  sits near the bottom edge of the sidebar — `'down'` would push the
   *  popover past the viewport bottom. */
  align?: 'down' | 'up';
};

type Target = {
  role: RoleSwitchRole;
  label: string;
  href: string;
  sub: string | null;
};

export function RoleSwitchPill({
  currentRole,
  hasCustomerAccess,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
  align = 'down',
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
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

  const targets: Target[] = [];
  if (currentRole !== 'customer' && hasCustomerAccess) {
    targets.push({
      role: 'customer',
      label: 'Customer view',
      href: '/dashboard',
      sub: 'Your events',
    });
  }
  if (currentRole !== 'vendor' && hasVendorAccess) {
    const sub =
      vendorProfiles.length === 1
        ? vendorProfiles[0]?.business_name ?? null
        : vendorProfiles.length > 1
          ? `${vendorProfiles.length} vendor profiles`
          : null;
    targets.push({
      role: 'vendor',
      label: 'Shop console',
      href: '/vendor-dashboard',
      sub,
    });
  }
  if (currentRole !== 'admin' && hasAdminAccess) {
    targets.push({
      role: 'admin',
      label: 'Admin console',
      href: '/admin',
      sub: 'Setnayan internal',
    });
  }

  if (targets.length === 0) return null;

  const CurrentIcon = roleIcon(currentRole);
  const currentLabel = roleLabel(currentRole);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Switch view (currently ${currentLabel})`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta"
      >
        <CurrentIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="hidden sm:inline">Switch view</span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Switch view"
          className={`absolute right-0 z-30 w-60 rounded-2xl border border-ink/10 bg-cream p-2 shadow-lg ${
            align === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <p className="px-3 pt-1 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Switch to
          </p>
          {targets.map((t) => {
            const TargetIcon = roleIcon(t.role);
            const isAdminTone = t.role === 'admin';
            return (
              <Link
                key={t.role}
                role="menuitem"
                href={t.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 ${
                  isAdminTone ? 'hover:bg-purple-50' : 'hover:bg-terracotta/10'
                } hover:text-ink`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isAdminTone
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-terracotta/15 text-terracotta-700'
                  }`}
                >
                  <TargetIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{t.label}</span>
                  {t.sub ? (
                    <span className="truncate text-[11px] text-ink/55">{t.sub}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function roleIcon(role: RoleSwitchRole) {
  if (role === 'admin') return ShieldCheck;
  if (role === 'vendor') return Store;
  return User;
}

function roleLabel(role: RoleSwitchRole) {
  if (role === 'admin') return 'Admin console';
  if (role === 'vendor') return 'Shop console';
  return 'Customer view';
}
