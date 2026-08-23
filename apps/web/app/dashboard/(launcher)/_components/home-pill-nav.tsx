'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, Sparkles, Store, Users } from 'lucide-react';

/**
 * HomePillNav — the floating glass pill at the bottom of the launcher on
 * phones. Desktop keeps the rail and never renders this.
 *
 * ── WHY (owner, 2026-07-29/30) ──────────────────────────────────────────────
 * "is it better to become a dashboard if mobile view, and the desktop view will
 * be menu less?" then "let the thumb space have it's space… follow the best
 * rules for a mobile view app. and of course, follow the pill like bottom nav
 * if needed." The launcher's destinations previously lived only as tiles the
 * user had to scroll to; on a phone the four surfaces now sit under the thumb.
 *
 * ── EVERY TARGET IS AN EXISTING, RENDERED DOOR ──────────────────────────────
 * Home `/dashboard` · Alaala `/dashboard/library` · Create
 * `/dashboard/create-event` · People `/dashboard/people` · Spaces
 * (`/vendor-dashboard` or `/admin`, whichever this account holds) — all five
 * already render as links on this same page. Nothing here invents a route
 * (`Route_Wayfinding_Audit_2026-07-15`: a nav row is not a doorway; a rendered
 * link is).
 *
 * ── THE FIFTH SLOT IS CAPABILITY-GATED ──────────────────────────────────────
 * Spaces appears only for a user who actually has a shop or console, mirroring
 * the "Yours to run" tile and the board. A plain couple gets FOUR targets, and
 * four honest targets beat five with a dead one. Its href follows the tile it
 * mirrors: Samahan moved under PEOPLE in the 2026-07-30 split, so the Spaces
 * pill must land on the console the user actually runs — not on
 * `/dashboard/samahan`, which is now a People destination and was reachable
 * only by console users anyway.
 *
 * ── CENTRE ACTION ───────────────────────────────────────────────────────────
 * Create is the raised knob: it is the one thing this page exists to start, and
 * putting it dead-centre is the one position reachable by either thumb.
 *
 * The launcher adds bottom padding for this element's height so the pill never
 * covers the last card — see `page.tsx`'s `pb-28 sm:pb-10`, and the matching
 * padding on the account spokes' own `<main>`.
 *
 * ── AND IT NO LONGER VANISHES WHEN YOU USE IT (2026-08-23) ──────────────────
 *
 * 🚨 IT WAS RENDERED IN EXACTLY ONE PLACE — `(launcher)/page.tsx`, i.e. the
 * single route `/dashboard`. So the bar under your thumb disappeared the moment
 * you pressed anything on it: People, Memories and Create all live in the
 * `(account)` group, and every one of them landed on a screen with no bottom
 * bar and no way back except the browser. A navigation bar you can only see
 * before you navigate is not a navigation bar.
 *
 * It is now rendered by the two LAYOUTS that cover those destinations —
 * `(launcher)/layout.tsx` and `(account)/layout.tsx` — from the switcher data
 * both of them already load, so the fifth slot's capability gate costs no new
 * query. It is deliberately NOT pushed into `AppRailShell`, which those two
 * layouts share with the event dashboards and the supplier console: those trees
 * carry their OWN phone bottom nav, and a second bar under the first is a worse
 * bug than the one being fixed.
 *
 * ⚠ WHICH MADE THE ACTIVE STATE A REAL QUESTION. This was a server component
 * with `aria-current="page"` HARDCODED on Home, which was true while Home was
 * the only route it appeared on and a lie on every other one. It reads the
 * pathname now — a screen reader announcing the wrong current page is the same
 * defect as the missing bar, one layer down.
 */
export function HomePillNav({
  hasSpaces,
  spacesHref,
}: {
  hasSpaces: boolean;
  /** Where the capability-gated Spaces slot lands — the same console the
   *  "Yours to run" tile links to for this account. Ignored when !hasSpaces. */
  spacesHref: string;
}) {
  const pathname = usePathname();
  const item =
    'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold text-[color:var(--sn-ink-500)] transition-colors hover:text-ink';
  /*
    Home is EXACT — `/dashboard` is the launcher itself, and a prefix test would
    light it on every spoke. The spokes match their own subtree so a deeper page
    (`/dashboard/people/<someone>`) still shows you where you are.
  */
  const isHere = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const slot = (href: string, exact = false) =>
    isHere(href, exact) ? `${item} text-ink` : item;
  const here = (href: string, exact = false) =>
    isHere(href, exact) ? ('page' as const) : undefined;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <div className="flex w-full max-w-md items-center gap-1 rounded-2xl border border-ink/15 bg-white/80 p-1.5 shadow-[0_24px_50px_-24px_rgba(30,26,18,0.55)] backdrop-blur-[20px]">
        <Link href="/dashboard" aria-current={here('/dashboard', true)} className={slot('/dashboard', true)}>
          <LayoutGrid aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          Home
        </Link>
        <Link href="/dashboard/library" aria-current={here('/dashboard/library')} className={slot('/dashboard/library')}>
          <Sparkles aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          Memories
        </Link>
        <Link
          href="/dashboard/create-event"
          aria-current={here('/dashboard/create-event')}
          aria-label="Create an event"
          className="flex shrink-0 items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-white shadow-[0_14px_28px_-14px_rgba(30,26,18,0.9)]"
        >
          <Plus aria-hidden className="h-5 w-5" strokeWidth={2.4} />
        </Link>
        <Link href="/dashboard/people" aria-current={here('/dashboard/people')} className={slot('/dashboard/people')}>
          <Users aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          People
        </Link>
        {hasSpaces ? (
          <Link href={spacesHref} aria-current={here(spacesHref)} className={slot(spacesHref)}>
            <Store aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            Spaces
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
