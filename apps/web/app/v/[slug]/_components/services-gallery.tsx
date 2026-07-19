'use client';

/**
 * ServicesGallery — the public vendor profile's "Services & pricing" gallery
 * with service-coverage filter chips (owner directive 2026-07-02: "Full gallery
 * of their Service Cards with filtering of what service coverage").
 *
 * Dumb client component: all label/price/meta formatting is done server-side in
 * ServicesPricingSection and passed as plain serializable data, so this file
 * needs no taxonomy imports. Chips filter by coverage group (the SERVICE_GROUPS
 * a vendor actually covers). The chip row only renders when a vendor spans more
 * than one coverage group — a single-group vendor has nothing to filter.
 */

import { useState } from 'react';
import Image from 'next/image';
import { BadgePercent, Check, Info, Users } from 'lucide-react';

export type ServiceCard = {
  id: string;
  label: string;
  priceLabel: string;
  /** Crew / meal line, pre-joined server-side. null → no second line. */
  meta: string | null;
  // ── Service-card redesign · Phase 4 (couple-facing enrichment) ────────────
  /** Best applicable discount badge copy (e.g. "20% off · early booking"),
   *  chosen server-side by pickBestDiscount. null → no discount to show. */
  discountLabel: string | null;
  /** FREE inclusions with a stated worth, pre-formatted server-side
   *  ("Photo booth · ₱8,000 free"). Trimmed to a few; `inclusionsMore` counts
   *  the overflow. Empty → the Includes row is hidden. */
  inclusions: string[];
  /** How many inclusions were trimmed off `inclusions` (drives "+N more"). */
  inclusionsMore: number;
  /** "Not included" expectation flags, pre-formatted server-side
   *  ("Crew meal not included", "Transport: ₱1,500"). Empty → row hidden. */
  notIncluded: string[];
  // ── Couple-side serves payoff (2026-07-03) ─────────────────────────────────
  /** Pricing-basis detail under the "from ₱X" anchor, pre-formatted server-side
   *  ("₱350 / guest · min 50 guests", "₱15,000 for 4 hrs · +₱2,000/extra hr").
   *  null → fixed basis / nothing extra to explain. */
  priceDetail: string | null;
  /** Who this service serves, pre-formatted server-side from the coverage row
   *  ("Wedding · Debut — All faiths"). null → no coverage declared → no line. */
  serves: string | null;
  /** Showcase photo display URLs (≤5, presigned server-side). Empty → no strip. */
  photos: string[];
  /** Showcase clip display URL (presigned server-side). null → no video. */
  videoUrl: string | null;
};

export type ServiceGroup = {
  key: string;
  label: string;
  cards: ServiceCard[];
};

const ALL = '__all__';

export function ServicesGallery({ groups }: { groups: ServiceGroup[] }) {
  const [active, setActive] = useState<string>(ALL);

  // Only offer filtering when there's more than one coverage group to switch
  // between; otherwise the chips are dead weight.
  const showChips = groups.length > 1;
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const visible = active === ALL ? groups : groups.filter((g) => g.key === active);

  return (
    <div className="space-y-5">
      {showChips ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter services by coverage">
          <FilterChip
            label="All"
            count={total}
            on={active === ALL}
            onClick={() => setActive(ALL)}
          />
          {groups.map((g) => (
            <FilterChip
              key={g.key}
              label={g.label}
              count={g.cards.length}
              on={active === g.key}
              onClick={() => setActive(g.key)}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        {visible.map((g) => (
          <div key={g.key} className="space-y-2">
            {/* Group label is redundant once a single coverage chip is active. */}
            {active === ALL ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {g.label}
              </p>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.cards.map((c) => (
                <li key={c.id}>
                  <ServiceCardView card={c} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One service card on the public vendor profile. Renders the base "from ₱X"
 * anchor + (when present) the best-discount badge, FREE inclusions with their
 * stated worth, the crew/meal meta line, and the "not included" expectation
 * flags. All copy is pre-formatted server-side; this stays a dumb view.
 *
 * Layout order top→bottom: title + price (+ pricing-basis detail) · discount
 * badge · showcase media (photo strip + clip) · inclusions · crew/meal meta ·
 * not-included flags · serves line — value story first, caveats + scope last.
 */
function ServiceCardView({ card: c }: { card: ServiceCard }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-ink">{c.label}</p>
        <p className="font-mono text-sm text-ink/80">{c.priceLabel}</p>
      </div>

      {/* Pricing-basis detail — how the anchor is computed (per-guest / per-hour).
          Right-aligned so it reads as a footnote to the "from ₱X" anchor above. */}
      {c.priceDetail ? (
        <p className="text-right font-mono text-[11px] text-ink/50">{c.priceDetail}</p>
      ) : null}

      {c.discountLabel ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
          <BadgePercent className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          {c.discountLabel}
        </span>
      ) : null}

      {/* Showcase media — the vendor's own gallery for THIS service (≤5 photos
          + one ≤30s clip). Rendered small + horizontal so the card stays a
          card; empty media renders nothing (no placeholders). */}
      {c.photos.length > 0 ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {c.photos.map((url, idx) => (
            <div
              key={url}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/5"
            >
              <Image
                src={url}
                alt={`${c.label} showcase ${idx + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      {c.videoUrl ? (
        /* Poster-first: preload="metadata" shows the first frame without
           downloading the clip; muted + playsInline keep mobile behavior tame. */
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={c.videoUrl}
          controls
          preload="metadata"
          playsInline
          muted
          className="mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover"
        />
      ) : null}

      {c.inclusions.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {c.inclusions.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-[12px] text-ink/70">
              <Check
                className="mt-0.5 h-3 w-3 shrink-0 text-mulberry"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
          {c.inclusionsMore > 0 ? (
            <li className="pl-[18px] text-[12px] text-ink/45">
              +{c.inclusionsMore} more included
            </li>
          ) : null}
        </ul>
      ) : null}

      {c.meta ? <p className="mt-2 text-[12px] text-ink/55">{c.meta}</p> : null}

      {c.notIncluded.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {c.notIncluded.map((line) => (
            <li
              key={line}
              className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/55"
            >
              <Info className="h-3 w-3 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Serves — who this service is declared for (coverage event types +
          faiths). Subtle closing line; services without a coverage row show
          nothing rather than guessing. */}
      {c.serves ? (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] text-ink/50">
          <Users className="mt-0.5 h-3 w-3 shrink-0 text-ink/35" strokeWidth={2} aria-hidden />
          <span>Serves: {c.serves}</span>
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
        on
          ? 'border-mulberry bg-mulberry text-cream'
          : 'border-ink/15 bg-cream text-ink/70 hover:border-mulberry/40 hover:text-ink'
      }`}
    >
      <span>{label}</span>
      <span className={on ? 'text-cream/70' : 'text-ink/40'}>{count}</span>
    </button>
  );
}
