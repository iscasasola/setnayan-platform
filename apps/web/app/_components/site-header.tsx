'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { Logo } from './logo';
import { Sheet } from './sheet';

// Marketing-site chrome header. Single persistent strip (per the 2026-05-14
// "Top-nav redesign locked + token-wallet pill removed from chrome"
// decision-log row) — no two-row drift, no wallet pill, no event-switcher
// (that lives inside the per-event dashboard layout, not the public chrome).
//
// Browse + search entry points added per CLAUDE.md decision-log rows 426 +
// 428 (2026-05-19, Phase A scaffolding for the public-view-and-search lock):
//   - "Marketplace" leads the primary nav and points at the already-shipped
//     /vendors marketplace. (Relabelled from "Browse" on 2026-05-20 — same
//     destination; clearer purpose vs. the adjacent "For vendors" sign-up
//     landing page.)
//   - Inline search bar at lg+ submits a GET form to /vendors?q=<query>
//     (matches the SearchAction JSON-LD already declared in apps/web/app/page.tsx).
//   - Mobile hamburger sheet includes both the search input and the
//     Marketplace link near the top of the sheet so the discovery path is
//     reachable without a desktop viewport.
//
// Responsive contract:
//   - mobile (< 768): logo + hamburger. The hamburger opens a Sheet with
//     the primary nav + search field + Sign in + Create account.
//   - md+ (>= 768): logo + inline primary nav + Sign in (link) + Create
//     account (button). Search input appears at lg+ to keep md width
//     uncluttered for tablet.
//
// Vendor-context detection routes the Create-account href to
// /signup?as=vendor when the viewer is on /for-vendors/* so the signup
// step pre-selects the vendor role.

const PRIMARY_NAV = [
  { href: '/vendors', label: 'Marketplace' },
  { href: '/how-it-works', label: 'How it works' },
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
        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
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
          {/* Inline search — visible at lg+ so md (tablet) keeps the nav
              uncluttered. Submits a GET form to /vendors so the action
              matches the homepage SearchAction JSON-LD and the existing
              /vendors page already reads `?q=` server-side. */}
          <form
            action="/vendors"
            method="get"
            role="search"
            className="relative hidden lg:block"
          >
            <label htmlFor="site-search" className="sr-only">
              Search vendors
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50"
              strokeWidth={1.75}
            />
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search vendors"
              autoComplete="off"
              className="h-10 w-56 rounded-md border border-ink/15 bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            />
          </form>
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
          {/* Mobile search — submits the same GET form as desktop. Closing
              the sheet on submit isn't necessary because the form navigation
              triggers a full page change. */}
          <form action="/vendors" method="get" role="search" className="px-2 pb-3">
            <label htmlFor="site-search-mobile" className="sr-only">
              Search vendors
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50"
                strokeWidth={1.75}
              />
              <input
                id="site-search-mobile"
                name="q"
                type="search"
                placeholder="Search vendors"
                autoComplete="off"
                className="h-11 w-full rounded-md border border-ink/15 bg-white pl-9 pr-3 text-base text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </form>
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
