'use client';

/**
 * Card 18 Attire · client UI · sub-tab picker.
 *
 * 2026-05-28 (this commit · PR (b) stage 2 / PR (g)) · adds sub-tab pills
 * over the existing VendorPickGridCard so hosts can narrow the 6-canonical
 * attire pool to one sub-category at a time:
 *   All · Bridal Gown · Groom's Suit · Bridal Shoes · Groom's Shoes ·
 *   Entourage Attire · Parents Attire
 *
 * Single-pick semantics preserved · locking ANY vendor advances the
 * wizard (existing behavior). Hosts who want to lock multiple
 * sub-categories re-engage with the card after settle (wizard supports
 * re-entry via `?card=attire`). Full multi-pick semantics (lock without
 * advancing + "Mark complete" CTA · mirrors Card 14 Photobooths) stay
 * V1.x scope per CLAUDE.md decision-log "Vendor presentation pattern
 * locked · Creations vs Locked · per-card filter approach".
 *
 * Lifted to a client island so tab state stays in-card without forcing a
 * URL re-render. Server fetches 6 collections in parallel and hands them
 * down · client tab swap is O(0) (just swaps the active array).
 */

import { useState } from 'react';
import { VendorPickGridCard } from './vendor-pick-grid-card';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';

type SubKey =
  | 'all'
  | 'bridal_gown'
  | 'groom_suit'
  | 'bridal_shoes'
  | 'groom_shoes'
  | 'entourage_attire'
  | 'parents_attire';

/** Display label per sub-key. "All" first as the default entry. */
const SUB_LABELS: Record<SubKey, string> = {
  all: 'All attire',
  bridal_gown: 'Bridal gown',
  groom_suit: "Groom's suit",
  bridal_shoes: 'Bridal shoes',
  groom_shoes: "Groom's shoes",
  entourage_attire: 'Entourage',
  parents_attire: 'Parents',
};

/** Short label for the picked-vendor copy hint on each tab. */
const PLURAL_NOUN: Record<SubKey, string> = {
  all: 'attire designers',
  bridal_gown: 'bridal gown designers',
  groom_suit: "groom's suit designers",
  bridal_shoes: 'bridal shoe designers',
  groom_shoes: "groom's shoe designers",
  entourage_attire: 'entourage attire designers',
  parents_attire: 'parents attire designers',
};

/** Tab order · "All" first then the 6 sub-categories in canonical order. */
const TAB_ORDER: ReadonlyArray<SubKey> = [
  'all',
  'bridal_gown',
  'groom_suit',
  'bridal_shoes',
  'groom_shoes',
  'entourage_attire',
  'parents_attire',
];

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** Pre-fetched server collections · one per sub-category. The "all"
   *  collection is computed client-side as the union (deduplicated by
   *  vendor_profile_id) so the server fetches 6 not 7. */
  recsBySubKey: Record<Exclude<SubKey, 'all'>, ReadonlyArray<WizardVendorRec>>;
  bookedMarketplaceVendorIds: ReadonlyArray<string>;
  /** Locale-adaptive empty-state copy resolved on the server. */
  emptyStateCopy: string;
};

export function AttireSubTabsClient({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  recsBySubKey,
  bookedMarketplaceVendorIds,
  emptyStateCopy,
}: Props) {
  const [activeTab, setActiveTab] = useState<SubKey>('all');

  // Compute "All" as deduplicated union — preserves top-rated cross-
  // category. Dedupe by vendor_profile_id so a vendor offering multiple
  // sub-categories appears once.
  const allRecs: ReadonlyArray<WizardVendorRec> = (() => {
    const seen = new Set<string>();
    const merged: WizardVendorRec[] = [];
    for (const sub of TAB_ORDER) {
      if (sub === 'all') continue;
      for (const rec of recsBySubKey[sub]) {
        if (seen.has(rec.vendor_profile_id)) continue;
        seen.add(rec.vendor_profile_id);
        merged.push(rec);
      }
    }
    // Existing default sort already applied at SQL level (ad_rank →
    // review_count → avg_rating_overall). Cross-category union breaks
    // that single-sort because each per-canonical list has its own
    // ordering; for "All" we re-sort by (ad_rank desc, review_count
    // desc, rating desc) so the top picks across all 6 categories
    // surface first.
    merged.sort((a, b) => {
      const adA = a.ad_rank ?? 0;
      const adB = b.ad_rank ?? 0;
      if (adB !== adA) return adB - adA;
      const rcA = a.review_count ?? 0;
      const rcB = b.review_count ?? 0;
      if (rcB !== rcA) return rcB - rcA;
      const arA = a.avg_rating_overall ?? 0;
      const arB = b.avg_rating_overall ?? 0;
      return arB - arA;
    });
    return merged;
  })();

  const activeRecs =
    activeTab === 'all' ? allRecs : recsBySubKey[activeTab];

  // Sub-tab uses the single matching canonical · "All" passes the full
  // 6-canonical filter so locked vendors still match against the active
  // category set when the host adds a custom vendor or searches.
  const canonicalServices: ReadonlyArray<string> =
    activeTab === 'all'
      ? [
          'bridal_gown',
          'groom_suit',
          'bridal_shoes',
          'groom_shoes',
          'entourage_attire',
          'parents_attire',
        ]
      : [activeTab];

  // Per-tab copy · falls back to the locale-adaptive emptyStateCopy
  // resolved on the server for "all" (which carries the ceremony-type
  // nuance — Muslim modest attire, Cultural Filipiniana, etc.).
  const copy = {
    pluralNoun: PLURAL_NOUN[activeTab],
    customAddLabel: 'Already booked your designer or rental?',
    emptyStateCopy:
      activeTab === 'all'
        ? emptyStateCopy
        : `No ${PLURAL_NOUN[activeTab]} curated for your area yet — search by name or add yours below.`,
  } as const;

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-tab pill row · horizontal scroll on mobile when overflow.
          Per [[feedback_setnayan_no_dev_text_post_launch]] · brand
          voice labels, no jargon. Active tab uses terracotta accent ·
          inactive tabs use cream + ink for legibility. */}
      <div
        role="tablist"
        aria-label="Filter attire by sub-category"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1"
      >
        {TAB_ORDER.map((tab) => {
          const isActive = tab === activeTab;
          const count =
            tab === 'all' ? allRecs.length : recsBySubKey[tab].length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ' +
                (isActive
                  ? 'border-terracotta bg-terracotta text-cream shadow-sm'
                  : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30 hover:bg-cream/80')
              }
            >
              <span>{SUB_LABELS[tab]}</span>
              <span
                className={
                  'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ' +
                  (isActive
                    ? 'bg-cream/25 text-cream'
                    : 'bg-ink/10 text-ink/65')
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Body · the existing VendorPickGridCard surface · renders the
          active tab's recs with the canonical-services filter scoped
          to the tab. Lock advances wizard (single-pick semantics);
          host re-engages via `?card=attire` for additional sub-cats. */}
      <VendorPickGridCard
        key={activeTab}
        eventId={eventId}
        taskId="attire"
        initialRecommendations={activeRecs}
        searchContext={{
          canonicalServices,
          ceremonyType,
          venueSetting,
          excludeVendorIds: excludeMarketplaceIds,
        }}
        copy={copy}
        bookedMarketplaceVendorIds={bookedMarketplaceVendorIds}
      />
    </div>
  );
}
