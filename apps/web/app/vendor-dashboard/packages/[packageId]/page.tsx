import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import { loadPackageDraft, countActiveBookings } from '@/lib/package-draft-loader';
import type { DraftPackage } from '@/lib/package-authoring';
import { readBundleCards, readLockShop } from '@/lib/bundle-cards.server';
import { canUse, papersProgress } from '@/lib/locks';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots, fetchLatestApplication, type DocUploadMap } from '@/lib/vendor-verification';
import { PackageEditor } from '../_components/package-editor';
import { BundleMakerLocked } from '../_components/bundle-maker-locked';

/**
 * /vendor-dashboard/packages/[packageId] — THE BUNDLE MAKER, full screen (Build 6 · Lane D).
 * `new` is handled here rather than as a sibling route so the empty and the loaded form are literally the same
 * component. The maker RISES FULL SCREEN (`RiseScreen` inside the editor): the bars step away, ✕ returns to the Shop's
 * services — "full screen always loses the bottom nav" (DECISION_LOG 2026-11-09).
 *
 * 🔒 THE SHARED LOCK FIRST (lib/locks.ts `bundleMaker`): a shop that may not use it sees the shared explainer, and the
 * save refuses the same (`savePackage` → `canUse`). An unread lock is refused loudly, never drawn open.
 */
export const dynamic = 'force-dynamic';

/** ✕ goes back to where the maker is opened from: Shop › Your bundles and services. */
const SHOP_SERVICES = '/vendor-dashboard/shop#services';

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
  extra_discount_centavos: 0,
  plan: null,
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

  // 🔒 The lock and the cards (with their prices, discounts and inclusions) — read together, in one batch.
  const [shop, cards] = await Promise.all([readLockShop(supabase, vendorProfileId), readBundleCards(supabase, vendorProfileId)]);
  if (!shop) {
    throw new Error('Could not read this shop’s plan, so the Bundle Maker is not drawn open — reload in a moment.');
  }
  const may = canUse('bundleMaker', shop);
  if (!may.ok) {
    const papers = shop.verified
      ? null
      : await fetchLatestApplication(supabase, vendorProfileId)
          .then((a) => ({ done: countCompleteRequiredSlots((a?.doc_uploads ?? {}) as DocUploadMap), of: REQUIRED_DOC_COUNT }))
          .catch((err) => {
            console.error('[supabase-error] packages/[packageId] · latest application', err);
            return null;
          });
    return <BundleMakerLocked need={{ kind: 'verify', progress: papersProgress(papers) }} closeHref={SHOP_SERVICES} />;
  }

  let initial = EMPTY;
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

    frozen = bookings > 0;
    initial = read.loaded.draft;
  }

  return (
    <PackageEditor
      cards={cards}
      shopName={profile.business_name ?? null}
      packageId={isNew ? undefined : packageId}
      initial={initial}
      frozen={frozen}
      canonicalServices={CANONICAL_SERVICES}
      closeHref={SHOP_SERVICES}
      now={new Date().toISOString()}
    />
  );
}
