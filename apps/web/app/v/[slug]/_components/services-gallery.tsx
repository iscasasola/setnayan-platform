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

import { useEffect, useMemo, useRef, useState } from 'react';
import { couplePhotoShare } from '@/app/_actions/couple-photo-share-actions';
import { recordVendorProfileView } from '@/lib/record-vendor-view';
import type { CoupleLook } from '@/lib/service-card-view-model';
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
import { formatCount } from '@/lib/format-number';

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
  viewerSignedIn = false,
  shopName = null,
  countOpensFor = null,
}: {
  groups: ServiceGroup[];
  /** The shop's name — the grown card's face says "by {shop}" under the card's name. */
  shopName?: string | null;
  /**
   * 👁 A SIGNED-IN viewer (owner 2026-10-30, "set who gets to see it"): after the page, ask once for the NON-public
   * couple photos this viewer is inside the audience of (the database decides; signed URLs). The server-rendered
   * cards carry Public ones only, so nothing non-public is ever in the cached HTML. Not signed in → no request.
   */
  viewerSignedIn?: boolean;
  detailsEnabled?: boolean;
  inquireMode?: ServiceInquireMode;
  openServicePublicId?: string | null;
  /**
   * 📈 The shop whose card OPENS count (Build 6 Lane I, Shop › Analytics "Which card sells") — null = count nothing
   * (a demo shop, the team's own preview, a lab). Each open of the grown card is ONE open of that card; the database
   * refuses the shop's own people and admins and dedupes per viewer per card per day (`record_service_card_view`).
   */
  countOpensFor?: string | null;
}) {
  const [active, setActive] = useState<string>(ALL);
  // 🃏 The tapped card's box — the Service card grown rises from it and falls back into it (Build 5 Lane C).
  const originRef = useRef<HTMLElement | null>(null);

  const cardIds = useMemo(() => groups.flatMap((g) => g.cards.map((c) => c.id)), [groups]);
  const [extraLooks, setExtraLooks] = useState<Record<string, CoupleLook[]>>({});
  useEffect(() => {
    if (!viewerSignedIn || cardIds.length === 0) return;
    let live = true;
    couplePhotoShare({ op: 'viewer_looks', vendorServiceIds: cardIds })
      .then((reply) => {
        if (live && reply.op === 'viewer_looks') setExtraLooks(reply.result);
      })
      .catch(() => {
        /* Fail quiet: the Public photos already on the card stay; nothing else is promised. */
      });
    return () => {
      live = false;
    };
  }, [viewerSignedIn, cardIds]);
  /** The card as THIS viewer may see it: its Public couple photos, then the extra ones the audience lets them see. */
  const withViewerLooks = (c: ServiceCard): ServiceCard => {
    const extra = extraLooks[c.id];
    if (!extra || extra.length === 0) return c;
    const seen = new Set((c.coupleLooks ?? []).map((l) => l.id));
    return { ...c, coupleLooks: [...(c.coupleLooks ?? []), ...extra.filter((l) => !seen.has(l.id))] };
  };

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

  // 📈 One open of the card per time it grows (a tap or the deep link). Fire-and-forget: it changes nothing on screen.
  useEffect(() => {
    if (!countOpensFor || !openCardId) return;
    void recordVendorProfileView({ vendorProfileId: countOpensFor, serviceId: openCardId }).catch(() => {});
  }, [countOpensFor, openCardId]);

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

      {/* ONE GRID, NOT ONE PER GROUP (owner 12 Nov, "ONE SERVICE CARD, EVERYWHERE"): every visible card in one list —
          1 column on a phone, 2, then 3 — so a group with a single card never strands half a row. The group is said on
          each card's path line, and the chips above still filter by it. */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-services-one-grid="">
        {visible.flatMap((g) =>
          g.cards.map((c) => (
            <li key={c.id}>
              <ServiceCardView
                card={withViewerLooks(c)}
                path={g.label}
                detailsEnabled={detailsEnabled}
                onOpen={(from) => {
                  originRef.current = from;
                  setOpenCardId(c.id);
                }}
              />
            </li>
          )),
        )}
      </ul>

      {/* ONE sheet for the whole gallery, not one per card — mounting a dialog
          per card would put N focus-trap subscriptions on the page for a screen
          only ever open on one of them. */}
      {detailsEnabled && openCard ? (
        <ServiceDetailsSheet
          // The viewer's extra couple photos travel with the card into the grown card — the face no longer shows them.
          card={withViewerLooks(openCard)}
          inquireMode={inquireMode}
          shopName={shopName}
          from={originRef.current}
          onClose={() => setOpenCardId(null)}
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
      <span className={on ? 'text-cream/70' : 'text-ink/40'}>{formatCount(count)}</span>
    </button>
  );
}
