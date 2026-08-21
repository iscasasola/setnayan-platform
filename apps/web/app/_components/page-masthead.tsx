import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The single page masthead for every dashboard, vendor-dashboard and admin surface.
 *
 * ── WHAT IT DRAWS NOW: AS LITTLE AS POSSIBLE ────────────────────────────────────────────────
 * Owner-locked 2026-08-21, pointing at the back chevron and the 36px "Alaala" on the Alaala
 * page: *"i still see this across most of pages"* — and, asked which part, choosing to remove
 * the back arrow and the big page name entirely **so each page starts straight at its content.**
 * That supersedes the 2026-08-18 one-row lock in this same file, which had already deleted the
 * eyebrow and the lede paragraph. Same complaint each time, one rung further down: the row was
 * costing every page 36–44px to answer a question the person had already answered by tapping
 * the thing that brought them here.
 *
 * So on a page with no (i) and no actions — which is most of them — this component renders a
 * screen-reader-only <h1> and NOTHING ELSE. No box, no margin, no chevron.
 *
 * ── WHAT SURVIVES, AND WHY EACH ONE ─────────────────────────────────────────────────────────
 *   • The <h1> stays in the document as `sr-only`. It costs zero pixels and it is what a screen
 *     reader announces on arrival, what `aria-labelledby`/skip-link targets point at, and what
 *     keeps the heading order legal. Deleting the element is a different decision from hiding
 *     it, and the owner asked for the second one.
 *   • `actions`. 25 of the old headers hold the ONLY doorway to another surface — `orders` holds
 *     the only link to /orders/new; `guests` the only desktop links to invite and seating.
 *     Deleting them would delete navigation, which is not what "start at the content" means.
 *   • The (i), where a page passes a `lede`. It is 28px, it is opt-in, and 55 pages still carry
 *     a sentence you need in order to USE the page (a limit, an action, a consequence). An (i)
 *     with no title beside it is a small cost against deleting those 55 sentences outright.
 *
 * ── WHAT IT COSTS, STATED PLAINLY ───────────────────────────────────────────────────────────
 * Below 1024px there is no rail, there is no breadcrumb anywhere in this product, and the
 * installed PWA has no browser tab and NO BROWSER BACK BUTTON. The h1 and the chevron were the
 * two things answering "where am I" and "how do I get out" on a phone. What is left is the
 * shared top bar (its wordmark goes to /dashboard — where 8 of the 28 chevrons pointed), the
 * rail on desktop, and the bottom nav inside an event. On ~20 deeper pages — the event website
 * editor's sub-pages, admin and vendor-dashboard spokes — the chevron walked you UP ONE LEVEL
 * and nothing else does; those climb one extra tap now. Putting a small arrow back on exactly
 * those pages is one prop, if the owner wants it.
 */
export function PageMasthead({
  title,
  titleNode,
  lede,
  actions,
  id,
  className = '',
}: {
  /** The page name. Prefer the page's own `metadata.title` string so the two cannot drift. */
  title?: string;
  /** For the handful of titles composed at runtime (a couple's names, a vendor's shop). */
  titleNode?: ReactNode;
  /**
   * What this page is for. Rendered ONLY inside the (i) — never as a paragraph, never as a
   * title. Omit it unless the page cannot be used without it.
   */
  lede?: ReactNode;
  /** Controls that used to live inside the old <header>. Right-aligned from sm. */
  actions?: ReactNode;
  /** Preserve any id the old header or h1 carried (skip-link / aria-labelledby targets). */
  id?: string;
  /** Spacing for the strip. Ignored when there is no strip — an invisible h1 needs no margin. */
  className?: string;
}) {
  const heading = (
    <h1 id={id} className="sr-only">
      {titleNode ?? title}
    </h1>
  );

  // The common case: nothing to show. The page begins at its own first element.
  if (!lede && !actions) return heading;

  return (
    <>
      {heading}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
        {lede && <MastheadInfo title={title}>{lede}</MastheadInfo>}
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            {actions}
          </div>
        )}
      </div>
    </>
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
 * ⚠ IT NO LONGER SITS BESIDE A TITLE, so its accessible name is the only thing saying what it
 * opens. Keep the `What ${title} is for` label exactly as it is.
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
