'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Logo } from './logo';
import { Sheet } from './sheet';

// Marketing-site chrome header. Single persistent strip (per the 2026-05-14
// "Top-nav redesign locked + token-wallet pill removed from chrome"
// decision-log row) — no two-row drift, no wallet pill, no event-switcher
// (that lives inside the per-event dashboard layout, not the public chrome).
//
// Responsive contract:
//   - mobile (< 768): logo + hamburger. The hamburger opens a Sheet with
//     the primary nav + Sign in + Create account. Single-thumb reach;
//     respects platform-appropriate patterns (bottom-sheet on mobile, not
//     a centered modal).
//   - md+ (>= 768): logo + inline primary nav + Sign in (link) + Create
//     account (button). No hamburger.
//
// Vendor-context detection routes the Create-account href to
// /signup?as=vendor when the viewer is on /for-vendors/* so the signup
// step pre-selects the vendor role.

const PRIMARY_NAV = [
  { href: '/features', label: 'Features' },
  { href: '/for-vendors', label: 'For vendors' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help' },
];

function isVendorContext(pathname: string): boolean {
  return pathname === '/for-vendors' || pathname.startsWith('/for-vendors/');
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const signupHref = isVendorContext(pathname) ? '/signup?as=vendor' : '/signup';
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center text-ink" aria-label="Setnayan home">
          <Logo height={32} withWordmark />
        </Link>

        {/* Desktop primary nav — inline at md+ */}
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {PRIMARY_NAV.map((link) => {
            const isActive =
              link.href === pathname ||
              (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`text-sm font-medium underline-offset-4 hover:text-ink hover:underline ${
                  isActive ? 'text-ink' : 'text-ink/65'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline md:inline"
          >
            Sign in
          </Link>
          <Link
            href={signupHref}
            className="button-primary hidden h-10 px-5 text-sm md:inline-flex"
          >
            Create account
          </Link>

          {/* Mobile hamburger — md:hidden */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="site-nav-sheet"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-ink/5 md:hidden"
          >
            <Menu aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Mobile nav sheet — populated on every render but only visible when
          `navOpen` is true (Sheet returns null otherwise). */}
      <Sheet
        open={navOpen}
        onClose={() => setNavOpen(false)}
        labelledById="site-nav-title"
        title="Menu"
      >
        <nav aria-labelledby="site-nav-title" id="site-nav-sheet" className="px-2 py-3">
          <ul className="space-y-1">
            {PRIMARY_NAV.map((link) => {
              const isActive =
                link.href === pathname ||
                (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setNavOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-[48px] items-center rounded-md px-4 text-base font-medium hover:bg-ink/5 ${
                      isActive ? 'text-ink' : 'text-ink/80'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li aria-hidden className="my-3 border-t border-ink/10" />
            <li>
              <Link
                href="/login"
                onClick={() => setNavOpen(false)}
                className="flex min-h-[48px] items-center rounded-md px-4 text-base font-medium text-ink hover:bg-ink/5"
              >
                Sign in
              </Link>
            </li>
            <li className="px-4 pt-3">
              <Link
                href={signupHref}
                onClick={() => setNavOpen(false)}
                className="button-primary flex min-h-[48px] w-full items-center justify-center text-sm font-semibold"
              >
                Create account
              </Link>
            </li>
          </ul>
        </nav>
      </Sheet>
    </header>
  );
}
