'use client';

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
 * doctrine. The shared <Nav> now renders on every public marketing page
 * (vendor surfaces included).
 *
 * LEAN BY DESIGN: imports only Link + Wordmark + MobileMenu. Importing <Nav>
 * into a subpage must NOT drag the whole homepage module (_sections.tsx —
 * framer-motion motion primitives, HeroVideoScrub, catalog fetchers) into
 * that page's bundle, so the nav lives here, away from those imports.
 *
 * Client component: the sticky <Nav> auto-hides on scroll-down and reveals on
 * scroll-up (owner 2026-06-14 — so the homepage hero scrub goes full-screen /
 * "pure scrubbing" as you scroll into it). PromoBar stays a trivial static
 * island; MobileMenu is the existing client island.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
// 2. Nav — sticky top with Sign in + Start planning
//    `sticky` (default true) can be turned off on pages that already have
//    their own sticky-top bar (e.g. the /vendors marketplace search header)
//    so two sticky bars don't stack/overlap on scroll.
// ─────────────────────────────────────────────────────────────────────
export function Nav({ sticky = true }: { sticky?: boolean } = {}) {
  // Simple site nav (owner 2026-06-13/14): Home (the video scrub, = the logo) ·
  // Explore (search anything across all services) · For vendors · Our story ·
  // Real Stories. "What you get" was REMOVED from the nav 2026-06-14 — it now
  // lives ON the homepage itself: after the hero, "Tap to learn more ↓" reveals
  // the "A Place for Each" / what-you-get narrative (see PostHeroReveal +
  // WhatYouGet). Pricing folds into that narrative; Help + legal + planning
  // guides (/blog) live in the footer. Keeps the top nav clean + strategic.
  //
  // "Real Stories" → /weddings: the real-wedding showcase (iteration 0046,
  // seeded with the Maria & Juan sample editorial) IS the destination.
  const links: Array<{ label: string; href: string }> = [
    { label: 'Explore', href: '/vendors' },
    { label: 'For vendors', href: '/for-vendors' },
    { label: 'Our story', href: '/about' },
    { label: 'Real Stories', href: '/weddings' },
  ];

  // Auto-hide on scroll-down, reveal on scroll-up — only when sticky. Lets the
  // homepage hero scrub fill the screen ("pure scrubbing") the moment you
  // scroll into it, and gives every other page more room while scrolling down;
  // the nav slides back the instant you scroll up (to reach for it) or return
  // to the top. Non-sticky pages (e.g. /vendors) scroll the nav away naturally,
  // so the effect no-ops there.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!sticky) return;
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 64) setHidden(false); // always visible near the very top
        else if (y > lastY + 4) setHidden(true); // scrolling down → hide
        else if (y < lastY - 4) setHidden(false); // scrolling up → reveal
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sticky]);

  return (
    <nav
      className={`relative flex items-center justify-between px-5 sm:px-8 lg:px-14 py-[14px] sm:py-[18px] border-b border-[var(--m-line-soft)] bg-[var(--m-paper)]${
        sticky
          ? ` sticky top-0 z-10 transition-transform duration-300 ease-out motion-reduce:transition-none${
              hidden ? ' -translate-y-full' : ' translate-y-0'
            }`
          : ''
      }`}
    >
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
