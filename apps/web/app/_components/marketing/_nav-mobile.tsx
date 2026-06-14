'use client';

/**
 * Mobile nav menu — 2026-06-13 premium redesign.
 *
 * The marketing Nav hid its links below md with no replacement, so phones
 * had no way to reach Marketplace / Pricing / Help from the homepage.
 * Hamburger toggles a full-width sheet under the sticky nav. Zero-dep,
 * client-only island so the section file stays a server component.
 */

import { useState } from 'react';
import Link from 'next/link';

export function MobileMenu({ links }: { links: Array<{ label: string; href: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--m-line)] bg-[var(--m-paper)] text-[var(--m-ink)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          {open ? (
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          ) : (
            <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full bg-[var(--m-paper)] border-b border-[var(--m-line)] shadow-[var(--m-shadow-md)] px-5 py-4 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="px-3 py-3 rounded-lg text-[15px] text-[var(--m-ink)] hover:bg-[var(--m-paper-2)]"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2.5 items-center pt-3 mt-2 border-t border-[var(--m-line-soft)]">
            <Link href="/login" onClick={() => setOpen(false)} className="m-btn m-btn-ghost flex-1 justify-center">
              Sign in
            </Link>
            <Link
              href="/onboarding/wedding"
              onClick={() => setOpen(false)}
              className="m-btn m-btn-primary flex-1 justify-center"
            >
              Start planning
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
