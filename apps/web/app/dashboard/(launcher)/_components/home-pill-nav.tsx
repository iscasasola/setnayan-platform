import Link from 'next/link';
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
 * `/dashboard/samahan` — all five already render as links on this same page.
 * Nothing here invents a route (`Route_Wayfinding_Audit_2026-07-15`: a nav row
 * is not a doorway; a rendered link is).
 *
 * ── THE FIFTH SLOT IS CAPABILITY-GATED ──────────────────────────────────────
 * Spaces appears only for a user who actually has a shop or console, mirroring
 * the Spaces section and the board. A plain couple gets FOUR targets, and four
 * honest targets beat five with a dead one.
 *
 * ── CENTRE ACTION ───────────────────────────────────────────────────────────
 * Create is the raised knob: it is the one thing this page exists to start, and
 * putting it dead-centre is the one position reachable by either thumb.
 *
 * The launcher adds bottom padding for this element's height so the pill never
 * covers the last card — see `page.tsx`'s `pb-28 sm:pb-10`.
 */
export function HomePillNav({ hasSpaces }: { hasSpaces: boolean }) {
  const item =
    'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold text-[color:var(--sn-ink-500)] transition-colors hover:text-ink';
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <div className="flex w-full max-w-md items-center gap-1 rounded-2xl border border-ink/15 bg-white/80 p-1.5 shadow-[0_24px_50px_-24px_rgba(30,26,18,0.55)] backdrop-blur-[20px]">
        <Link href="/dashboard" aria-current="page" className={`${item} text-ink`}>
          <LayoutGrid aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          Home
        </Link>
        <Link href="/dashboard/library" className={item}>
          <Sparkles aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          Alaala
        </Link>
        <Link
          href="/dashboard/create-event"
          aria-label="Create an event"
          className="flex shrink-0 items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-white shadow-[0_14px_28px_-14px_rgba(30,26,18,0.9)]"
        >
          <Plus aria-hidden className="h-5 w-5" strokeWidth={2.4} />
        </Link>
        <Link href="/dashboard/people" className={item}>
          <Users aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          People
        </Link>
        {hasSpaces ? (
          <Link href="/dashboard/samahan" className={item}>
            <Store aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            Spaces
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
