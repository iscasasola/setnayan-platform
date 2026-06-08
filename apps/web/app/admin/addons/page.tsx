/**
 * Add-on management — admin surface for the canonical SKU + policy state.
 *
 * Spec corpus: iteration 0023 § 3.12 (Add-on Management) · CLAUDE.md
 * 2026-05-17 row 5 lock. The owner-facing rationale: pricing + eligibility
 * + lifetime traction had been spread across `public.service_catalog` +
 * `public.feature_policy` + `public.orders` with no UI; admins were
 * auditing via SQL. This V1 MVP closes that gap as a read-only audit
 * surface. Edit affordances (per-account-type toggle, per-event override,
 * price change with two-admin gate) ship V1.x once the gates are wired.
 *
 * Pattern: mirrors the Finder-column UX from PR #367 (event-home
 * master-detail). Tap a card to expand it inline at the top via
 * `?sku=<sku_code>`. Close to clear.
 *
 * Auth: admin layout already gates access (see app/admin/layout.tsx);
 * this page renders unconditionally because non-admins never reach it.
 */
import { X, Package, Sparkles, Video, Camera, Tv, Film, Music, Type, Globe2, Receipt, ImageDown, Printer, Star, Wrench, BadgeCheck, Megaphone, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCentavosPhp } from '@/lib/sku-catalog';

export const metadata = { title: 'Add-ons · Admin' };

// ---------------------------------------------------------------------------
// Customer-side SKU categories. Anything in service_catalog whose `category`
// is in this set surfaces on the Customer add-ons tab. Vendor-side categories
// (vendor_subscription, vendor_verification, vendor_ads, vendor_tools) belong
// on the Vendor tab which is "Coming soon" in V1.
//
// Source: the seed migrations under supabase/migrations/20260516000000_*,
// 20260516230000_iteration_0017_patiktok.sql, 20260518000000_v1_concierge_*,
// 20260520005000_v1_sku_lock_papic_seat_packs.sql.
//
// Retired 2026-05-28 V2 cutover — the `concierge` category surfaces here as
// historical / retired rows (Concierge ₱2,499 SKU is_active=FALSE). The V2
// replacement (TODAYS_FOCUS ₱1,499 one-time) lives in platform_retail_catalog_v2
// once that view is wired into this admin surface; until then audit happens
// in Supabase Studio. See CLAUDE.md 2026-05-28 V1→V2 cutover decision-log rows.
// ---------------------------------------------------------------------------
const CUSTOMER_CATEGORIES = new Set<string>([
  'couple_addon',
  'panood',
  'papic',
  'patiktok',
  'concierge',
]);

const CATEGORY_DISPLAY: Record<string, string> = {
  couple_addon: 'Couple add-on',
  panood: 'Panood (Live stream)',
  papic: 'Papic (Candid capture)',
  patiktok: 'Patiktok (Reels)',
  // Brand-layer rename 2026-05-28 V2 cutover — "Setnayan Concierge" SKU
  // retired (replaced by ₱1,499 TODAYS_FOCUS one-time). Category key in
  // service_catalog still reads `concierge`; display label aligns with the
  // V2 surface name. Retired SKUs surface here read-only with an Inactive pill.
  concierge: "Setnayan AI",
  vendor_subscription: 'Vendor subscription',
  vendor_verification: 'Vendor verification',
  vendor_ads: 'Vendor ads',
  vendor_tools: 'Vendor tools',
};

// Icon lookup by sku_code prefix or category. Falls back to Package.
// Kept inline-explicit (not derived from a map of regex patterns) so it's
// debuggable at a glance — if a new SKU isn't getting the right icon, the
// answer is here, not in a clever pattern matcher.
function iconForSku(skuCode: string, category: string): LucideIcon {
  if (skuCode.startsWith('save_the_date')) return Video;
  if (skuCode.startsWith('monogram')) return Type;
  if (skuCode.startsWith('pro_widget_schedule')) return Star;
  if (skuCode.startsWith('panood_')) return Tv;
  if (skuCode.startsWith('papic_')) return Camera;
  if (skuCode.startsWith('patiktok_')) return Film;
  if (skuCode.startsWith('concierge')) return Sparkles;
  if (skuCode.startsWith('pakanta')) return Music;
  if (skuCode.startsWith('photo_delivery')) return ImageDown;
  if (skuCode.startsWith('led_')) return Sparkles;
  if (skuCode.startsWith('supplies_') || skuCode.startsWith('paprint')) return Printer;
  if (skuCode.startsWith('landing_')) return Globe2;
  if (skuCode.startsWith('vendor_pro') || skuCode.startsWith('vendor_subscription')) return BadgeCheck;
  if (skuCode.startsWith('vendor_verification')) return BadgeCheck;
  if (skuCode.startsWith('all_tools') || skuCode.startsWith('tool_')) return Wrench;
  if (skuCode.startsWith('boosted_ads') || skuCode.startsWith('sponsored_boost')) return Megaphone;
  if (category === 'panood') return Tv;
  if (category === 'papic') return Camera;
  if (category === 'patiktok') return Film;
  if (category === 'concierge') return Sparkles;
  if (category === 'couple_addon') return Receipt;
  return Package;
}

