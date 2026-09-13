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
import { ServiceCardView } from '@/app/_components/service-card-view';
import type { ServiceCard } from '@/lib/service-card-view-model';

// Re-exported so existing importers (service-details-sheet) keep working; the
// type's home is the view-model lib, which both sides of the app read.
export type { ServiceCard };
import type { CompiledCardRecord } from '@/lib/service-card-record';
import {
  ServiceDetailsSheet,
  type ServiceInquireMode,
} from './service-details-sheet';

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
