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
import { BadgePercent, Check, ChevronRight, Info, Users } from 'lucide-react';
import {
  CardRecordSection,
  type CardRecordRating,
} from '@/app/_components/card-record-section';
import type { CompiledCardRecord } from '@/lib/service-card-record';
import {
  ServiceDetailsSheet,
  type ServiceInquireMode,
} from './service-details-sheet';

export type ServiceCard = {
  id: string;
  /**
   * `vendor_services.public_id` (S89…) — the deep-link handle for `?service=`.
   * The internal uuid stays out of the URL bar.
   *
   * OPTIONAL, and ABSENT (not `''`, not null) when `serviceDetailsEnabled()` is
   * off: the flag's contract is that the flag-OFF card is byte-identical to
   * today, and that has to include the serialized RSC payload, not just the
   * rendered DOM. Pinned by `service-details-dark.test.ts`.
   */
  publicId?: string;
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
  /** The UNTRIMMED inclusion list, for the details sheet — the "+N more" tail is
   *  exactly what a couple opens the sheet to read. Present ONLY when
   *  `serviceDetailsEnabled()`; with the flag off the key is ABSENT, so the
   *  card's serialized payload is byte-for-byte what it is today. */
  inclusionsFull?: string[];
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
  // ── Card Record (2026-07-28, flag NEXT_PUBLIC_CARD_RECORD_ENABLED) ────────
  /** Compiled history of THIS card — booked count, event-type mix, anonymized
   *  ledger, milestone medals. Compiled server-side by compileCardRecord(); the
   *  underlying reader emits only de-identified aggregates. null when the flag
   *  is off OR the card has never been booked — a zero-history card shows
   *  nothing new. */
  record: CompiledCardRecord | null;
  /** Vendor-level trusted rating shown inside the record block. SHOP-wide, not
   *  per-card: reviews carry no service dimension. null → no stars. */
  recordRating: CardRecordRating | null;
};

export type ServiceGroup = {
  key: string;
  label: string;
  cards: ServiceCard[];
};

const ALL = '__all__';

export function ServicesGallery({
  groups,
  /**
   * `serviceDetailsEnabled()`, resolved server-side. OFF ⇒ every card renders
   * as the same static `<div>` it does today, no sheet is ever mounted, and no
   * doorway affordance is added.
   */
  detailsEnabled = false,
  /**
   * How the sheet's "Inquire about this" should behave — decided server-side
   * because only the server knows which composer is on the page. Ignored while
   * `detailsEnabled` is false.
   */
  inquireMode = 'none',
  /**
   * `?service=<public id>` from the URL — opens that card's sheet on arrival, so
   * a details screen is linkable. An unknown / stale id opens nothing (it is
   * matched against the cards the server actually rendered), never errors.
   */
  openServicePublicId = null,
}: {
  groups: ServiceGroup[];
  detailsEnabled?: boolean;
  inquireMode?: ServiceInquireMode;
  openServicePublicId?: string | null;
}) {
  const [active, setActive] = useState<string>(ALL);

  // The card whose details sheet is open, by `ServiceCard.id`. Seeded ONCE from
  // the deep link (lazy initial state, so a later re-render can't re-open a
  // sheet the couple already dismissed).
  const [openCardId, setOpenCardId] = useState<string | null>(() => {
    if (!detailsEnabled || !openServicePublicId) return null;
    for (const g of groups) {
      const hit = g.cards.find((c) => c.publicId === openServicePublicId);
      if (hit) return hit.id;
    }
    return null;
  });

  // Only offer filtering when there's more than one coverage group to switch
  // between; otherwise the chips are dead weight.
  const showChips = groups.length > 1;
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const visible = active === ALL ? groups : groups.filter((g) => g.key === active);

  // Resolved across ALL groups, not just the visible ones: a deep link can name
  // a card sitting behind a coverage chip the couple has not clicked.
  const openCard = openCardId
    ? (groups.flatMap((g) => g.cards).find((c) => c.id === openCardId) ?? null)
    : null;

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
                  <ServiceCardView
                    card={c}
                    detailsEnabled={detailsEnabled}
                    onOpen={() => setOpenCardId(c.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ONE sheet for the whole gallery, not one per card — mounting a dialog
          per card would put N focus-trap subscriptions on the page for a screen
          only ever open on one of them. */}
      {detailsEnabled && openCard ? (
        <ServiceDetailsSheet
          card={openCard}
          inquireMode={inquireMode}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}
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
 *
 * ── THE DOORWAY (flag: NEXT_PUBLIC_SERVICE_DETAILS_ENABLED) ─────────────────
 * With the flag ON the card becomes clickable: a STRETCHED button covering the
 * card opens `ServiceDetailsSheet`. Stretched rather than wrapping the whole
 * card in a `<button>` because the card already contains a `<video controls>`,
 * and an interactive control nested inside a button is invalid markup that
 * eats the video's own controls. The overlay is the LAST child, so it paints
 * over the static content without any z-index; the clip is lifted above it with
 * `relative z-10` so play/scrub still work in place.
 *
 * With the flag OFF this returns the identical static `<div>` it always has —
 * same class string, same children, no overlay, no affordance, and the sheet
 * module is never mounted.
 */
function ServiceCardView({
  card: c,
  detailsEnabled,
  onOpen,
}: {
  card: ServiceCard;
  detailsEnabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={
        detailsEnabled
          ? 'relative flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40'
          : 'flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4'
      }
    >
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
          className={
            detailsEnabled
              ? 'relative z-10 mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover'
              : 'mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover'
          }
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

      {/* Card record — the compiled history this card has earned. Appended, not
          woven in: it closes the card below every claim the vendor authored, so
          the proof reads last. `mt-auto` inside the section pins it to the
          card's bottom edge across a grid row of unequal cards. Absent unless
          the flag is on AND the card has been booked at least once. */}
      {c.record ? (
        <CardRecordSection record={c.record} variant="couple" rating={c.recordRating} />
      ) : null}

      {/* The doorway. A VISIBLE affordance, because a card that silently became
          clickable is a card nobody clicks. Decorative only — the accessible
          name lives on the stretched overlay below, so this is aria-hidden to
          avoid announcing the same control twice. */}
      {detailsEnabled ? (
        <p
          aria-hidden
          className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700"
        >
          View details
          <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
        </p>
      ) : null}

      {/* THE STRETCHED BUTTON — last child, so it covers the static content
          without a z-index. The clip above carries `relative z-10` and stays
          usable in place. */}
      {detailsEnabled ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View details for ${c.label}`}
          className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />
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
