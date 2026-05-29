'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  ManualVendorDropdown,
  type ManualVendorOption,
} from './manual-vendor-dropdown';

// Per CLAUDE.md 2026-05-22 owner directive — the inline-text "+ Add"
// freeform input is replaced with a dropdown of host's saved manual
// vendors + a "+ Add new contact" affordance that captures Photo +
// Vendor Name + Contact Person + Contact Number.
//
// Visual hierarchy (2026-05-29 owner directive) — Search is the PRIMARY
// action · Add custom is the SECONDARY fallback. Prior implementation
// rendered both buttons with identical neutral cream styling so manual
// input felt equally legitimate to marketplace search · this PR promotes
// Search to a Mulberry-filled primary CTA and leaves the manual dropdown
// in neutral cream as the secondary affordance. The marketplace is the
// canonical vendor surface for couples · manual input is the off-platform
// fallback when the marketplace lacks the vendor. Hierarchy reflects
// that priority.
//
// The Search button (left side) deep-links into the marketplace catalog
// scoped to this card's folder via ?folder= + #slug anchor.
//
// The Add button (right side) opens ManualVendorDropdown:
//   - If host has saved manual vendors on this event → tap shows the
//     list (avatar + business_name + contact_person). Pick one to
//     attach to THIS category. Reuse semantics: the same manual vendor
//     can land in N cards (Tito Marcel as Coordinator + Host/MC).
//   - If host has NO manual vendors yet → tap goes straight to the
//     "+ Add new contact" modal — skips the empty dropdown step.
//   - Rows for manual vendors already attached to THIS category render
//     as "✓ Added" + disabled (prevents accidental duplicates).
//
// Server actions live in ../vendors/actions.ts (createManualVendor +
// attachManualVendorToCategory + updateManualVendor + deleteManualVendor).
// Both component layers handle their own pending / error states so
// PlanCardCTAs stays a thin compositional shell.

type Props = {
  eventId: string;
  /** Category we tag the inline-added vendor with. The planner card picks
   *  the first entry from the group (the most representative). */
  defaultCategory: string;
  /** Marketplace URL for the Search button. */
  searchHref: string;
  /** Lowercased group label, used in modal header copy. */
  groupLabel: string;
  /** Manual vendors saved on this event — the dropdown's row data. */
  manualVendorOptions: ReadonlyArray<ManualVendorOption>;
  /** Already-attached manual_vendor_ids for THIS group's categories.
   *  Drives the "✓ Added" disabled state per row. */
  manualVendorsAttachedForGroup: ReadonlySet<string>;
};

export function PlanCardCTAs({
  eventId,
  defaultCategory,
  searchHref,
  groupLabel,
  manualVendorOptions,
  manualVendorsAttachedForGroup,
}: Props) {
  return (
    <div className="mt-auto flex items-stretch gap-2">
      {/* Search · PRIMARY CTA · Mulberry-filled per CLAUDE.md 2026-05-29
       *  Clean Editorial palette lock. Promoted from neutral cream
       *  (2026-05-29 owner directive: "why is it just manual input of
       *  the vendors instead of looking for vendors?"). The marketplace
       *  is the canonical vendor discovery surface; this CTA should win
       *  the visual race.
       *
       *  HEIGHT · `h-11` (44px exact) per CLAUDE.md 2026-05-30 owner
       *  directive: "button height are still inconsistent. we want them
       *  to have the same height so familiarity is easy." Matches the
       *  MarketplaceTeaseStrip pills + locked-card "View contract" /
       *  "Open thread" CTAs (`min-h-[44px]`) + every button in the
       *  marketplace FilterDrawer/StickyMarketplaceHeader (CLAUDE.md
       *  2026-05-30 Airbnb-vibe redesign 44pt uniform rule). Dropped
       *  py-1.5 (12px) in favor of `h-11` because the fixed dimension
       *  pairs cleanly with `inline-flex items-center` for vertical
       *  centering and removes the ambiguity between "button big
       *  enough to look like a button" vs "button big enough to be
       *  tap-target accessible." Both invariants now hit the same
       *  surface — 44pt. */}
      <Link
        href={searchHref}
        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--m-mulberry)] px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--m-mulberry-2)]"
      >
        <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Search vendors
      </Link>
      {/* Add custom · SECONDARY · neutral cream styling unchanged. The
       *  dropdown component owns its own button styling at
       *  manual-vendor-dropdown.tsx:162 · we don't override it here so
       *  the visual contrast comes from Search being primary, NOT from
       *  this component shrinking. Couples who genuinely need to track
       *  an off-platform vendor can still find this affordance one tap
       *  away — it doesn't compete with Search. */}
      <ManualVendorDropdown
        eventId={eventId}
        category={defaultCategory}
        categoryLabel={groupLabel}
        manualVendors={manualVendorOptions}
        alreadyAttachedIds={manualVendorsAttachedForGroup}
      />
    </div>
  );
}
