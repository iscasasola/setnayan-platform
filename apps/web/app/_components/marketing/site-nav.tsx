/**
 * Shared marketing top chrome — PromoBar + Nav.
 *
 * WHY (2026-06-14): the public marketing site had forked into five different
 * headers — the homepage rendered this canonical 6-page Nav, while /about,
 * /how-it-works, /pricing and /features fell back to the legacy `SiteHeader`
 * (Marketplace / How it works / Features / Pricing / Help) and /blog shipped
 * a bespoke inline header. Clicking a nav item swapped the whole menu out.
 * Extracting the canonical Nav into one file makes every page render the
 * SAME top nav — single source of truth, per the owner anti-fork chrome
 * doctrine. Vendor surfaces (/vendors marketplace, /for-vendors) keep their
 * purpose-built headers for now ("we'll change vendors later").
 *
 * LEAN BY DESIGN: imports only Link + Wordmark + MobileMenu. Importing <Nav>
 * into a subpage must NOT drag the whole homepage module (_sections.tsx —
 * framer-motion motion primitives, HeroVideoScrub, catalog fetchers) into
 * that page's bundle, so the nav lives here, away from those imports.
 *
 * Server component by default; MobileMenu is the only client island.
 */

import Link from 'next/link';
import { Wordmark } from '@/app/_components/brand-marks';
import { MobileMenu } from './_nav-mobile';

// ─────────────────────────────────────────────────────────────────────
// 1. Promo bar — pilot stage default per template homepage-top.jsx
// ─────────────────────────────────────────────────────────────────────
export function PromoBar() {
  return (
    <div className="bg-[var(--m-ink)] text-[var(--m-paper)] text-[13px] px-6 py-2.5 flex justify-center items-center gap-[18px] flex-wrap">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--m-orange)] m-pulse-dot" />
        <strong className="font-medium">Pilot · December 2026.</strong>
        <span className="hidden sm:inline">First wedding ships Dec 18 — Claire &amp; Ice&apos;s own.</span>
      </span>
      <span className="hidden sm:inline text-[var(--m-slate-3)]">·</span>
      <Link href="/signup" className="text-[var(--m-orange-3)] underline underline-offset-[3px]">
        Apply to the pilot →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. Nav — sticky top with search button + Sign in + Start planning
// ─────────────────────────────────────────────────────────────────────
export function Nav() {
  // Simple 6-page site (owner 2026-06-13): Home (the video scrub, = the logo) ·
  // What you get · Explore (search anything across all services) · For vendors ·
  // Our story · Real Stories. Pricing folds into "What you get"; Help + legal
  // live in the footer. Keeps the top nav clean + strategic.
  //
  // "Real Stories" → /weddings: the real-wedding showcase (iteration 0046,
  // seeded with the Maria & Juan sample editorial) IS the destination. /blog
  // is the planning-guides "Setnayan Journal" — kept reachable as "Planning
  // guides" in the footer. (Owner 2026-06-14.)
  const links: Array<{ label: string; href: string }> = [
    { label: 'What you get', href: '/features' },
    { label: 'Explore', href: '/vendors' },
    { label: 'For vendors', href: '/for-vendors' },
    { label: 'Our story', href: '/about' },
    { label: 'Real Stories', href: '/weddings' },
  ];
  return (
    <nav className="relative flex items-center justify-between px-5 sm:px-8 lg:px-14 py-[14px] sm:py-[18px] border-b border-[var(--m-line-soft)] bg-[var(--m-paper)] sticky top-0 z-10">
      {/* Brand mark links home — "Home (the video scrub) = the logo" (owner
          2026-06-13). On the homepage this is a same-page link back to the
          hero; on every other page it routes to /. */}
      <Link href="/" aria-label="Setnayan — home" className="inline-flex items-center">
        <Wordmark size={22} />
      </Link>
      <div className="hidden lg:flex gap-7 text-sm text-[var(--m-slate)]">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="hover:text-[var(--m-ink)] transition-colors whitespace-nowrap">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-2.5 items-center">
        <Link
          href="/vendors"
          className="hidden xl:inline-flex items-center gap-2.5 px-3 py-2 rounded-full bg-[var(--m-paper-2)] border border-[var(--m-line)] text-[var(--m-slate-2)] text-[13px]"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="mr-12">Search anything…</span>
          <kbd className="m-mono text-[10px] px-1.5 py-px rounded bg-[var(--m-paper)] border border-[var(--m-line)] text-[var(--m-slate-3)]">
            ⌘K
          </kbd>
        </Link>
        <Link
          href="/login"
          className="hidden lg:inline whitespace-nowrap text-sm text-[var(--m-slate)] hover:text-[var(--m-ink)]"
        >
          Sign in
        </Link>
        <Link href="/onboarding/wedding" className="m-btn m-btn-primary px-[18px] py-2.5 text-[13px]">
          Start planning
        </Link>
        <MobileMenu links={links} />
      </div>
    </nav>
  );
}
