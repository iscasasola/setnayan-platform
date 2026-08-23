import type { ReactNode } from 'react';
import { DOORWAY_TONE } from '@/app/_components/marketing/_doorway-tone';

/**
 * studio-buy-hero.tsx — the top of a page that asks a couple for money.
 *
 * ─── THE COMPLAINT THAT STARTED THIS ─────────────────────────────────────
 * Owner, pressing Unlock on Setnayan AI and screenshotting what he got:
 * *"i tried unlocking setnayan AI. this is what shows when i clicked unlock.
 * it does not look appealing."*
 *
 * What he actually saw: no product name, no promise, no price — straight into
 * a small heading and eight near-identical grey cards, with ₱2,499 only after
 * scrolling past all of them. And it was not one page. Nine in-app pages take
 * money and open with nothing.
 *
 * ⚖ THE FIX IS NOT PUTTING THE PAGE HEADER BACK, AND THAT BOUNDARY IS THE
 * WHOLE POINT. `PageMasthead` was reduced on 2026-08-21 to render the actions
 * and nothing else — owner-locked, and CORRECT for the ~380 pages a person
 * already lives in: the row was costing every one of them 36–44px to answer a
 * question they had answered by tapping the thing that brought them there.
 *
 * A BUY PAGE IS THE OPPOSITE CASE. Somebody here has decided nothing yet. They
 * need the name of the thing, what it does for them, and what it costs, before
 * they scroll. So these pages get a hero OF THEIR OWN and every other page is
 * untouched. Nothing about the masthead lock changes.
 *
 * ─── RULE 0: THIS IS A PORT, NOT A DRAWING ───────────────────────────────
 * `app/_components/marketing/_doorway.tsx` already solves exactly this problem
 * for the eight PUBLIC product pages, and its archetype is owner-approved
 * (2026-08-04, all nineteen, no changes requested). This reproduces its hero:
 * the same `--m-*` tokens through the same `DOORWAY_TONE` constant, the same
 * serif scale (`text-4xl` → `sm:text-5xl`), the same centred `max-w-2xl`
 * column, the same order — name, then the line, then the way in.
 *
 * ⚠ AND THE TYPEFACE IS NOT THE MARKETING ONE, DELIBERATELY. `font-serif` is a
 * Tailwind alias for `--font-display`, and `.app-surface` — which wraps every
 * dashboard — remaps that variable to the app's own family. So the SAME class
 * that renders the doorway in the marketing display face renders this in the
 * app's. That is the right answer here (a page inside the app should wear the
 * app's face) and it is stated rather than assumed, because *the same utility
 * name in two scopes is not the same typeface* has already cost this project a
 * false collision report. Nothing here declares a `font-family`: which face
 * shared chrome wears is an OPEN OWNER DECISION and is not being decided by a
 * side effect.
 *
 * ⚠ WHAT IS DELIBERATELY NOT PORTED: the motion. The doorway's heading and CTA
 * band ride `LineRevealHeading` / `RevealBand`, which are client components
 * behind the marketing bundle. Twelve dashboard pages are server components
 * with a bundle-size check in CI, and the archetype's binding properties are
 * its COMPOSITION and its PALETTE — a reveal animation is neither. Said out
 * loud rather than quietly dropped, so the delta is visible as a decision.
 *
 * ─── THE PRICE IS ABOVE THE FOLD, AND THAT IS THE POINT ──────────────────
 * On every one of these pages the figure sat in a plain sentence at the bottom
 * of a tile, under the whole page. A page asking for ₱2,499 opens by saying
 * what it is and what it costs.
 *
 * 🔒 NO PRICE IS TYPED HERE OR ANYWHERE NEAR HERE. `price` is a node the page
 * has already resolved from the live catalog, exactly as its checkout does —
 * this component never formats, rounds or defaults one. A hero that quoted its
 * own number would be a second answer to what something costs.
 */
export function StudioBuyHero({
  productName,
  promise,
  price,
  priceNote,
  action,
  footnote,
}: {
  /**
   * THE h1, and the reason this component owns it. Every one of these pages
   * rendered its h1 through `PageMasthead`, which draws it `sr-only` — so the
   * name of the product a person is being asked to buy was in the document and
   * on no screen. A page must have exactly one, so a page rendering this must
   * NOT also render a masthead title in the same state.
   */
  productName: string;
  /**
   * The one line that says what it does for them.
   *
   * 🔑 IT IS ALREADY WRITTEN. These pages have carried lines like "Stop
   * guessing who to hire" and "Setnayan-curated supplies, delivered." all
   * along, passed as the masthead's `title` and therefore rendered invisibly.
   * Nothing here is new copy; this is the same sentence, on screen.
   */
  promise: string;
  /** The figure, resolved by the page from the catalog. Omitted while the
   *  catalog read has not resolved — the hero then simply carries no price
   *  rather than a placeholder, because a wrong number is worse than none. */
  price?: ReactNode;
  /** What the figure buys — "One-time · yours for the whole wedding". */
  priceNote?: string;
  /** The way in: the page's own checkout control, passed through untouched. */
  action?: ReactNode;
  /** One quiet line under the action, when the page needs a condition stated. */
  footnote?: ReactNode;
}) {
  return (
    /*
      NO EYEBROW ELEMENT HERE, DELIBERATELY. `lint-page-masthead.mjs` fails on
      an eyebrow token inside a heading element, because that card grammar
      drifted onto ~80 hand-rolled page headers once. This is not a hand-rolled
      masthead — it is a different surface with a different job — and it carries
      none of that grammar.

      🪤 AND THE FIRST VERSION OF THIS VERY COMMENT TRIPPED THAT LINT. It named
      both tokens in prose; the rule reads RAW SOURCE and its opening pattern
      matched the tag inside the sentence, then swept forward to the real
      closing tag and found the class name in the same paragraph. The lint was
      not wrong about what it saw. Do not name those two tokens together in a
      file that renders one of them.
    */
    <header className="mx-auto mb-8 w-full max-w-2xl text-center">
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl">
        {productName}
      </h1>
      <p className={`mt-4 text-lg leading-relaxed ${DOORWAY_TONE.muted}`}>{promise}</p>

      {price ? (
        <p className="mt-6 font-mono text-2xl text-[var(--m-ink)] sm:text-3xl">{price}</p>
      ) : null}
      {priceNote ? (
        <p className={`mt-1 text-sm ${DOORWAY_TONE.muted}`}>{priceNote}</p>
      ) : null}

      {action ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>
      ) : null}
      {footnote ? (
        <p className={`mt-3 text-sm ${DOORWAY_TONE.muted}`}>{footnote}</p>
      ) : null}
    </header>
  );
}
