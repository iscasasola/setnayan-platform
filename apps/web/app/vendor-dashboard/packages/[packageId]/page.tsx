import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import { loadPackageDraft, countActiveBookings } from '@/lib/package-draft-loader';
import type { DraftPackage } from '@/lib/package-authoring';
import { humanizeKind } from '@/lib/service-card-kind';
import { freeByKind } from '@/lib/shop-gifts';
import { fetchShopGiftPacks, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { PackageEditor, type BundleCard } from '../_components/package-editor';
import { loadClaimWordsFor } from '@/lib/service-card-checks.server';

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
  gift: '',
};

/**
 * THE SHOP'S SERVICE CARDS — what "Add a card" lists (the bundle maker, owner 2026-11-07: "service cards first, as
 * locked lines"). Each card's own from-price comes with it; a price is never typed for a card here. `null` = the read
 * was refused, and the maker says so instead of offering an empty list (the 20 Aug disease).
 */
async function fetchBundleCards(supabase: SupabaseClient, vendorProfileId: string): Promise<BundleCard[] | null> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id, title, category, starting_price_php, is_active')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[supabase-error] packages/[packageId] · from:vendor_services.select (bundle cards)', error);
    return null;
  }
  return ((data ?? []) as Array<{
    vendor_service_id: string;
    title: string | null;
    category: string;
    starting_price_php: number | null;
    is_active: boolean | null;
  }>).map((r) => ({
    id: r.vendor_service_id,
    name: r.title?.trim() || humanizeKind(r.category),
    category: r.category,
    fromPhp: r.starting_price_php,
  }));
}

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

  // 🎁 The Gift row and the card list — read together, in one batch, not one after another.
  // 🚫 …and the claim-word list for the bundle name's live note (owner 2026-11-08), in the same batch.
  const [cards, packs, stock, fairWords] = await Promise.all([
    fetchBundleCards(supabase, vendorProfileId),
    // 🔒 The catalogue's gift price is withheld from a session (G6): the packs are read with the service role.
    fetchShopGiftPacks(createAdminClient()),
    fetchShopGiftStock(supabase, vendorProfileId),
    loadClaimWordsFor(vendorProfileId), // never throws — unread is `null`, logged where read
  ]);

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
    // 📐 Maximize the screen: from 820 the form and "What the couple gets" split the width (the editor's grid); the
    // foot clears the floating thumb row.
    <div className="mx-auto w-full max-w-6xl px-4 pb-36 pt-8 sm:px-6">
      <Link
        href="/vendor-dashboard/packages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/55 hover:text-ink/80"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        All packages
      </Link>
      {/* The prototype's head (makers_match § 4): the title + one line. */}
      <h1 className="font-serif text-2xl text-ink/90">
        {isNew ? 'Your bundle' : initial.package_name || 'Untitled bundle'}
      </h1>
      <p className="mb-6 mt-1 text-[14px] text-ink/60">Several service cards as one package.</p>

      <PackageEditor
        cards={cards}
        giftPacks={packs}
        giftFree={freeByKind(stock)}
        shopName={profile.business_name ?? null}
        fairWords={fairWords}
        packageId={isNew ? undefined : packageId}
        initial={initial}
        isActive={isActive}
        frozen={frozen}
        canonicalServices={CANONICAL_SERVICES}
      />
    </div>
  );
}
