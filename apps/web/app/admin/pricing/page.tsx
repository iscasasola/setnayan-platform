import Link from 'next/link';
import { Pencil, X } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  updateRetailSku,
  updateBundleSku,
  updateVendorSku,
  updatePlatformFee,
} from './actions';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';

export const metadata = { title: 'Pricing · Admin' };

/**
 * /admin/pricing — V2 catalog read+write surface.
 *
 * WHY this exists (and why it's edit-now, not read-only):
 *   Owner directive 2026-05-30 · admin needs real-time price edits with
 *   auto-propagation to /pricing and /for-vendors. Schema audit columns
 *   shipped in migration 20260713000000 (is_active · created_at · updated_at
 *   · updated_by_admin_id). Edit form posts to updateRetailSku /
 *   updateBundleSku server actions which UPDATE the row + write
 *   admin_audit_log + revalidatePath the 3 consumer surfaces.
 *
 * Replaces the prior V1 reader of public.service_catalog · per CLAUDE.md
 * tenth + eleventh 2026-05-28 rows V2 publisher cutover, the V2 canonical
 * tables are:
 *   - platform_retail_catalog_v2  (20 customer SKUs · service_code PK)
 *   - platform_package_catalog    (2 bundles · package_code PK)
 *
 * Edit-mode UX: URL state ?edit=<code> enters single-row edit mode. All
 * other rows stay read-only. Cancel = Link to /admin/pricing (drops the
 * param). Save submits the form → server action UPDATE + revalidatePath +
 * redirect('/admin/pricing'). No client JS needed.
 *
 * Deferred V1.x (flagged in PR body):
 *   - Two-admin gate on >₱500 deltas (currently console.warn only)
 *   - service_catalog_price_history audit trail (Supabase WAL covers
 *     short-term · full price-history table V1.x)
 *   - /admin/addons V1→V2 migration (still reads V1 service_catalog ·
 *     separate PR)
 */

