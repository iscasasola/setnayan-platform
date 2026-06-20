import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  VENDOR_CATEGORIES,
  displayServiceLabel,
  type VendorCategory,
} from '@/lib/vendors';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { ServiceWizard } from '../../_components/service-wizard';

export const metadata = { title: 'Add a service · Setnayan' };

const CATEGORY_SET = new Set<string>(VENDOR_CATEGORIES);

/**
 * /vendor-dashboard/services/new/[category] — the guided "create a service"
 * flow (vendor Services builder redesign, owner 2026-06-20). Replaces the
 * inline ?add=<category> form. The category is chosen on the Services page
 * (left-rail picker) and is fixed for this flow; the wizard ends in ONE atomic
 * save (commitVendorService → save_vendor_service RPC).
 */
export default async function NewServicePage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!CATEGORY_SET.has(category)) notFound();
  const cat = category as VendorCategory;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The vendor's OTHER offered categories → the "comes with" link options.
  const { data: ownRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const otherCategories = Array.from(
    new Set(
      ((ownRows ?? []) as { category: string }[])
        .map((r) => r.category)
        .filter((c) => c !== cat),
    ),
  ).map((c) => ({ value: c, label: displayServiceLabel(c as VendorCategory) }));

  // Tier → daily-capacity ceiling for the availability step.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, is_founder')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tierRowTyped = tierRow as
    | { tier_state?: string | null; is_founder?: boolean | null }
    | null;
  const baseCaps = tierCaps(asVendorTier(tierRowTyped?.tier_state));
  const slotsPerDay =
    tierRowTyped?.is_founder === true ? Infinity : baseCaps.slotsPerDay;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/services"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Services
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a service</h1>
      <p className="mb-6 mt-1 text-sm text-ink/60">
        A few quick answers — three to publish, the rest optional. Everything saves together at the end.
      </p>
      <ServiceWizard
        categoryValue={cat}
        categoryLabel={displayServiceLabel(cat)}
        otherCategories={otherCategories}
        branches={[]}
        slotsPerDay={slotsPerDay === Infinity ? 99 : slotsPerDay}
      />
    </div>
  );
}