// Billing chip label from `unit`. service_catalog.unit values today are:
// event · render · day · week · month · quarter · year · each · verification ·
// contract · pack. The chip reads "per X" in lowercase brand voice.
function billingLabel(unit: string, multiPurchase: boolean): string {
  switch (unit) {
    case 'event':
      return 'per event';
    case 'render':
      return 'per render';
    case 'day':
      return 'per day';
    case 'week':
      return 'per week';
    case 'month':
      return 'per month';
    case 'quarter':
      return 'per quarter';
    case 'year':
      return 'per year';
    case 'each':
      return multiPurchase ? 'per pack' : 'each';
    case 'pack':
      return 'per pack';
    case 'verification':
      return 'per verification';
    case 'contract':
      return 'per contract';
    default:
      return unit;
  }
}

type ServiceCatalogRow = {
  sku_code: string;
  display_name: string;
  description: string | null;
  category: string;
  price_centavos: number;
  unit: string;
  multi_purchase: boolean;
  subscription: boolean;
  purchaser_role: 'couple' | 'vendor' | 'either';
  is_active: boolean;
  launch_promo_until: string | null;
};

type FeaturePolicyRow = {
  feature_key: string;
  enabled_for_couples: boolean;
  enabled_for_vendors_coming_soon: boolean;
  enabled_for_vendors_certified: boolean;
  block_reason_couples: string | null;
  block_reason_vendors_coming_soon: string | null;
  block_reason_vendors_certified: string | null;
};

type Props = {
  searchParams: Promise<{ sku?: string; tab?: string }>;
};

