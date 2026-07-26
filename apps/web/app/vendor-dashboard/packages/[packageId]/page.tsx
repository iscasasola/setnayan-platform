import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import {
  PACKAGE_CANONICAL_TO_VENDOR_CATEGORY,
  PACKAGE_ITEM_OPTION_SELECT,
} from '@/lib/vendor-packages';
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
    const { data: pkg } = await supabase
      .from('vendor_packages')
      .select(
        'package_id, package_name, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, is_active',
      )
      .eq('package_id', packageId)
      .eq('vendor_profile_id', vendorProfileId) // ownership, not a filter
      .maybeSingle();
    if (!pkg) notFound();

    const { data: items } = await supabase
      .from('vendor_package_items')
      .select(
        'item_id, canonical_service, service_description, is_default_included, is_required, replacement_value_centavos',
      )
      .eq('package_id', packageId)
      .order('display_order', { ascending: true });

    const itemIds = (items ?? []).map((i) => i.item_id);
    const { data: options } = itemIds.length
      ? await supabase
          .from('vendor_package_item_options')
          .select(PACKAGE_ITEM_OPTION_SELECT)
          .in('item_id', itemIds)
          .order('display_order', { ascending: true })
      : { data: [] as never[] };

    // A live booking freezes the structure — see editScopeForPackage. Released
    // bookings no longer bind, so they do not freeze.
    const { count } = await supabase
      .from('event_vendor_packages')
      .select('booking_id', { count: 'exact', head: true })
      .eq('package_id', packageId)
      .neq('status', 'released');

    isActive = pkg.is_active;
    frozen = (count ?? 0) > 0;
    initial = {
      package_name: pkg.package_name,
      total_price_centavos: pkg.total_price_centavos,
      consumable_budget_centavos: pkg.consumable_budget_centavos,
      is_consumable_flexible: pkg.is_consumable_flexible,
      items: (items ?? []).map((i) => ({
        ref: i.item_id,
        service_description: i.service_description,
        canonical_service: i.canonical_service,
        is_default_included: i.is_default_included,
        is_required: i.is_required ?? false,
        replacement_value_centavos: i.replacement_value_centavos,
        options: (options ?? [])
          .filter((o) => o.item_id === i.item_id)
          .map((o) => ({
            ref: o.option_id,
            label: o.option_label,
            price_delta_centavos: o.price_delta_centavos,
            is_default: o.is_default,
            is_available: o.is_available,
          })),
      })),
    };
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
