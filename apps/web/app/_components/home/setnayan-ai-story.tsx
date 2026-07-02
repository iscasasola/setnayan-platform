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
      {/* The price row IS the comparison (owner 2026-07-03: "replace the row of
          the pricing. See how it compares against hiring a team to do the same
          tasks"). Static text + bars drawn to scale — no controls in the hero.
          Setnayan's number stays catalog-driven; the team figure is a labeled
          illustrative PH estimate, category-level (GTM guardrails). */}
      <div className="hr-ai-compare">
        <div className="hr-ai-cmp-row">
          <span className="hr-ai-cmp-head">
            A team doing these tasks <b>₱50,000+<i>/month</i></b>
          </span>
          <span className="hr-ai-cmp-bar">
            <i style={{ width: '100%' }} />
          </span>
        </div>
        <div className="hr-ai-cmp-row hr-ai-cmp-us">
          <span className="hr-ai-cmp-head">
            Setnayan AI <b>{pricing.aiPrice}<i>{pricing.aiPeriod}</i></b>
            <span className="hr-ai-intro">{pricing.aiIntroPrice} your first 28 days</span>
          </span>
          <span className="hr-ai-cmp-bar">
            <i
              style={{
                width: `${Math.max((pricing.aiRegularPhp / 50000) * 100, 1.6)}%`,
              }}
            />
          </span>
        </div>
        <p className="hr-ai-cmp-foot">Typical PH rates, illustrative — bars drawn to scale.</p>
      </div>
    </div>
  );
}
