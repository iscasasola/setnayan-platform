import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import { loadPackageDraft, countActiveBookings } from '@/lib/package-draft-loader';
import type { DraftPackage } from '@/lib/package-authoring';
import { PackageEditor } from '../_components/package-editor';

/**
 * /vendor-dashboard/packages/[packageId] — build or edit one package.
 * `new` is handled here rather than as a sibling route so the empty and the
 * loaded form are literally the same component.
 */
export const dynamic = 'force-dynamic';

const CANONICAL_SERVICES = Object.keys(PACKAGE_CANONICAL_TO_VENDOR_CATEGORY)
  .map((value) => ({
    value,
    label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const EMPTY: DraftPackage = {
  package_name: '',
  total_price_centavos: 0,
  consumable_budget_centavos: 0,
  is_consumable_flexible: false,
  items: [],
};

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  if (!packageAuthoringEnabled()) notFound();
  const { packageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id as string;

  const isNew = packageId === 'new';

  let initial = EMPTY;
  let isActive = false;
  let frozen = false;

  if (!isNew) {
    // ONE loader, shared with the save action. Both call sites used to run
    // their own copy of this query and both destructured only `{ data }`, so a
    // 400 on the item select degraded into an EMPTY draft that the vendor could
    // then save over the real rows. See lib/package-draft-loader.ts.
    const read = await loadPackageDraft(supabase, vendorProfileId, packageId);
    if (!read.ok) {
      if (read.reason === 'not_found') notFound();
      // Loud on purpose. Rendering an empty editor here is what turns an
      // unreadable package into a destructive save on the vendor's next click.
      throw new Error(
        `Could not read package ${packageId}: ${read.message}. Refusing to render ` +
          'an empty editor — saving it would delete the package\'s real inclusions.',
      );
    }

    // A live booking freezes the structure — see editScopeForPackage. Released
    // bookings no longer bind, so they do not freeze. An unreadable count is
    // NOT zero: reading it as zero unfreezes a booked package and unlocks the
    // branch that deletes every item row underneath a live contract.
    const bookings = await countActiveBookings(supabase, packageId);
    if (bookings === null) {
      throw new Error(
        `Could not check bookings for package ${packageId}. Refusing to render the ` +
          'editor unfrozen — a booked package must never open in structural-edit mode.',
      );
    }

    isActive = read.loaded.isActive;
    frozen = bookings > 0;
    initial = read.loaded.draft;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/packages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/55 hover:text-ink/80"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        All packages
      </Link>
      <h1 className="mb-6 font-serif text-2xl text-ink/90">
        {isNew ? 'Build a package' : initial.package_name || 'Untitled package'}
      </h1>

      <PackageEditor
        packageId={isNew ? undefined : packageId}
        initial={initial}
        isActive={isActive}
        frozen={frozen}
        canonicalServices={CANONICAL_SERVICES}
      />
    </main>
  );
}