export default async function AdminAddonsPage({ searchParams }: Props) {
  const search = await searchParams;
  const selectedSku = (search.sku ?? '').trim() || null;
  const tab: 'customer' | 'vendor' = search.tab === 'vendor' ? 'vendor' : 'customer';

  const admin = createAdminClient();

  // Pull every SKU once, partition client-side. Catalog is ~30-40 rows so
  // one round trip is cheaper than per-tab filtering at the DB layer.
  const { data: catalogData, error: catalogError } = await admin
    .from('service_catalog')
    .select(
      'sku_code,display_name,description,category,price_centavos,unit,multi_purchase,subscription,purchaser_role,is_active,launch_promo_until',
    )
    .order('category', { ascending: true })
    .order('sku_code', { ascending: true });

  if (catalogError) {
    logQueryError('AdminAddonsPage (service_catalog)', catalogError);
  }

  const rows = (catalogData ?? []) as ServiceCatalogRow[];

  // Customer SKUs: category in CUSTOMER_CATEGORIES + purchaser_role excludes
  // vendor-only. We keep `either` because a SKU like a render add-on might be
  // listed as available to either side.
  const customerRows = rows.filter(
    (r) =>
      CUSTOMER_CATEGORIES.has(r.category) && r.purchaser_role !== 'vendor',
  );

  // Feature policy lookup keyed by feature_key. Spec convention is that
  // feature_key matches the SKU's sku_code where applicable; if no policy
  // row exists we render the eligibility dots as hollow with a "No policy
  // set" tooltip so admins notice the gap.
  const skuCodes = rows.map((r) => r.sku_code);
  const { data: policyData } = await admin
    .from('feature_policy')
    .select(
      'feature_key,enabled_for_couples,enabled_for_vendors_coming_soon,enabled_for_vendors_certified,block_reason_couples,block_reason_vendors_coming_soon,block_reason_vendors_certified',
    )
    .in('feature_key', skuCodes.length > 0 ? skuCodes : ['__none__']);

  const policyBySku = new Map<string, FeaturePolicyRow>();
  (policyData ?? []).forEach((p) =>
    policyBySku.set(p.feature_key, p as FeaturePolicyRow),
  );

  // Lifetime purchase counts grouped by service_key. We count any order in
  // `paid` or `fulfilled` because both states represent money-in-the-door
  // from the host's side (cancelled / refunded do NOT count). Pull all paid
  // orders, group in memory — catalog is small so a single fetch is fine.
  const { data: orderData } = await admin
    .from('orders')
    .select('service_key,status')
    .in('status', ['paid', 'fulfilled']);

  const purchaseCountBySku = new Map<string, number>();
  (orderData ?? []).forEach((o) => {
    const key = (o.service_key ?? '').trim();
    if (!key) return;
    purchaseCountBySku.set(key, (purchaseCountBySku.get(key) ?? 0) + 1);
  });

  const visibleRows = tab === 'customer' ? customerRows : []; // vendor tab is "Coming soon" V1
  const selectedRow = selectedSku
    ? visibleRows.find((r) => r.sku_code === selectedSku) ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="m-eyebrow text-[color:var(--m-orange-2)]">
            Iteration 0023 · § 3.12
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Add-on management
          </h1>
          <p className="max-w-2xl text-sm text-ink/65">
            Every Setnayan service you sell · grouped by where customers find
            them. Read-only audit surface. The V2 catalog (
            <code className="mx-0.5 font-mono text-[11px]">platform_retail_catalog_v2</code>
            ) is being wired in as the canonical source — until then this view
            reads the legacy <code className="mx-0.5 font-mono text-[11px]">service_catalog</code>
            so admins can audit retired SKUs alongside active ones.
          </p>
        </div>
        <a
          href="/admin/addons/pricing-report"
          className="button-secondary self-start whitespace-nowrap sm:self-end"
          download
        >
          Download pricing report
        </a>
      </header>

      {catalogError ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Add-ons couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </p>
      ) : null}

      {/*
        Tab nav — Vendor add-ons tab gated behind
        NEXT_PUBLIC_VENDOR_ADDONS_ENABLED per Phase 3 Nav lock + CLAUDE.md
        2026-05-28 14th row § 6 V1.x list (Add-on Management Vendor tab
        deferred). When the flag is unset (V1 default), we render just the
        Customer add-ons tab — no dead "Coming soon" affordance per
        [[feedback_setnayan_no_dev_text_post_launch]]. When the flag is
        '1' (V1.x post-launch), the Vendor tab surfaces — and the Vendor
        grid implementation lands in the same PR.
      */}
      <nav
        aria-label="Add-on tabs"
        className="mb-6 flex flex-wrap gap-2 border-b border-ink/10 pb-2"
      >
        <TabLink
          href={`/admin/addons${selectedSku ? `?sku=${encodeURIComponent(selectedSku)}` : ''}`}
          label="Customer add-ons"
          active={tab === 'customer'}
        />
        {process.env.NEXT_PUBLIC_VENDOR_ADDONS_ENABLED === '1' ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/45">
            Vendor add-ons
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Coming soon
            </span>
          </span>
        ) : null}
      </nav>

      {tab === 'customer' && selectedRow ? (
        <ExpandedCard
          row={selectedRow}
          policy={policyBySku.get(selectedRow.sku_code) ?? null}
          purchaseCount={purchaseCountBySku.get(selectedRow.sku_code) ?? 0}
        />
      ) : null}

      {tab === 'customer' ? (
        <CustomerGrid
          rows={visibleRows}
          selectedSku={selectedSku}
          policyBySku={policyBySku}
          purchaseCountBySku={purchaseCountBySku}
        />
      ) : null}
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-ink px-3 py-1 text-sm text-cream'
          : 'rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/70 hover:bg-ink/10 hover:text-ink'
      }
    >
      {label}
    </Link>
  );
}

function CustomerGrid({
  rows,
  selectedSku,
  policyBySku,
  purchaseCountBySku,
}: {
  rows: ServiceCatalogRow[];
  selectedSku: string | null;
  policyBySku: Map<string, FeaturePolicyRow>;
  purchaseCountBySku: Map<string, number>;
}) {
  if (rows.length === 0) {
    return (
      // Per CLAUDE.md 2026-05-23 5-sweep audit (Sweep 5) — polite brand voice,
      // no schema jargon (`service_catalog` + `supabase/migrations/`) leaking
      // into the admin empty-state surface.
      <div className="rounded-xl border border-dashed border-ink/15 bg-cream/40 p-10 text-center text-sm text-ink/60">
        No customer add-ons surfaced yet. Once active SKUs land, they appear
        here grouped by category.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <CardLink
          key={row.sku_code}
          row={row}
          isSelected={row.sku_code === selectedSku}
          policy={policyBySku.get(row.sku_code) ?? null}
          purchaseCount={purchaseCountBySku.get(row.sku_code) ?? 0}
        />
      ))}
    </div>
  );
}

