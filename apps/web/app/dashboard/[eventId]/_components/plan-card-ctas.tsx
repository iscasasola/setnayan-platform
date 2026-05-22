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
// The Search button (left side) is unchanged — still deep-links into
// the marketplace catalog scoped to this card's folder via ?folder=
// + #slug anchor.
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
      <Link
        href={searchHref}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Search
      </Link>
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
