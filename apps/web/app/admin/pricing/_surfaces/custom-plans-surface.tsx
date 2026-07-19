// Money-split studio surface — the body of the former custom-plans page,
// re-homed here (2026-07-10). actions/_components stay in /admin/custom-plans; the
// legacy route is now a redirect (or, for pricing/settings, the studio shell).
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchCustomUnitPrices } from '@/lib/vendor-custom-catalog';
import type {
  CustomComposition,
  CustomDiscount,
} from '@/lib/vendor-custom-pricing';
import { CUSTOM_BASE } from '@/lib/vendor-custom-pricing';
import {
  CustomComposer,
  type VendorOption,
  type LoadedPlan,
} from '@/app/admin/custom-plans/_components/custom-composer';

import { requireAdmin } from '@/lib/admin/require-admin';

type Props = { searchParams: Promise<{ vendor?: string }> };

const PESO = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

/** Statuses that need Setnayan's attention — a vendor asked, or a quote is out. */
const OPEN_REQUEST_STATUSES = ['pending_payment', 'quoted'] as const;

const REQUEST_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending_payment: {
    label: 'Requested · awaiting payment',
    className: 'bg-terracotta/10 text-terracotta',
  },
  quoted: { label: 'Quote sent', className: 'bg-ink/8 text-ink/70' },
};

/** One-line "what they asked for" — only the dials that sit above the base. */
function summarizeComposition(c: CustomComposition | null): string {
  if (!c) return 'Base plan';
  const parts: string[] = [];
  const branches = Number(c.branches) || 1;
  if (branches > 1) parts.push(`${branches} branches`);
  if (c.nationwide) parts.push('Nationwide');
  else if (Number(c.reachKm) > CUSTOM_BASE.reachKm) parts.push(`${Number(c.reachKm)} km`);
  if (Number(c.seats) > CUSTOM_BASE.seats) parts.push(`${Number(c.seats)} seats`);
  if (Number(c.slotsPerCategory) > CUSTOM_BASE.slotsPerCategory)
    parts.push(`${Number(c.slotsPerCategory)} slots`);
  if (Number(c.photos) > CUSTOM_BASE.photos) parts.push(`${PESO.format(Number(c.photos))} photos`);
  if (Number(c.tokensPerCycle) > 0) parts.push(`${Number(c.tokensPerCycle)} tokens/cycle`);
  if (c.domain) parts.push('own domain');
  return parts.length ? parts.join(' · ') : 'Base plan (no add-ons)';
}

type CustomRequest = {
  planId: string;
  vendorId: string;
  vendorName: string;
  tier: string | null;
  status: string;
  quoted28: number | null;
  summary: string;
  updatedAt: string | null;
};

/**
 * /admin/custom-plans — HQ Custom-tier composer (VENDOR_TIERS_AND_BENEFITS.md §11).
 *
 * The admin picks any vendor org, dials the SAME 7 composition knobs the vendor
 * configurator exposes (branches · reach±nationwide · seats · slots · photos ·
 * tokens · domain), optionally overrides the 9 unit prices FOR THIS QUOTE ONLY
 * (the persistent catalog stays authoritative at /admin/pricing), and applies a
 * partner discount. A composition-first preview shows what the vendor GETS in
 * plain words, then the price block. "Send quote" upserts the vendor_custom_plans
 * row + opens the apply-then-pay order so it lands in /admin/payments; approving
 * that payment provisions the Custom tier (lib/sku-activation.ts, service key
 * vendor_custom_plan__{id}). An explicit "Mark active" lever provisions comp /
 * off-platform-settled deals without the payment round-trip.
 *
 * Unit prices are read SERVER-SIDE from the admin-managed vendor_billing_catalog
 * so a price edit flows through with no code change; the composer only overrides
 * them in-memory for the preview + the (server-recomputed) quote.
 */