function CardLink({
  row,
  isSelected,
  policy,
  purchaseCount,
}: {
  row: ServiceCatalogRow;
  isSelected: boolean;
  policy: FeaturePolicyRow | null;
  purchaseCount: number;
}) {
  const Icon = iconForSku(row.sku_code, row.category);
  // ?sku= toggles: click an unselected card to set it, click the same card
  // again to clear it. Matches the event-home Finder-column pattern (PR #367)
  // but uses a plain <Link> since we don't need to short-circuit on inner
  // interactive elements (admin cards are non-interactive previews).
  const href = isSelected ? '/admin/addons' : `/admin/addons?sku=${encodeURIComponent(row.sku_code)}`;
  const promoActive = !!row.launch_promo_until && new Date(row.launch_promo_until) > new Date();

  return (
    <Link
      href={href}
      scroll={false}
      className={`group flex h-full flex-col gap-3 rounded-xl border bg-cream p-4 transition-shadow ${
        isSelected
          ? 'border-terracotta/50 ring-2 ring-terracotta/35 ring-offset-2 ring-offset-cream'
          : 'border-ink/10 hover:border-ink/25 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink">
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight text-ink">
              {row.display_name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              {row.sku_code}
            </p>
          </div>
        </div>
        <StatusPills row={row} promoActive={promoActive} />
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold text-ink">
          {formatCentavosPhp(row.price_centavos)}
        </span>
        <span className="text-xs text-ink/60">{billingLabel(row.unit, row.multi_purchase)}</span>
      </div>

      <p className="text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {CATEGORY_DISPLAY[row.category] ?? row.category}
      </p>

      <div className="mt-auto flex items-center justify-between border-t border-ink/10 pt-3 text-xs text-ink/60">
        <span>
          {purchaseCount === 0 ? 'No purchases yet' : `${purchaseCount.toLocaleString('en-PH')} purchase${purchaseCount === 1 ? '' : 's'}`}
        </span>
        <EligibilityDots policy={policy} />
      </div>
    </Link>
  );
}

function StatusPills({
  row,
  promoActive,
}: {
  row: ServiceCatalogRow;
  promoActive: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {!row.is_active ? (
        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Inactive
        </span>
      ) : (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-700">
          Active
        </span>
      )}
      {/* Legacy `launch_promo_until` flag — the V1 16-SKU free-through window
          retired 2026-05-28 V2 cutover (replaced by 100 complimentary vendor
          tokens on verification). Pill kept read-only when rows still carry
          historical promo timestamps so admins can audit the legacy data. */}
      {promoActive ? (
        <span
          className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink/55"
          title="Legacy launch-promo flag (retired V2)"
        >
          Legacy promo
        </span>
      ) : null}
    </div>
  );
}

// Three dots: Couples ● Coming-soon vendors ● Verified vendors.
// Filled = enabled in feature_policy. Hollow = disabled OR no policy row.
// We use distinct fills (ink + amber + emerald) so a colour-blind reviewer
// can still distinguish the audiences at a glance.
function EligibilityDots({ policy }: { policy: FeaturePolicyRow | null }) {
  const noPolicy = policy === null;
  const couplesOn = policy?.enabled_for_couples === true;
  const comingOn = policy?.enabled_for_vendors_coming_soon === true;
  const certifiedOn = policy?.enabled_for_vendors_certified === true;

  return (
    <span
      className="inline-flex items-center gap-1"
      title={
        noPolicy
          ? 'No policy set — feature_policy row missing for this SKU'
          : `Couples ${couplesOn ? 'on' : 'off'} · Coming-soon vendors ${comingOn ? 'on' : 'off'} · Verified vendors ${certifiedOn ? 'on' : 'off'}`
      }
      aria-label={
        noPolicy
          ? 'No policy set'
          : `Eligibility · Couples ${couplesOn ? 'enabled' : 'disabled'} · Coming-soon vendors ${comingOn ? 'enabled' : 'disabled'} · Verified vendors ${certifiedOn ? 'enabled' : 'disabled'}`
      }
    >
      <Dot filled={!noPolicy && couplesOn} tone="ink" />
      <Dot filled={!noPolicy && comingOn} tone="amber" />
      <Dot filled={!noPolicy && certifiedOn} tone="emerald" />
    </span>
  );
}

function Dot({
  filled,
  tone,
}: {
  filled: boolean;
  tone: 'ink' | 'amber' | 'emerald';
}) {
  const fillClass = filled
    ? tone === 'ink'
      ? 'bg-ink'
      : tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-emerald-600'
    : 'bg-transparent';
  const borderClass =
    tone === 'ink'
      ? 'border-ink/45'
      : tone === 'amber'
        ? 'border-amber-500/60'
        : 'border-emerald-600/55';
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full border ${borderClass} ${fillClass}`}
    />
  );
}

