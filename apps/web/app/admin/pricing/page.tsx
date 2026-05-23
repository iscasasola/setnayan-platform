import { Search, Tag, Calendar, Sparkles } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatCentavosPhp,
  formatPromoEndDateShort,
  type SkuUnit,
  type SkuPurchaserRole,
} from '@/lib/sku-catalog';

export const metadata = { title: 'Pricing · Admin' };

/**
 * Read-only catalog view of `public.service_catalog`.
 *
 * WHY this exists (and why it's read-only at V1):
 *   Pricing edits today go through Supabase Studio as raw SQL — service-role
 *   updates against `service_catalog` (per CLAUDE.md 2026-05-17 "Specialized
 *   Pro Tools" + iteration 0023 § 3.5). That's safe (every change is logged
 *   by Postgres + can be replayed from migrations) but admins had to open a
 *   second tool to even SEE the current price ladder. This surface gives
 *   them one-click visibility into every SKU + its active/promo state
 *   without leaving the admin shell.
 *
 *   Edit form lands V1.x once `service_catalog_price_history` audit table
 *   + the two-admin approval gate (per § 9.1) are wired. Mirrors the
 *   `/admin/settings/payment-methods` pattern — read-mostly with an honest
 *   banner about where edits live today.
 *
 * Schema notes (real columns, NOT the brief's `time_recurrence` /
 * `event_scope` framing — those were spec shorthand for the actual `unit`
 * enum + `subscription` boolean that exist in 20260516000000_v1_sku_lock_*):
 *   - sku_code (PK) · display_name · category · price_centavos
 *   - unit ∈ event / render / day / week / month / quarter / year / each /
 *     verification / contract
 *   - subscription BOOLEAN — true = auto-renews on cadence; false = one-shot
 *   - multi_purchase · refundable · purchaser_role · soft_cap
 *   - is_active · launch_promo_until (nullable; non-null + future ⇒ FREE
 *     during the promo window per 2026-05-18 lock)
 *
 * Mirrors entry-point + filter-strip pattern from `/admin/users` and
 * read-only-banner pattern from `/admin/settings/payment-methods`.
 */

type ServiceCatalogRow = {
  sku_code: string;
  display_name: string;
  description: string | null;
  category: string;
  price_centavos: number;
  unit: SkuUnit;
  multi_purchase: boolean;
  subscription: boolean;
  refundable: boolean;
  purchaser_role: SkuPurchaserRole;
  soft_cap: number | null;
  is_active: boolean;
  launch_promo_until: string | null;
  effective_at: string;
  retired_at: string | null;
  updated_at: string;
};

type ActiveFilter = 'all' | 'active' | 'inactive';

type Props = {
  searchParams: Promise<{
    category?: string;
    active?: string;
    billing?: string | string[];
  }>;
};

// Subset of `service_catalog.unit` values we treat as billing cadences for
// the filter strip. The other unit values (event, render, each, verification,
// contract) describe what the SKU buys per purchase rather than a recurring
// billing cadence — keeping them out of the cadence filter keeps the picker
// honest.
const BILLING_CADENCES: ReadonlyArray<SkuUnit> = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
];

const UNIT_LABEL: Record<SkuUnit, string> = {
  event: 'per event',
  render: 'per render',
  day: 'per day',
  week: 'per week',
  month: 'per month',
  quarter: 'per quarter',
  year: 'per year',
  each: 'each',
  verification: 'per verification',
  contract: 'per contract',
};

const PURCHASER_ROLE_LABEL: Record<SkuPurchaserRole, string> = {
  couple: 'Couple',
  vendor: 'Vendor',
  either: 'Either',
};

