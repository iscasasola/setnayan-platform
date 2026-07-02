'use client';

/**
 * SetnayanAiHeroStory — the Setnayan AI story AS THE HERO (owner 2026-07-03:
 * "we do not want it to jump away from the website. we want that to be the new
 * background").
 *
 * Selecting the Suri · Setnayan AI dock tile swaps the hero scene like every
 * other tile — and this block renders INSIDE the hero (below the tile's
 * headline + sub) so the one-page, no-scroll story IS the hero screen: the
 * three shipped jobs, the restraint promise, and the catalog-driven price.
 * No portal, no modal, no close button — clicking another tile or the logo
 * swaps away, exactly like every scene. (Supersedes the fullscreen takeover
 * from PR #2652.)
 *
 * Copy per the GTM framework (Setnayan_AI_GTM_Content_2026-07-02.md), honesty
 * guardrails held: SHIPPED-only jobs (no personalization/cohort teasers — those
 * are dormant), no tech named, no fake urgency, price never hardcoded (reads
 * the live catalog via `pricing`). Styling lives in home-reskin.css (.hr-ai-*),
 * which also compacts the block on short/narrow viewports so the hero stays
 * one screen.
 */

import type { PricingData } from './pricing-data';

const JOBS: Array<[string, string]> = [
  ['Does the legwork', 'Finds and ranks your best-fit verified vendors, chases the quiet ones, and lines up their quotes.'],
  ['Stands guard', 'Flags a deposit due, a price change, a double-booking, or a deadline before it slips.'],
  ['Reassures you', '“Great pick — 47 reviews, 4.8★,” with the evidence. So you stop second-guessing.'],
];

export function SetnayanAiHeroStory({ pricing }: { pricing: PricingData }) {
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
      <div className="hr-ai-price">
        <em>{pricing.aiPrice}</em>
        <span className="hr-ai-per">{pricing.aiPeriod}</span>
        <span className="hr-ai-intro">{pricing.aiIntroPrice} your first 28 days</span>
      </div>
      <p className="hr-ai-note">
        Covers all your events · 0% vendor commission · every planning tool stays free.
      </p>
    </div>
  );
}
