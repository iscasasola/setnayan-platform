'use client';

/**
 * SetnayanAiHeroStory — the Setnayan AI story AS THE HERO (owner 2026-07-03:
 * "we do not want it to jump away from the website. we want that to be the new
 * background").
 *
 * Selecting the Suri · Setnayan AI dock tile swaps the hero scene like every
 * other tile — and this block renders INSIDE the hero (below the tile's
 * headline + sub): the three shipped jobs, the restraint promise, and the
 * price-as-comparison. No portal, no modal, no close button.
 *
 * THE COMPARISON (owner 2026-07-03, two directives): the price row IS the
 * vs-hired-team comparison, and it carries a DRAGGABLE months line — "place
 * the draggable line. so we can set how many months. 1 year is 13-28 days."
 * A "month" here is the house 28-DAY CYCLE (billing cadence), so 1 year = 13
 * months — the slider runs 1..26 (two years) and both sides recompute as
 * WINDOW TOTALS: the team at the ₱50,000-per-calendar-month rate prorated to
 * the window (N × 28 days ÷ 30), Setnayan at intro + regular × (N − 1) from
 * the RAW catalog prices (never re-hardcoded). Bars drawn to honest scale;
 * the "illustrative" footnote is visible at every viewport size.
 *
 * Copy per the GTM framework (Setnayan_AI_GTM_Content_2026-07-02.md), honesty
 * guardrails held: SHIPPED-only jobs, no tech named, no fake urgency, prices
 * catalog-driven. Styling lives in home-reskin.css (.hr-ai-*), which compacts
 * on short/narrow viewports so the hero stays one screen.
 */

import { useState } from 'react';
import type { PricingData } from './pricing-data';

const JOBS: Array<[string, string]> = [
  ['Does the legwork', 'Finds and ranks your best-fit verified vendors, chases the quiet ones, and lines up their quotes.'],
  ['Stands guard', 'Flags a deposit due, a price change, a double-booking, or a deadline before it slips.'],
  ['Reassures you', '“Great pick — 47 reviews, 4.8★,” with the evidence. So you stop second-guessing.'],
];

/** Illustrative PH rate for a 2–3 person team doing the same tasks (per CALENDAR month). */
const TEAM_PHP_PER_CAL_MONTH = 50_000;
/** The house billing month = 28 days → 13 per year. */
const CYCLE_DAYS = 28;

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

export function SetnayanAiHeroStory({ pricing }: { pricing: PricingData }) {
  // Default = 13 months (one year, at 13 × 28 days).
  const [months, setMonths] = useState(13);

  // Setnayan over the window: the intro cycle + the regular price × the rest —
  // raw numbers straight from the catalog resolve (pricing-data.ts).
  const mine = pricing.aiIntroPhp + pricing.aiRegularPhp * Math.max(0, months - 1);
  // The team at ₱50k per CALENDAR month, prorated to the same window — using
  // per-cycle ₱50k would overstate the team by ~8% (13 cycles/yr vs 12 months).
  const team = (TEAM_PHP_PER_CAL_MONTH * (months * CYCLE_DAYS)) / 30;
  const yearsNote = months === 13 ? ' · 1 year' : months === 26 ? ' · 2 years' : '';
  // The payoff line (owner 2026-07-03: "show the total savings by having
  // setnayan AI against hiring") — the gap between the two window totals.
  const savings = Math.max(0, team - mine);

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
      <div className="hr-ai-compare">
        <div className="hr-ai-cmp-slider">
          <span className="hr-ai-cmp-head" style={{ justifyContent: 'space-between' }}>
            My wedding is in
            <b>
              {months} {months === 1 ? 'month' : 'months'}
              <i>{yearsNote}</i>
            </b>
          </span>
          <input
            type="range"
            min={1}
            max={26}
            step={1}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            aria-label="Months until your wedding (a month is 28 days)"
          />
        </div>
        <div className="hr-ai-cmp-row">
          <span className="hr-ai-cmp-head">
            A team doing these tasks <b>≈ {peso(team)}<i> over {months} {months === 1 ? 'month' : 'months'}</i></b>
          </span>
          <span className="hr-ai-cmp-bar">
            <i style={{ width: '100%' }} />
          </span>
        </div>
        <div className="hr-ai-cmp-row hr-ai-cmp-us">
          <span className="hr-ai-cmp-head">
            Setnayan AI <b>{peso(mine)}<i> total</i></b>
            <span className="hr-ai-intro">{pricing.aiIntroPrice} first 28 days, then {pricing.aiPrice}{pricing.aiPeriod}</span>
          </span>
          <span className="hr-ai-cmp-bar">
            <i style={{ width: `${Math.max((mine / team) * 100, 1.4)}%`, transition: 'width .3s ease' }} />
          </span>
        </div>
        <p className="hr-ai-cmp-save">
          You save <b>≈ {peso(savings)}</b> over {months} {months === 1 ? 'month' : 'months'}
        </p>
        <p className="hr-ai-cmp-foot">
          Typical PH rates, illustrative — bars drawn to scale · a month = 28 days (13 ≈ 1 year).
        </p>
      </div>
    </div>
  );
}