export default async function AdminPricingPage({ searchParams }: Props) {
  const search = await searchParams;
  const categoryFilter = (search.category ?? '').trim();
  const activeFilter = (search.active ?? 'all') as ActiveFilter;
  // billing= can come in as multiple repeated params (Next.js parses repeated
  // search params into an array). Coerce to a Set for membership checks and
  // pass back to the form for default-state preservation.
  const billingRaw = search.billing ?? [];
  const billingSelected = new Set<string>(
    Array.isArray(billingRaw) ? billingRaw : [billingRaw],
  );

  const admin = createAdminClient();

  // Pull the full catalog. Volume is small (~30 SKUs as of 2026-05-22 + room
  // to grow into the ~14-SKU Specialized Pro Tools portfolio per CLAUDE.md
  // 2026-05-17 row). No pagination at V1 — the table fits on one screen.
  let query = admin
    .from('service_catalog')
    .select(
      'sku_code,display_name,description,category,price_centavos,unit,multi_purchase,subscription,refundable,purchaser_role,soft_cap,is_active,launch_promo_until,effective_at,retired_at,updated_at',
    )
    .order('category', { ascending: true })
    .order('sku_code', { ascending: true });

  if (categoryFilter) query = query.eq('category', categoryFilter);
  if (activeFilter === 'active') query = query.eq('is_active', true);
  if (activeFilter === 'inactive') query = query.eq('is_active', false);

  const { data, error } = await query;
  const rows = ((data ?? []) as ServiceCatalogRow[]).filter((row) => {
    if (billingSelected.size === 0) return true;
    return billingSelected.has(row.unit);
  });

  // Build category dropdown options from the underlying table so new
  // categories (e.g. when Specialized Pro Tools adds 14 new SKUs) appear
  // automatically without code edits. Cheap second query — categories list
  // is short.
  const { data: categoryRows } = await admin
    .from('service_catalog')
    .select('category')
    .order('category', { ascending: true });
  const categories = Array.from(
    new Set((categoryRows ?? []).map((r) => (r as { category: string }).category)),
  );

  // Stats banner — computed across the unfiltered table so admins always see
  // the whole-catalog totals regardless of which filters they have on. The
  // "active only" highest/lowest matches what couples + vendors actually see
  // — retired SKUs in the corner shouldn't pull the price range numbers.
  const { data: allRows } = await admin
    .from('service_catalog')
    .select('price_centavos,is_active,launch_promo_until');
  const allTyped =
    ((allRows ?? []) as Array<
      Pick<ServiceCatalogRow, 'price_centavos' | 'is_active' | 'launch_promo_until'>
    >);
  const now = new Date();
  const activeCount = allTyped.filter((r) => r.is_active).length;
  const inactiveCount = allTyped.length - activeCount;
  const promoCount = allTyped.filter(
    (r) =>
      r.launch_promo_until !== null &&
      new Date(r.launch_promo_until) > now,
  ).length;
  const activePrices = allTyped
    .filter((r) => r.is_active)
    .map((r) => r.price_centavos);
  const maxPrice = activePrices.length ? Math.max(...activePrices) : 0;
  const minPrice = activePrices.length ? Math.min(...activePrices) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Pricing & Catalog</h1>
        </div>
        <p className="text-sm text-ink/65">
          Every SKU in <code className="font-mono text-[11px]">service_catalog</code>{' '}
          — what we charge for, who it&apos;s for, and whether it&apos;s currently
          on the launch promo through {formatPromoEndDateShort()}.
        </p>
        <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Read-only V1.</span> Edit flow is
          deferred until the price-history audit + two-admin approval gate
          ship. To change a price today, run a service-role SQL update against{' '}
          <code className="mx-1 font-mono text-[11px]">service_catalog</code>
          in Supabase Studio — the change is live everywhere on next page load.
        </p>
      </header>

      {/* Stats banner — same row of metric pills as `/admin/operations-hiring`
          uses, but tuned to the pricing-catalog read. Numbers reflect the
          whole table, not just the currently-filtered view, so admins can
          spot anomalies (e.g. "promo count just dropped") at a glance. */}
      <section
        aria-label="Catalog summary"
        // Per CLAUDE.md 2026-05-23 5-sweep audit (Sweep 5) — 5 pills at 640px
        // cramped (₱799,999 truncated). Stage through 3 cols at sm: before
        // the full 5-col layout at lg:.
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatPill label="Active" value={activeCount} />
        <StatPill label="Inactive" value={inactiveCount} />
        <StatPill label="On promo" value={promoCount} icon={<Sparkles className="h-3 w-3" strokeWidth={2} />} />
        <StatPill
          label="Highest price"
          value={maxPrice ? formatCentavosPhp(maxPrice) : '—'}
        />
        <StatPill
          label="Lowest price"
          value={minPrice ? formatCentavosPhp(minPrice) : '—'}
        />
      </section>

      {/* Filter strip — uses URL params (`?category=...&active=...&billing=...`)
          so admins can bookmark + share specific cuts. Same get-form pattern
          as `/admin/users`. */}
      <form className="mb-4 flex flex-col gap-3" method="get">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
              strokeWidth={1.75}
            />
            <select
              name="category"
              defaultValue={categoryFilter}
              className="input-field pl-9"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <select
            name="active"
            defaultValue={activeFilter}
            className="input-field min-w-[12rem]"
            aria-label="Active status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button type="submit" className="button-secondary">
            Apply
          </button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-2 rounded-md border border-ink/10 bg-cream px-3 py-2">
          <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <Calendar
              aria-hidden
              className="mr-1 inline h-3 w-3 align-text-bottom"
              strokeWidth={1.75}
            />
            Billing cadence
          </legend>
          {BILLING_CADENCES.map((cadence) => (
            <label
              key={cadence}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70 hover:bg-ink/10 has-[:checked]:bg-terracotta/15 has-[:checked]:text-terracotta-700"
            >
              <input
                type="checkbox"
                name="billing"
                value={cadence}
                defaultChecked={billingSelected.has(cadence)}
                className="h-3 w-3 accent-terracotta"
              />
              {UNIT_LABEL[cadence]}
            </label>
          ))}
        </fieldset>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Could not load catalog: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          No SKUs match these filters. Clear filters above to see the whole
          catalog.
        </p>
      ) : (
        <CatalogTable rows={rows} now={now} />
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · iteration 0023 § 3.5 · CLAUDE.md 2026-05-17 (Specialized Pro
        Tools) · table <code>service_catalog</code>
      </p>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-cream px-3 py-2">
      <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function CatalogTable({
  rows,
  now,
}: {
  rows: ServiceCatalogRow[];
  now: Date;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
      <table className="min-w-full divide-y divide-ink/10 text-sm">
        <thead className="bg-ink/5">
          <tr>
            <Th>SKU</Th>
            <Th>Category</Th>
            <Th className="text-right">Price</Th>
            <Th>Billing</Th>
            <Th>Buyer</Th>
            <Th>Status</Th>
            <Th>Promo</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {rows.map((sku) => {
            const onPromo =
              sku.launch_promo_until !== null &&
              new Date(sku.launch_promo_until) > now;
            return (
              <tr
                key={sku.sku_code}
                className={sku.is_active ? '' : 'opacity-55'}
              >
                <td className="px-3 py-3">
                  <div className="font-medium text-ink">{sku.display_name}</div>
                  <div className="font-mono text-[11px] text-ink/55">
                    {sku.sku_code}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-ink/70">{sku.category}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-ink">
                  {sku.price_centavos === 0 ? (
                    <span className="text-emerald-700">FREE</span>
                  ) : (
                    formatCentavosPhp(sku.price_centavos)
                  )}
                </td>
                <td className="px-3 py-3">
                  <BillingChip unit={sku.unit} subscription={sku.subscription} />
                </td>
                <td className="px-3 py-3 text-xs text-ink/70">
                  {PURCHASER_ROLE_LABEL[sku.purchaser_role]}
                </td>
                <td className="px-3 py-3 text-xs">
                  {sku.is_active ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 font-medium text-ink/55">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  {onPromo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                      <Sparkles className="h-3 w-3" strokeWidth={2} />
                      FREE on launch
                    </span>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        'px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 ' +
        className
      }
    >
      {children}
    </th>
  );
}

function BillingChip({
  unit,
  subscription,
}: {
  unit: SkuUnit;
  subscription: boolean;
}) {
  // Subscription SKUs auto-renew on the cadence in `unit` (week/month/etc.).
  // One-shot SKUs charge once per unit (per event, per render, etc.). The
  // distinction matters for budgeting + admin reconciliation — surface it
  // visually so the admin doesn't have to read two columns to know whether
  // a "per week" SKU rolls forward automatically.
  if (subscription) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
        ↻ {UNIT_LABEL[unit]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/70">
      {UNIT_LABEL[unit]}
    </span>
  );
}
