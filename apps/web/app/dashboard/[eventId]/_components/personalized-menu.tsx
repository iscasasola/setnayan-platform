import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

/**
 * PersonalizedMenu — the couple's match-criteria surface.
 *
 * WHAT IT IS (owner correction 2026-06-02): the CURATED INFORMATION the
 * couple gave at onboarding/event-creation that Setnayan uses to FILTER +
 * SORT their vendor search — date · region · ceremony (→ faith + dietary) ·
 * reception venue · guest count (capacity) · style/feel · budget. Home
 * surfaces this so the couple can SEE what they're matched on and tap
 * straight into their matched, sorted vendor results.
 *
 * It is NOT the couple's shortlisted/added vendors — that list lives on the
 * Vendors tab. (Earlier this block listed shortlisted services; the owner
 * corrected it: Home's "Personalized" = the curated match criteria, the
 * thing we filter/sort by, and the couple wants to ACCESS that.)
 *
 * Built ONLY from production data on the `events` row (date · ceremony +
 * secondary · venue_setting · estimated_pax · estimated_budget · region ·
 * mood_feel_key). The richer per-category onboarding preferences
 * (cuisine / photo-video style / music vibe / dietary detail) are V1.x —
 * when that capture ships, those criteria feed into `tasteChips` too.
 *
 * Pure presentational server component — the host (page.tsx / for-you)
 * maps the event row → tasteChips via lib/personalized-menu. Clean
 * Editorial palette. `variant` is kept for the host call sites; both
 * render the same criteria + the matched-vendors CTA (the criteria set is
 * small, so there's no preview/overflow distinction).
 */

export type TasteChip = { label: string };

export function PersonalizedMenu({
  eventId,
  variant: _variant,
  tasteChips,
}: {
  eventId: string;
  variant: 'preview' | 'full';
  tasteChips: TasteChip[];
}) {
  const base = `/dashboard/${eventId}`;
  const hasCriteria = tasteChips.length > 0;

  return (
    <section
      aria-labelledby="personalized-menu-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <div className="space-y-1">
        <h2
          id="personalized-menu-heading"
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          Personalized for you
        </h2>
        <p className="text-xs text-ink/55">
          What we match &amp; sort your vendors by — from your wedding details.
        </p>
      </div>

      {/* The curated match criteria — what filters + sorts the vendor search. */}
      {hasCriteria ? (
        <ul className="flex flex-wrap gap-2">
          {tasteChips.map((chip) => (
            <li
              key={chip.label}
              className="rounded-full border border-ink/12 bg-paper px-3 py-1 text-xs text-ink/75"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : (
        // Honest empty state — no criteria captured yet.
        <p className="rounded-xl border border-dashed border-ink/20 bg-paper px-3 py-3 text-sm text-ink/70">
          Add your wedding details and we&apos;ll match vendors to them.
        </p>
      )}

      {/* Access this — open the matched, sorted vendor results. The
       *  marketplace auto-applies the couple's faith + venue criteria
       *  (CLAUDE.md 2026-05-22 PRs #305 / #311), so this is the curated
       *  search the couple can act on now. */}
      <Link
        href={`${base}/vendors`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Browse your matched vendors
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </section>
  );
}
