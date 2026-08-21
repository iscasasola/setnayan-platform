import type { ReactNode } from 'react';

/**
 * The single page masthead for every dashboard, vendor-dashboard and admin surface.
 *
 * ── AND THEN THE (i) WENT TOO — 2026-08-21, same day, RUNG FOUR ─────────────────────────────
 * Removing the title left the (i) standing alone above the content on 58 pages: a small circle,
 * nothing beside it, its own row. The owner pointed straight at it on Your year. **A circle with
 * no label next to it does not tell anybody there is help behind it** — it reads as a stray dot,
 * and it was costing a row to say nothing. The (i) only ever worked because it sat beside the
 * title that gave it a subject, and that title is gone.
 *
 * So this component now renders **the actions and nothing else**. A sentence a person genuinely
 * needs in order to use a page does not belong behind a dot at the top — it belongs in the page,
 * beside the thing it governs, and the handful that qualified were moved there.
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
 * So on a page with no actions — which is most of them — this component renders a
 * screen-reader-only <h1> and NOTHING ELSE. No box, no margin, no chevron, no dot.
 *
 * ── WHAT SURVIVES, AND WHY EACH ONE ─────────────────────────────────────────────────────────
 *   • The <h1> stays in the document as `sr-only`. It costs zero pixels and it is what a screen
 *     reader announces on arrival, what `aria-labelledby`/skip-link targets point at, and what
 *     keeps the heading order legal. Deleting the element is a different decision from hiding
 *     it, and the owner asked for the second one.
 *   • `actions`. 25 of the old headers hold the ONLY doorway to another surface — `orders` holds
 *     the only link to /orders/new; `guests` the only desktop links to invite and seating.
 *     Deleting them would delete navigation, which is not what "start at the content" means.
 *   ⛔ NOT the (i), and not a `lede` prop — see rung four at the top of this file. This bullet
 *     used to say the (i) survived; it lasted half a day. If you are adding a sentence to a
 *     page, put it in the page next to the thing it is about.
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
  actions,
  id,
  className = '',
}: {
  /** The page name. Prefer the page's own `metadata.title` string so the two cannot drift. */
  title?: string;
  /** For the handful of titles composed at runtime (a couple's names, a vendor's shop). */
  titleNode?: ReactNode;
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
  if (!actions) return heading;

  return (
    <>
      {heading}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {actions}
        </div>
      </div>
    </>
  );
}
