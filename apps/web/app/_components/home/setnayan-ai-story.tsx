'use client';

/**
 * SetnayanAiHeroStory — the Setnayan AI story AS THE HERO (owner 2026-07-03).
 *
 * Selecting the Suri · Setnayan AI dock tile swaps the hero scene like every
 * other tile — and this block renders INSIDE the hero (below the tile's
 * headline + sub): the three shipped jobs, the restraint promise, and ONE
 * button — "See how much it helps to have Setnayan AI" — which opens the
 * INTERACTIVE COMPARATOR POP-UP (owner 2026-07-03: "instead of showing these
 * prices, we would have a button instead"). No prices on the hero; the
 * pop-up (HomeOverlays · SetnayanAiOverlay) carries the draggable months
 * line, the three compare modes, and the savings math. This button is the
 * pop-up's entry point (the top-nav item was removed by the owner, a63aee03).
 *
 * Copy per the GTM framework; honesty guardrails held: SHIPPED-only jobs, no
 * tech named, no fake urgency. Styling in home-reskin.css (.hr-ai-*).
 */

import type { PricingData } from './pricing-data';

const JOBS: Array<[string, string]> = [
  ['Does the legwork', 'Finds and ranks your best-fit verified vendors, chases the quiet ones, and lines up their quotes.'],
  ['Stands guard', 'Flags a deposit due, a price change, a double-booking, or a deadline before it slips.'],
  ['Reassures you', '\u201cGreat pick \u2014 47 reviews, 4.8\u2605,\u201d with the evidence. So you stop second-guessing.'],
];

export function SetnayanAiHeroStory({
  onCompare,
}: {
  pricing: PricingData;
  /** Opens the interactive comparator pop-up (its sole entry point). */
  onCompare?: () => void;
}) {
  return (
    <div className="hr-ai-story">
      <div className="hr-ai-jobs">
        {JOBS.map(([t, d]) => (
          <div key={t} className="hr-ai-job">
            <b>{t}</b>
            <span>{d}</span>
          </div>
        ))}
      </div>
      <p className="hr-ai-quiet">
        One calm weekly digest — loud only when it can&rsquo;t wait. No spam, no fake countdowns.
      </p>
      {onCompare && (
        <button className="hr-ai-cta" onClick={onCompare}>
          See how much it helps to have Setnayan AI
        </button>
      )}
    </div>
  );
}
