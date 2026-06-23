import Link from 'next/link';
import { Compass } from 'lucide-react';
import { fetchSavedVendors } from '../_data/saved-vendors';
import { SavedVendorCardItem } from './saved-vendor-card';

/**
 * Library · Saved Vendors tab — every vendor the user has SAVED across all the
 * events they host, deduped. "Saved" = an `event_vendors` row with a non-null
 * `marketplace_vendor_id` (written by `saveVendorToPicks`). The RLS read policy
 * scopes the underlying query to all of the user's couple-events, so this is a
 * true cross-event aggregate. See `_data/saved-vendors.ts` for the data path.
 *
 * Stays an async server component exported as `VendorsTab` with the
 * `{ userId }: { userId: string }` signature the hub page (page.tsx) renders.
 * `userId` is unused — the save query is RLS-scoped to the authenticated
 * session, not parameterized by id — but the prop is part of the tab contract.
 */
export async function VendorsTab({ userId }: { userId: string }) {
  void userId;
  const vendors = await fetchSavedVendors();

  if (vendors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <p className="text-sm text-ink/60">No saved vendors yet.</p>
        <Link
          href="/explore"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta/90"
        >
          <Compass aria-hidden className="h-4 w-4" strokeWidth={2} />
          Explore the marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {vendors.map((v) => (
        <SavedVendorCardItem key={v.vendorProfileId} vendor={v} />
      ))}
    </div>
  );
}
