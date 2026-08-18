import Link from 'next/link';
import { ChevronLeft, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The single page masthead for every dashboard, vendor-dashboard and admin surface.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────────────────
 * Until 2026-07-21 there was NO shared page-header component anywhere in the app — every one of
 * ~115 pages hand-rolled the same block. That absence is exactly why a CARD token drifted onto page
 * headers: `.sn-eye`'s own spec comment in globals.css reads "**Tile** eyebrow". It was never the
 * atelier page identity, and `.sn-h1`'s comment already records that "m-serif is retired from
 * dashboards". The atelier masthead lives on the public marketing tree, guest sites and
 * /u/[slug] — none of which this component serves.
 *
 * ── The rule it encodes ─────────────────────────────────────────────────────────────────────
 *   ONE ROW:  [back chevron] + page title + (i)  (+ actions, right-aligned)
 *   • The EYEBROW is gone at every breakpoint (council-locked 2026-07-21). There is deliberately
 *     no prop for it — 24px of layout for 10.5px of type that repeats what the nav already says.
 *   • The LEDE IS NO LONGER A PARAGRAPH AT ANY WIDTH (owner-locked 2026-08-18). It moves behind
 *     an (i) beside the title. Owner, on three screenshots of this exact block: *"we do not need
 *     these. it just eats up space and we want it to be simpler to understand on each page
 *     without too much side comments. if you need description for what that part does you can
 *     add the (i)"*. The desktop-only paragraph this replaced still cost 48px of a ~900px window
 *     on every visit, forever, to answer a question a person asks once.
 *   • The TITLE IS NEVER INVISIBLE. Below 1024px there is no sidebar, there is no breadcrumb
 *     anywhere in this product, the installed PWA has no browser tab, and on 47 of 102 event
 *     routes the bottom nav highlights nothing. On a phone the h1 is the only thing on screen
 *     that says which page you are on. It carries a responsive step: 22px on phones, 36px from lg.
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
  /**
   * What this page is for. Rendered ONLY inside the (i) — never as a paragraph. Omit it when
   * the title already says the thing; an (i) that repeats the title is worse than no (i).
   */
  lede?: ReactNode;
  /** Controls that used to live inside the old <header>. Right-aligned from sm. */
  actions?: ReactNode;
  /** Preserve any id the old header or h1 carried (skip-link / aria-labelledby targets). */
  id?: string;
  className?: string;
}) {
  return (
    <header className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
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

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h1
          id={id}
          className="sn-h1 min-w-0 text-[22px] leading-[1.15] lg:text-[36px] lg:leading-[1.02]"
        >
          {titleNode ?? title}
        </h1>
        {lede && <MastheadInfo title={title}>{lede}</MastheadInfo>}
      </div>

      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

/**
 * The (i) — "what is this page for", on demand.
 *
 * A native `<details>`, so it costs ZERO client JavaScript and works in a server component,
 * which every one of these pages is. It is deliberately NOT a hover tooltip: a hover tip is
 * unreachable on the phone where most of this product is used, and `title=""` is invisible to
 * touch and unstyleable.
 *
 * ⚠ A plain `<details>` does NOT close on click-away — nothing native does that without JS, and
 * a comment elsewhere in this repo claims otherwise. Closing is the same (i) pressed again. That
 * is honest and needs no script; do not add "click-away closes" to this file.
 *
 * COLOUR: `text-ink/55`, never the gold slot. In this repo the Tailwind slot named `terracotta`
 * IS the atelier gold #A9834B, which measures 3.37:1 on cream — under the 4.5:1 AA floor for
 * text and with only 0.29 of headroom, so any tint under it fails too.
 */
function MastheadInfo({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <details className="sn-masthead-info group relative shrink-0">
      <summary
        aria-label={title ? `What ${title} is for` : 'What this page is for'}
        className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink group-open:bg-ink/5 group-open:text-ink [&::-webkit-details-marker]:hidden"
      >
        <Info aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1.5 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-ink/10 bg-white p-3 text-sm leading-relaxed text-ink/70 shadow-lg">
        {children}
      </div>
    </details>
  );
}
