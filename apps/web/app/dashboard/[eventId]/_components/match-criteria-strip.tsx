import Link from 'next/link';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import type { TasteChip } from '@/lib/personalized-menu';

/**
 * MatchCriteriaStrip — the compact "Matching you on" band at the top of the
 * Services (Vendors) tab.
 *
 * Owner 2026-06-04: the couple's personalization — the curated criteria
 * Setnayan filters + sorts services by (date · region · ceremony · venue ·
 * guests · style · budget) — belongs WHERE they browse services, not on a
 * separate page. This strip shows the gist as chips with a "Refine" affordance
 * to the full, editable Personalization page (/details). The old standalone
 * /for-you page now redirects to Services.
 *
 * Pure presentational server component. Chips come from `buildTasteChips`
 * (lib/personalized-menu) — the same source the old home/for-you block used —
 * so the criteria the couple sees here are exactly what the search runs on.
 * Visually mirrors the retired PersonalizedMenu card (same chip + eyebrow
 * styling) so the surface feels native to the dashboard.
 */
export function MatchCriteriaStrip({
  eventId,
  chips,
}: {
  eventId: string;
  chips: TasteChip[];
}) {
  const refineHref = `/dashboard/${eventId}/details`;
  const hasCriteria = chips.length > 0;

  return (
    <section
      aria-labelledby="match-criteria-heading"
      className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="match-criteria-heading"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
            Matching you on
          </h2>
          <p className="text-xs text-ink/55">
            {hasCriteria
              ? 'What Setnayan filters & sorts these services by.'
              : 'Add your wedding details so we can match services to you.'}
          </p>
        </div>
        {/* Refine — the full, editable Personalization page where every
            onboarding detail is documented and the governance-free basics
            (names · region · feel · budget) are editable inline. */}
        <Link
          href={refineHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/12 bg-paper px-2.5 py-1 text-[11px] font-medium text-terracotta transition-colors hover:bg-cream"
        >
          <SlidersHorizontal aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Refine
        </Link>
      </div>

      {hasCriteria ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.label}
              className="rounded-full border border-ink/12 bg-paper px-3 py-1 text-xs text-ink/75"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