export async function CustomPlansSurface({ searchParams }: Props) {
  await requireAdmin();
  const { vendor: selectedVendorId = null } = await searchParams;
  const admin = createAdminClient();

  // Vendor orgs (claimed) + their tier, the live catalog unit prices, and the
  // open Custom-plan requests inbox (vendors who asked + quotes still out).
  const [vendorRes, catalogPrices, requestRes] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, tier_state')
      .not('user_id', 'is', null)
      .order('business_name', { ascending: true })
      .limit(500),
    fetchCustomUnitPrices(admin),
    admin
      .from('vendor_custom_plans')
      .select(
        'custom_plan_id, vendor_profile_id, composition, quoted_28d_php, status, updated_at, vendor_profiles(business_name, tier_state)',
      )
      .in('status', [...OPEN_REQUEST_STATUSES])
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);
  if (vendorRes.error) logQueryError('AdminCustomPlansPage (vendors)', vendorRes.error);
  if (requestRes.error) logQueryError('AdminCustomPlansPage (requests)', requestRes.error);

  // PostgREST returns the many-to-one `vendor_profiles` embed as a single object
  // at runtime, but Supabase's generated types infer it as an array — normalize
  // both shapes so the name/tier resolve either way.
  type EmbeddedVendor = { business_name: string | null; tier_state: string | null };
  const rawRequests = (requestRes.data ?? []) as unknown as Array<{
    custom_plan_id: string;
    vendor_profile_id: string;
    composition: CustomComposition | null;
    quoted_28d_php: number | string | null;
    status: string;
    updated_at: string | null;
    vendor_profiles: EmbeddedVendor | EmbeddedVendor[] | null;
  }>;
  const requests: CustomRequest[] = rawRequests.map((r) => {
    const vp = Array.isArray(r.vendor_profiles)
      ? (r.vendor_profiles[0] ?? null)
      : r.vendor_profiles;
    return {
      planId: r.custom_plan_id,
      vendorId: r.vendor_profile_id,
      vendorName: vp?.business_name ?? '(unnamed vendor)',
      tier: vp?.tier_state ?? null,
      status: r.status,
      quoted28: r.quoted_28d_php != null ? Number(r.quoted_28d_php) : null,
      summary: summarizeComposition(r.composition),
      updatedAt: r.updated_at,
    };
  });

  const vendors: VendorOption[] = (
    (vendorRes.data ?? []) as Array<{
      vendor_profile_id: string;
      business_name: string | null;
      tier_state: string | null;
    }>
  ).map((v) => ({
    id: v.vendor_profile_id,
    name: v.business_name ?? '(unnamed vendor)',
    tier: v.tier_state ?? null,
  }));

  // Load the selected org's newest non-terminal plan (draft/quoted/pending/active).
  let loadedPlan: LoadedPlan = null;
  if (selectedVendorId) {
    const { data: plan } = await admin
      .from('vendor_custom_plans')
      .select('custom_plan_id, composition, discount_type, discount_value, quoted_28d_php, status')
      .eq('vendor_profile_id', selectedVendorId)
      .in('status', ['draft', 'quoted', 'pending_payment', 'active'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (plan) {
      const row = plan as {
        custom_plan_id: string;
        composition: CustomComposition | null;
        discount_type: 'amount' | 'percent' | null;
        discount_value: number | string | null;
        quoted_28d_php: number | string | null;
        status: string;
      };
      const discount: CustomDiscount | null =
        row.discount_type && row.discount_value != null && Number(row.discount_value) > 0
          ? { type: row.discount_type, value: Number(row.discount_value) }
          : null;
      loadedPlan = {
        planId: row.custom_plan_id,
        composition: (row.composition ?? {}) as CustomComposition,
        discount,
        status: row.status,
        quoted28: row.quoted_28d_php != null ? Number(row.quoted_28d_php) : null,
      };
    }
  }

  return (
    <div>
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Custom plans</h1>
        <p className="max-w-2xl text-sm text-ink/60">
          Compose a negotiated Custom tier for any vendor org — the SETNAYAN
          rate card, scoped to one partner, with a discount and a
          composition-first quote you send for apply-then-pay approval. Unit
          prices are read live from{' '}
          <Link href="/admin/pricing?tab=pricing" className="underline underline-offset-2">
            /admin/pricing
          </Link>
          ; overrides here are per-quote only.
        </p>
      </header>

      {/* Requests inbox — vendors who composed a Custom plan (or a quote we sent
          that's still out). Each row opens the composer scoped to that vendor. */}
      <section className="mb-8" aria-labelledby="custom-requests-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="custom-requests-heading" className="text-sm font-semibold text-ink">
            Custom plan requests
            {requests.length > 0 && (
              <span className="ml-2 rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-medium text-terracotta">
                {requests.length}
              </span>
            )}
          </h2>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
            No open requests. When a vendor composes a Custom plan on their
            subscription page, it appears here for you to review and quote.
          </div>
        ) : (
          <ul className="divide-y divide-ink/8 overflow-hidden rounded-lg border border-ink/10">
            {requests.map((r) => {
              const meta =
                REQUEST_STATUS_META[r.status] ?? {
                  label: r.status,
                  className: 'bg-ink/8 text-ink/70',
                };
              return (
                <li key={r.planId}>
                  <Link
                    href={`/admin/pricing?tab=custom-plans&vendor=${encodeURIComponent(r.vendorId)}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-ink/[0.03]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {r.vendorName}
                        </span>
                        {r.tier && r.tier !== 'custom' && (
                          <span className="shrink-0 text-xs capitalize text-ink/40">
                            now {r.tier}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink/55">{r.summary}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                      {r.quoted28 != null ? `₱${PESO.format(r.quoted28)}` : '—'}
                      <span className="block text-xs font-normal text-ink/45">per 28 days</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink/70">Review →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CustomComposer
        vendors={vendors}
        selectedVendorId={selectedVendorId}
        catalogPrices={catalogPrices}
        loadedPlan={loadedPlan}
      />
    </div>
  );
}
