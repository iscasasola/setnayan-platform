/**
 * Phase 0 Date Selection — auspicious card (server component).
 *
 * Renders the positive-only reasoning for a date the host has chosen
 * (either via direct calendar pick or guided-flow suggestion). The card
 * acts as the final affirmation step before the host clicks Lock-this-date.
 *
 * Per CLAUDE.md 2026-05-22 Phase 0 lock — every reason is positive,
 * never tells the host "this date is bad." The library
 * (apps/web/lib/auspicious-date.ts) handles all framing, including
 * sensitive reframes for Holy Week / typhoon season / sukob / etc.
 *
 * Brand voice: cream background, terracotta accent, Cormorant display
 * serif for the headline date, Manrope body for reasons, DM Mono for
 * the eyebrow.
 */

import { Sparkles } from 'lucide-react';
import {
  computeAuspiciousReasons,
  formatAuspiciousDate,
  dayOfWeekLabel,
  type CeremonyType,
  type MeaningfulDate,
} from '@/lib/auspicious-date';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { ChineseSpecialistNudge } from './chinese-specialist-nudge';

type Props = {
  /** YYYY-MM-DD */
  date: string;
  /** Host's ceremony type from events.ceremony_type, null when not yet set. */
  ceremonyType: CeremonyType | null;
  /**
   * Host's secondary ceremony type from events.secondary_ceremony_type. Carries
   * the common Tsinoy "church-primary + Chinese-overlay" case. Together with
   * ceremonyType this drives the Chinese advisory layer via isChineseWedding().
   */
  secondaryCeremonyType?: string | null;
  /** Optional: meaningful dates flagged by the host — surfaces personal resonance. */
  meaningfulDates?: MeaningfulDate[];
  /**
   * Optional pre-computed reasons. When passed (e.g. from events.auspicious_reasons
   * after a date is already locked), the card uses these instead of recomputing.
   * Skipping recomputation preserves the host's locked reasoning even if the
   * library evolves later.
   */
  preComputedReasons?: string[];
  /** Optional: render in compact / inline mode for embedding outside the route. */
  variant?: 'full' | 'inline';
};

export function AuspiciousCard({
  date,
  ceremonyType,
  secondaryCeremonyType = null,
  meaningfulDates = [],
  preComputedReasons,
  variant = 'full',
}: Props) {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    return null;
  }

  // Chinese tradition applies as the primary rite OR as the secondary/overlay
  // rite (the common Tsinoy church-primary case). Derived from the shared
  // predicate so the advisory nudge + CTA below fire for both.
  const chineseTradition = isChineseWedding({
    ceremony_type: ceremonyType,
    secondary_ceremony_type: secondaryCeremonyType,
  });

  const dateObj = new Date(year, month - 1, day);
  const reasons =
    preComputedReasons && preComputedReasons.length > 0
      ? preComputedReasons
      : computeAuspiciousReasons(dateObj, ceremonyType, meaningfulDates, chineseTradition);

  const prettyDate = formatAuspiciousDate(date);
  const dow = dayOfWeekLabel(dateObj);

  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-terracotta/25 bg-terracotta/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles
            aria-hidden
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              Your date
            </p>
            <p className="font-display text-lg italic text-ink">{prettyDate}</p>
            {reasons.length > 0 ? (
              <ul className="space-y-1 text-sm text-ink/75">
                {reasons.slice(0, 3).map((r, i) => (
                  <li key={i} className="leading-snug">
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      className="rounded-2xl border border-terracotta/25 bg-cream p-6 shadow-sm ring-1 ring-terracotta/10 sm:p-8"
      aria-labelledby="auspicious-card-headline"
    >
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Sparkles
            aria-hidden
            className="-mt-0.5 mr-1 inline h-3 w-3"
            strokeWidth={1.75}
          />
          Why this date works
        </p>
        <h2
          id="auspicious-card-headline"
          className="font-display text-3xl italic leading-tight text-ink sm:text-4xl"
        >
          {prettyDate}
        </h2>
        <p className="text-sm text-ink/55">
          {dow} · a beautiful day to be wed
        </p>
      </div>

      {reasons.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/80">
              <span
                aria-hidden
                className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta/70"
              />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm italic text-ink/65">
          Every date holds its own meaning — this one is yours to shape.
        </p>
      )}

      {chineseTradition ? <ChineseSpecialistNudge /> : null}
    </article>
  );
}

// ChineseSpecialistNudge now lives in ./chinese-specialist-nudge so the
// date-selection page (and any future surface) can mount it directly — this
// card is not the only place the advisory appears.
