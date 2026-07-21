import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The single page masthead for every dashboard, vendor-dashboard and admin surface.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────────────────
 * Until now there was NO shared page-header component anywhere in the app — every one of ~80
 * pages hand-rolled the same block. That absence is exactly why a CARD token drifted onto page
 * headers: `.sn-eye`'s own spec comment in globals.css reads "**Tile** eyebrow". It was never the
 * atelier page identity, and `.sn-h1`'s comment already records that "m-serif is retired from
 * dashboards". The atelier masthead lives on the public marketing tree, guest sites and
 * /u/[slug] — none of which this component serves.
 *
 * ── The rule it encodes (council-locked 2026-07-21) ─────────────────────────────────────────
 *   ONE ROW:  [back chevron] + page title  (+ actions, right-aligned)
 *   • The EYEBROW is gone at every breakpoint. There is deliberately no prop for it — 24px of
 *     layout for 10.5px of type that repeats what the nav already says.
 *   • The LEDE survives on DESKTOP ONLY. On a 390px phone it costs 96px median (240px worst) of
 *     a ~671px window; on desktop it costs 48 of 900 and genuinely orients a first-time visitor.
 *   • The TITLE IS NEVER INVISIBLE. Below 1024px there is no sidebar, there is no breadcrumb
 *     anywhere in this product, the installed PWA has no browser tab, and on 47 of 102 event
 *     routes the bottom nav highlights nothing. On a phone the h1 is the only thing on screen
 *     that says which page you are on. It gains the responsive step it never had (36px was
 *     hardcoded with no media query): 22px on phones, 36px from lg.
 *
 * ── Why `actions` exists ────────────────────────────────────────────────────────────────────
 * 25 of the old headers contain the ONLY doorway to another surface — `orders` holds the only
 * link to /orders/new; `guests` holds the only desktop links to invite and seating. Deleting
 * those headers wholesale would delete navigation. Anything that was an interactive sibling
 * inside the old <header> moves here, and nothing is lost.
 *
 * No `.sn-reveal` on the masthead: the shell already runs `.sn-page-enter`, and stacking a second
 * 640ms staggered fade on top of it delays the one element that tells you where you are.
 */
export function PageMasthead({
  title,
  titleNode,
  back,
  backLabel,
  lede,
  actions,
  id,
  className = '',
}: {
  /** The page name. Prefer the page's own `metadata.title` string so the two cannot drift. */
  title?: string;
  /** For the handful of titles composed at runtime (a couple's names, a vendor's shop). */
  titleNode?: ReactNode;
  /** Where the back chevron goes. Omit for a top-level surface. */
  back?: string;
  /** Accessible name for the chevron — say where it goes, not "back". */
  backLabel?: string;
  /** Desktop-only orienting prose. Keep it to one or two sentences. */
  lede?: ReactNode;
  /** Controls that used to live inside the old <header>. Right-aligned from sm. */
  actions?: ReactNode;
  /** Preserve any id the old header or h1 carried (skip-link / aria-labelledby targets). */
  id?: string;
  className?: string;
}) {
  return (
    <header className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {back && (
          <Link
            href={back}
            aria-label={backLabel ?? 'Back'}
            title={backLabel ?? 'Back'}
            className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink/55 hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          </Link>
        )}

        <h1
          id={id}
          className="sn-h1 min-w-0 flex-1 text-[22px] leading-[1.15] lg:text-[36px] lg:leading-[1.02]"
        >
          {titleNode ?? title}
        </h1>

        {actions && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
            {actions}
          </div>
        )}
      </div>

      {lede && (
        <p className="hidden max-w-prose text-sm text-ink/65 lg:block">{lede}</p>
      )}
    </header>
  );
}