function ExpandedCard({
  row,
  policy,
  purchaseCount,
}: {
  row: ServiceCatalogRow;
  policy: FeaturePolicyRow | null;
  purchaseCount: number;
}) {
  const Icon = iconForSku(row.sku_code, row.category);
  const promoActive = !!row.launch_promo_until && new Date(row.launch_promo_until) > new Date();

  return (
    <section
      aria-labelledby="addon-expanded-heading"
      className="mb-6 rounded-2xl border border-terracotta/40 bg-cream p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink">
            <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              {CATEGORY_DISPLAY[row.category] ?? row.category}
            </p>
            <h2
              id="addon-expanded-heading"
              className="mt-1 text-xl font-semibold leading-tight text-ink"
            >
              {row.display_name}
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {row.sku_code}
            </p>
            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink">
                {formatCentavosPhp(row.price_centavos)}
              </span>
              <span className="text-sm text-ink/65">
                {billingLabel(row.unit, row.multi_purchase)}
              </span>
              {promoActive ? (
                <span
                  className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink/55"
                  title="Legacy launch-promo flag (retired V2)"
                >
                  Legacy promo · expires {new Date(row.launch_promo_until!).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Link
          href="/admin/addons"
          scroll={false}
          aria-label="Close expanded card"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {row.description ? (
        <p className="mt-4 max-w-3xl text-sm text-ink/75">{row.description}</p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Lifetime purchases" value={purchaseCount === 0 ? '—' : purchaseCount.toLocaleString('en-PH')} hint="Orders in paid or fulfilled" />
        <Stat label="Active" value={row.is_active ? 'Yes' : 'No'} hint={row.is_active ? 'is_active = TRUE' : 'is_active = FALSE'} />
        <Stat label="Multi-purchase" value={row.multi_purchase ? 'Yes' : 'No'} hint={row.subscription ? 'Subscription' : 'One-time'} />
      </div>

      <EligibilityDetail policy={policy} skuCode={row.sku_code} />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/60 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink/55">{hint}</p> : null}
    </div>
  );
}

function EligibilityDetail({
  policy,
  skuCode,
}: {
  policy: FeaturePolicyRow | null;
  skuCode: string;
}) {
  if (policy === null) {
    return (
      // Per CLAUDE.md 2026-05-23 5-sweep audit (Sweep 5) — polite brand voice,
      // no `feature_policy` schema name in admin-facing copy.
      <div className="mt-5 rounded-lg border border-amber-300/60 bg-amber-50/80 p-4">
        <p className="text-sm font-medium text-amber-900">No policy set</p>
        <p className="mt-1 text-sm text-amber-900/85">
          No eligibility policy is set for this SKU yet. By default it&apos;s
          purchasable across all account types. Seed a policy when you want to
          lock it down.
        </p>
      </div>
    );
  }

  const rows: Array<{
    label: string;
    enabled: boolean;
    reason: string | null;
  }> = [
    { label: 'Couples', enabled: policy.enabled_for_couples, reason: policy.block_reason_couples },
    { label: 'Coming-soon vendors', enabled: policy.enabled_for_vendors_coming_soon, reason: policy.block_reason_vendors_coming_soon },
    { label: 'Verified vendors', enabled: policy.enabled_for_vendors_certified, reason: policy.block_reason_vendors_certified },
  ];

  return (
    <div className="mt-5 rounded-lg border border-ink/10 bg-cream/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        Eligibility
      </p>
      <ul className="mt-2 divide-y divide-ink/10">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-start justify-between gap-3 py-2"
          >
            <div>
              <p className="text-sm text-ink">{r.label}</p>
              {r.enabled === false && r.reason ? (
                <p className="mt-0.5 text-xs text-ink/55">{r.reason}</p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                r.enabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-ink/10 text-ink/60'
              }`}
            >
              {r.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