type RetailRow = {
  service_code: string;
  title: string;
  description: string | null;
  retail_price_php: number;
  saas_overhead_cost_php: number;
  is_token_able: boolean;
  is_active: boolean;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type BundleRow = {
  package_code: string;
  title: string;
  retail_price_php: number;
  is_active: boolean;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type VendorRow = {
  sku_code: string;
  title: string;
  price_php: number;
  offering_type: 'subscription_monthly' | 'subscription_annual' | 'token_pack';
  token_grant_count: number | null;
  is_active: boolean;
  display_order: number;
  updated_at: string;
};

type Props = {
  searchParams: Promise<{ edit?: string }>;
};

const VENDOR_OFFERING_LABEL: Record<VendorRow['offering_type'], string> = {
  subscription_monthly: 'Subscription · monthly',
  subscription_annual: 'Subscription · annual',
  token_pack: 'Token pack',
};

// Sentinel ?edit= value that opens the single-row platform-fee editor. Namespaced
// with __ so it can never collide with a real service_code / package_code /
// sku_code (all of which are bare uppercase / lowercase identifiers).
const PLATFORM_FEE_EDIT_KEY = '__platform_fee__';

function formatPeso(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Margin % = (price − cost) / price × 100, rounded to a whole percent.
 * Returns null when price is 0 (divide-by-zero · FREE SKU) so callers can
 * render an em-dash instead.
 */
function marginPct(price: number, cost: number): number | null {
  if (price <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const y = Math.floor(d / 365);
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

export default async function AdminPricingPage({ searchParams }: Props) {
  const search = await searchParams;
  const editTarget = (search.edit ?? '').trim();

  const admin = createAdminClient();

  // Load all catalog tables + the platform-settings singleton in parallel.
  // Small data volume (~20 retail + 2 bundles + ~8 vendor SKUs · no pagination
  // at V1). The vendor catalog is read in FULL (no is_active filter) so admins
  // can re-activate a retired SKU — same posture as the customer catalog above.
  const [retailRes, bundleRes, vendorRes, settingsRes] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select(
        'service_code,title,description,retail_price_php,saas_overhead_cost_php,is_token_able,is_active,updated_at,updated_by_admin_id',
      )
      .order('is_active', { ascending: false })
      .order('retail_price_php', { ascending: true }),
    admin
      .from('platform_package_catalog')
      .select(
        'package_code,title,retail_price_php,is_active,updated_at,updated_by_admin_id',
      )
      .order('retail_price_php', { ascending: true }),
    admin
      .from('vendor_billing_catalog')
      .select(
        'sku_code,title,price_php,offering_type,token_grant_count,is_active,display_order,updated_at',
      )
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    admin
      .from('platform_settings')
      .select('setnayan_pay_fee_pct')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  if (retailRes.error) {
    logQueryError('AdminPricingPage (platform_retail_catalog_v2)', retailRes.error);
  }
  if (bundleRes.error) {
    logQueryError('AdminPricingPage (platform_package_catalog)', bundleRes.error);
  }
  if (vendorRes.error) {
    logQueryError('AdminPricingPage (vendor_billing_catalog)', vendorRes.error);
  }
  if (settingsRes.error) {
    logQueryError('AdminPricingPage (platform_settings)', settingsRes.error);
  }

  const retailRows = ((retailRes.data ?? []) as RetailRow[]).map((row) => ({
    ...row,
    retail_price_php: Number(row.retail_price_php),
    saas_overhead_cost_php: Number(row.saas_overhead_cost_php),
  }));
  const bundleRows = ((bundleRes.data ?? []) as BundleRow[]).map((row) => ({
    ...row,
    retail_price_php: Number(row.retail_price_php),
  }));
  const vendorRows = ((vendorRes.data ?? []) as VendorRow[]).map((row) => ({
    ...row,
    price_php: Number(row.price_php),
  }));

  // Current Setnayan Pay fee — the DB value when set, else the code constant
  // (lib/vendor-earnings.ts) so the editor always shows the live effective fee
  // even before the column is populated. setnayan_pay_fee_pct may be absent in
  // a stale env (the column lands in migration 20261225000000) — treat that as
  // "unset" and fall back to the constant.
  const settingsFee = (settingsRes.data as { setnayan_pay_fee_pct?: number | null } | null)
    ?.setnayan_pay_fee_pct;
  const feePct =
    settingsFee != null && Number.isFinite(Number(settingsFee))
      ? Number(settingsFee)
      : SETNAYAN_PAY_FEE_PCT;
  const feeIsFromDb = settingsFee != null && Number.isFinite(Number(settingsFee));

  // Resolve last-editor display names in one batch.
  const editorIds = new Set<string>();
  for (const r of retailRows) if (r.updated_by_admin_id) editorIds.add(r.updated_by_admin_id);
  for (const r of bundleRows) if (r.updated_by_admin_id) editorIds.add(r.updated_by_admin_id);
  const editorMap = new Map<string, string>();
  if (editorIds.size > 0) {
    const { data: editors } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', Array.from(editorIds));
    for (const u of editors ?? []) {
      const name =
        (u.display_name as string | null) ??
        (u.email as string | null) ??
        'Unknown';
      editorMap.set(u.user_id as string, name);
    }
  }

  // Stats.
  const activeCount = retailRows.filter((r) => r.is_active).length;
  const inactiveCount = retailRows.length - activeCount;
  const paidRows = retailRows.filter((r) => r.retail_price_php > 0);
  const maxPrice =
    paidRows.length > 0 ? Math.max(...paidRows.map((r) => r.retail_price_php)) : 0;
  const minPrice =
    paidRows.length > 0 ? Math.min(...paidRows.map((r) => r.retail_price_php)) : 0;
  // Average margin across paid SKUs (FREE SKUs have no meaningful margin so
  // they're excluded from the denominator).
  const marginValues = paidRows
    .map((r) => marginPct(r.retail_price_php, r.saas_overhead_cost_php))
    .filter((m): m is number => m !== null);
  const avgMargin =
    marginValues.length > 0
      ? Math.round(
          marginValues.reduce((sum, m) => sum + m, 0) / marginValues.length,
        )
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pricing &amp; Catalog</h1>
        <p className="text-sm text-ink/60">
          Live edit surface for the V2 catalog tables. Saves propagate to{' '}
          <Link href="/pricing" className="underline">
            /pricing
          </Link>{' '}
          and{' '}
          <Link href="/for-vendors" className="underline">
            /for-vendors
          </Link>{' '}
          within seconds of saving.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-paper p-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Active SKUs" value={activeCount.toString()} />
        <Stat label="Inactive" value={inactiveCount.toString()} />
        <Stat
          label="Max price"
          value={maxPrice > 0 ? `₱${formatPeso(maxPrice)}` : '—'}
        />
        <Stat
          label="Min price (paid)"
          value={minPrice > 0 ? `₱${formatPeso(minPrice)}` : '—'}
        />
        <Stat
          label="Avg margin (paid)"
          value={avgMargin !== null ? `${avgMargin}%` : '—'}
        />
      </div>

      {(retailRes.error || bundleRes.error) && (
        <div className="mb-6 rounded-2xl border border-rose-300/60 bg-rose-50/80 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose-900">
            Catalog load error
          </p>
          <p className="mt-1 text-sm text-rose-900">
            The pricing catalog couldn&apos;t load right now. We&apos;ve logged the issue —
            refresh in a moment or check Sentry for the full detail.
          </p>
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold tracking-tight">
          Customer SKUs ({retailRows.length})
        </h2>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {retailRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink/60">
                No SKUs in platform_retail_catalog_v2 yet.
              </p>
            </div>
          ) : (
            retailRows.map((row) => (
              <RetailRowView
                key={row.service_code}
                row={row}
                editMode={editTarget === row.service_code}
                editorName={
                  row.updated_by_admin_id
                    ? editorMap.get(row.updated_by_admin_id) ?? 'Unknown'
                    : null
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold tracking-tight">
          Bundles ({bundleRows.length})
        </h2>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {bundleRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink/60">
                No bundles in platform_package_catalog yet.
              </p>
            </div>
          ) : (
            bundleRows.map((row) => (
              <BundleRowView
                key={row.package_code}
                row={row}
                editMode={editTarget === row.package_code}
                editorName={
                  row.updated_by_admin_id
                    ? editorMap.get(row.updated_by_admin_id) ?? 'Unknown'
                    : null
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Vendor pricing ({vendorRows.length})
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Subscriptions + bidding token packs from{' '}
          <code className="rounded bg-ink/5 px-1 font-mono text-xs">
            vendor_billing_catalog
          </code>
          . Saves propagate to{' '}
          <Link href="/for-vendors" className="underline">
            /for-vendors
          </Link>{' '}
          and{' '}
          <Link href="/pricing" className="underline">
            /pricing
          </Link>{' '}
          (which read{' '}
          <code className="rounded bg-ink/5 px-1 font-mono text-xs">
            getVendorPrices()
          </code>
          ). Price + active state are editable; titles, tier caps + token grants
          stay migration-owned.
        </p>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {vendorRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink/60">
                No SKUs in vendor_billing_catalog yet.
              </p>
            </div>
          ) : (
            vendorRows.map((row) => (
              <VendorRowView
                key={row.sku_code}
                row={row}
                editMode={editTarget === row.sku_code}
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Platform fee
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Setnayan Pay convenience-fee percentage added to a customer invoice
          when they pay a vendor booking through Setnayan. The vendor still
          receives the full booking amount — the fee is the customer&apos;s
          cost.{' '}
          <code className="rounded bg-ink/5 px-1 font-mono text-xs">
            lib/payouts.ts
          </code>{' '}
          +{' '}
          <code className="rounded bg-ink/5 px-1 font-mono text-xs">
            lib/vendor-earnings.ts
          </code>{' '}
          read this with the {SETNAYAN_PAY_FEE_PCT}% code constant as fallback.
        </p>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          <PlatformFeeView
            feePct={feePct}
            feeIsFromDb={feeIsFromDb}
            editMode={editTarget === PLATFORM_FEE_EDIT_KEY}
          />
        </div>
      </section>

      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900">
          Deferred V1.x
        </p>
        <p className="mt-1 text-sm text-amber-900">
          Two-admin approval gate on price deltas above ₱500 logs to console
          only for now · pilot is owner-only-admin so the gate never fires.
          Full price-history audit table lands V1.x.{' '}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs">
            /admin/addons
          </code>{' '}
          still reads the legacy V1 service_catalog · this surface is the
          canonical V2 edit surface.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/5 bg-cream p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function RetailRowView({
  row,
  editMode,
  editorName,
}: {
  row: RetailRow;
  editMode: boolean;
  editorName: string | null;
}) {
  if (editMode) {
    return (
      <form
        action={updateRetailSku}
        className="border-b border-ink/5 bg-cream/50 p-4 last:border-b-0"
      >
        <input type="hidden" name="service_code" value={row.service_code} />
        <div className="mb-3 flex items-center justify-between">
          <code className="font-mono text-xs uppercase tracking-[0.15em] text-ink/60">
            {row.service_code}
          </code>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-1 text-xs text-ink/60 hover:text-ink"
          >
            <X className="h-3 w-3" /> Cancel
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Title
            </span>
            <input
              name="title"
              defaultValue={row.title}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Retail price (₱ · pesos)
            </span>
            <input
              name="retail_price_php"
              type="number"
              step="0.01"
              min="0"
              defaultValue={row.retail_price_php}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Cost / event (₱ · pesos)
            </span>
            <input
              name="saas_overhead_cost_php"
              type="number"
              step="0.01"
              min="0"
              defaultValue={row.saas_overhead_cost_php}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Description (optional)
            </span>
            <textarea
              name="description"
              defaultValue={row.description ?? ''}
              rows={2}
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={row.is_active}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-sm">Active · visible on public surfaces</span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            Save
          </button>
          <Link
            href="/admin/pricing"
            className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-ink/5 p-4 last:border-b-0 ${
        row.is_active ? '' : 'bg-ink/3 opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {row.service_code}
          </code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              Inactive
            </span>
          )}
          {row.is_token_able && (
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">
              Token-worthy
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">{row.title}</p>
        {row.description && (
          <p className="mt-0.5 truncate text-xs text-ink/55">{row.description}</p>
        )}
        <p className="mt-0.5 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
          {editorName ? ` by ${editorName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Cost / event
          </span>
          <p className="font-mono text-xs tabular-nums text-ink/70">
            ₱{formatPeso(row.saas_overhead_cost_php)}
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Margin
          </span>
          <p className="font-mono text-xs tabular-nums text-ink/70">
            {(() => {
              const m = marginPct(row.retail_price_php, row.saas_overhead_cost_php);
              return m !== null ? `${m}%` : '—';
            })()}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          {row.retail_price_php > 0 ? `₱${formatPeso(row.retail_price_php)}` : 'FREE'}
        </span>
        <Link
          href={`/admin/pricing?edit=${encodeURIComponent(row.service_code)}`}
          className="flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      </div>
    </div>
  );
}

function BundleRowView({
  row,
  editMode,
  editorName,
}: {
  row: BundleRow;
  editMode: boolean;
  editorName: string | null;
}) {
  if (editMode) {
    return (
      <form
        action={updateBundleSku}
        className="border-b border-ink/5 bg-cream/50 p-4 last:border-b-0"
      >
        <input type="hidden" name="package_code" value={row.package_code} />
        <div className="mb-3 flex items-center justify-between">
          <code className="font-mono text-xs uppercase tracking-[0.15em] text-ink/60">
            {row.package_code}
          </code>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-1 text-xs text-ink/60 hover:text-ink"
          >
            <X className="h-3 w-3" /> Cancel
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Title
            </span>
            <input
              name="title"
              defaultValue={row.title}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Retail price (₱ · pesos)
            </span>
            <input
              name="retail_price_php"
              type="number"
              step="0.01"
              min="0"
              defaultValue={row.retail_price_php}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={row.is_active}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-sm">Active · visible on public surfaces</span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            Save
          </button>
          <Link
            href="/admin/pricing"
            className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-ink/5 p-4 last:border-b-0 ${
        row.is_active ? '' : 'bg-ink/3 opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {row.package_code}
          </code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">{row.title}</p>
        <p className="mt-0.5 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
          {editorName ? ` by ${editorName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          ₱{formatPeso(row.retail_price_php)}
        </span>
        <Link
          href={`/admin/pricing?edit=${encodeURIComponent(row.package_code)}`}
          className="flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      </div>
    </div>
  );
}

function VendorRowView({
  row,
  editMode,
}: {
  row: VendorRow;
  editMode: boolean;
}) {
  if (editMode) {
    return (
      <form
        action={updateVendorSku}
        className="border-b border-ink/5 bg-cream/50 p-4 last:border-b-0"
      >
        <input type="hidden" name="sku_code" value={row.sku_code} />
        <div className="mb-3 flex items-center justify-between">
          <code className="font-mono text-xs uppercase tracking-[0.15em] text-ink/60">
            {row.sku_code}
          </code>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-1 text-xs text-ink/60 hover:text-ink"
          >
            <X className="h-3 w-3" /> Cancel
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Title is structural (wires the tier gate) — read-only here. */}
          <div className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              SKU
            </span>
            <p className="mt-1 text-sm font-medium text-ink">{row.title}</p>
            <p className="text-xs text-ink/55">
              {VENDOR_OFFERING_LABEL[row.offering_type]}
              {row.token_grant_count
                ? ` · ${row.token_grant_count} tokens`
                : ''}
            </p>
          </div>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Price (₱ · pesos)
            </span>
            <input
              name="price_php"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={row.price_php}
              required
              className="input-field mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={row.is_active}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-sm">Active · visible on public surfaces</span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            Save
          </button>
          <Link
            href="/admin/pricing"
            className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-ink/5 p-4 last:border-b-0 ${
        row.is_active ? '' : 'bg-ink/3 opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {row.sku_code}
          </code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              Inactive
            </span>
          )}
          <span className="rounded bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
            {VENDOR_OFFERING_LABEL[row.offering_type]}
          </span>
          {row.token_grant_count ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">
              {row.token_grant_count} tokens
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">{row.title}</p>
        <p className="mt-0.5 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          ₱{formatPeso(row.price_php)}
        </span>
        <Link
          href={`/admin/pricing?edit=${encodeURIComponent(row.sku_code)}`}
          className="flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      </div>
    </div>
  );
}

function PlatformFeeView({
  feePct,
  feeIsFromDb,
  editMode,
}: {
  feePct: number;
  feeIsFromDb: boolean;
  editMode: boolean;
}) {
  if (editMode) {
    return (
      <form action={updatePlatformFee} className="bg-cream/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <code className="font-mono text-xs uppercase tracking-[0.15em] text-ink/60">
            setnayan_pay_fee_pct
          </code>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-1 text-xs text-ink/60 hover:text-ink"
          >
            <X className="h-3 w-3" /> Cancel
          </Link>
        </div>
        <label className="block max-w-xs">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Setnayan Pay fee (%)
          </span>
          <input
            name="setnayan_pay_fee_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={feePct}
            required
            className="input-field mt-1 w-full"
          />
        </label>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            Save
          </button>
          <Link
            href="/admin/pricing"
            className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            setnayan_pay_fee_pct
          </code>
          {!feeIsFromDb && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              Code default
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium text-ink">
          Setnayan Pay convenience fee
        </p>
        <p className="mt-0.5 text-[11px] text-ink/45">
          {feeIsFromDb
            ? 'Set in platform_settings.'
            : 'Falling back to the code constant — save once to persist it in the DB.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          {feePct}%
        </span>
        <Link
          href={`/admin/pricing?edit=${encodeURIComponent(PLATFORM_FEE_EDIT_KEY)}`}
          className="flex items-center gap-1 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      </div>
    </div>
  );
}
