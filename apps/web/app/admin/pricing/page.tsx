import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { saveAllPricing } from './actions';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';

export const metadata = { title: 'Pricing · Admin' };

/**
 * /admin/pricing — V2 catalog single-form bulk editor.
 *
 * WHY this shape (owner directive 2026-06-18 · "make it easier to insert new
 * prices and just a single update button for all"):
 *   The whole catalog renders as ONE form where every row's price (+ title,
 *   cost, description, active) is an inline input. A single sticky "Save all
 *   changes" button posts the entire catalog to the `saveAllPricing` server
 *   action, which diffs each field and UPDATEs only what changed. No more
 *   per-row Edit → Save → reload round-trips.
 *
 * Canonical V2 tables (per CLAUDE.md 2026-05-28 V2 publisher cutover):
 *   - platform_retail_catalog_v2  (customer SKUs · service_code PK)
 *   - platform_package_catalog    (bundles · package_code PK)
 *   - vendor_billing_catalog      (vendor subs + token packs · sku_code PK)
 *   - platform_settings.setnayan_pay_fee_pct (Setnayan Pay convenience fee)
 *
 * Saves auto-propagate: the action revalidates /pricing + /for-vendors +
 * /admin/pricing (+ payments/vendor-dashboard when the fee changes) so public
 * prices update within seconds. No client JS beyond the SubmitButton spinner.
 *
 * Field-name contract consumed by saveAllPricing:
 *   retail.<field>.<service_code>   field ∈ title|desc|cost|price|active
 *   bundle.<field>.<package_code>   field ∈ title|price|active
 *   vendor.<field>.<sku_code>       field ∈ price|active
 *   setnayan_pay_fee_pct            (singleton)
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
  searchParams: Promise<{ saved?: string; skipped?: string; error?: string }>;
};

const VENDOR_OFFERING_LABEL: Record<VendorRow['offering_type'], string> = {
  subscription_monthly: 'Subscription · monthly',
  subscription_annual: 'Subscription · annual',
  token_pack: 'Token pack',
};

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

// Shared grid templates so each row aligns with its column-header strip.
const RETAIL_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_7.5rem_8.5rem_4.5rem_5rem] md:items-center md:gap-3';
const TWOCOL_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_5rem] md:items-center md:gap-3';

export default async function AdminPricingPage({ searchParams }: Props) {
  const search = await searchParams;
  const savedCount = search.saved != null ? Number(search.saved) : null;
  const skippedCount = search.skipped != null ? Number(search.skipped) : 0;
  const hadError = search.error === '1';

  const admin = createAdminClient();

  // Load all catalog tables + the platform-settings singleton in parallel.
  // Small data volume · no pagination at V1. Each catalog is read in FULL (no
  // is_active filter) so admins can re-activate a retired SKU inline.
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

  // Current Setnayan Pay fee — the DB value when set, else the code constant so
  // the editor always shows the live effective fee. setnayan_pay_fee_pct may be
  // absent in a stale env (column lands in migration 20261225000000).
  const settingsFee = (settingsRes.data as { setnayan_pay_fee_pct?: number | null } | null)
    ?.setnayan_pay_fee_pct;
  const feeIsFromDb = settingsFee != null && Number.isFinite(Number(settingsFee));
  const feePct = feeIsFromDb ? Number(settingsFee) : SETNAYAN_PAY_FEE_PCT;

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
          Edit every price inline, then hit{' '}
          <span className="font-medium text-ink">Save all changes</span> once.
          Saves propagate to{' '}
          <Link href="/pricing" className="underline">
            /pricing
          </Link>{' '}
          and{' '}
          <Link href="/for-vendors" className="underline">
            /for-vendors
          </Link>{' '}
          within seconds.
        </p>
      </header>

      {savedCount !== null && (
        <SaveBanner
          saved={Number.isFinite(savedCount) ? savedCount : 0}
          skipped={Number.isFinite(skippedCount) ? skippedCount : 0}
          hadError={hadError}
        />
      )}

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

      <form action={saveAllPricing}>
        {/* ─── Customer SKUs ─────────────────────────────────────────── */}
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
              <>
                <ColHeader
                  grid={RETAIL_GRID}
                  cols={[
                    { label: 'SKU · title · description', align: 'left' },
                    { label: 'Cost / event', align: 'right' },
                    { label: 'Retail price', align: 'right' },
                    { label: 'Margin', align: 'right' },
                    { label: 'Active', align: 'center' },
                  ]}
                />
                {retailRows.map((row) => (
                  <RetailEditRow
                    key={row.service_code}
                    row={row}
                    editorName={
                      row.updated_by_admin_id
                        ? editorMap.get(row.updated_by_admin_id) ?? 'Unknown'
                        : null
                    }
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ─── Bundles ───────────────────────────────────────────────── */}
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
              <>
                <ColHeader
                  grid={TWOCOL_GRID}
                  cols={[
                    { label: 'Bundle · title', align: 'left' },
                    { label: 'Retail price', align: 'right' },
                    { label: 'Active', align: 'center' },
                  ]}
                />
                {bundleRows.map((row) => (
                  <BundleEditRow
                    key={row.package_code}
                    row={row}
                    editorName={
                      row.updated_by_admin_id
                        ? editorMap.get(row.updated_by_admin_id) ?? 'Unknown'
                        : null
                    }
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ─── Vendor pricing ────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-semibold tracking-tight">
            Vendor pricing ({vendorRows.length})
          </h2>
          <p className="mb-3 text-sm text-ink/60">
            Subscriptions + bidding token packs from{' '}
            <code className="rounded bg-ink/5 px-1 font-mono text-xs">
              vendor_billing_catalog
            </code>
            . Price + active state are editable here; titles, tier caps + token
            grants stay migration-owned.
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/10">
            {vendorRows.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-ink/60">
                  No SKUs in vendor_billing_catalog yet.
                </p>
              </div>
            ) : (
              <>
                <ColHeader
                  grid={TWOCOL_GRID}
                  cols={[
                    { label: 'SKU · offering', align: 'left' },
                    { label: 'Price', align: 'right' },
                    { label: 'Active', align: 'center' },
                  ]}
                />
                {vendorRows.map((row) => (
                  <VendorEditRow key={row.sku_code} row={row} />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ─── Platform fee ──────────────────────────────────────────── */}
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
          <div className="rounded-2xl border border-ink/10 p-4">
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
                className="input-field mt-1 w-full tabular-nums"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                {feeIsFromDb
                  ? 'Set in platform_settings.'
                  : 'Falling back to the code constant — save once to persist it in the DB.'}
              </span>
            </label>
          </div>
        </section>

        {/* ─── Sticky single save bar ───────────────────────────────── */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="max-w-md text-xs text-ink/55">
            Type new prices in any field above, then save them all in one go.
            Only the rows you actually changed get written.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="reset"
              className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5"
            >
              Reset
            </button>
            <SubmitButton
              className="rounded-md bg-terracotta px-5 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta/90"
              pendingLabel="Saving all prices…"
            >
              Save all changes
            </SubmitButton>
          </div>
        </div>
      </form>

      <div className="mt-8 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-5">
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

function SaveBanner({
  saved,
  skipped,
  hadError,
}: {
  saved: number;
  skipped: number;
  hadError: boolean;
}) {
  if (hadError) {
    return (
      <div className="mb-6 rounded-2xl border border-rose-300/60 bg-rose-50/80 p-4">
        <p className="text-sm text-rose-900">
          Something went wrong saving one or more prices — we logged the error.
          Refresh and confirm the values below, then try again.
        </p>
      </div>
    );
  }
  const skippedNote =
    skipped > 0
      ? ` ${skipped} row${skipped === 1 ? ' was' : 's were'} skipped (left unchanged — check for a blank or invalid price).`
      : '';
  if (saved > 0) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 p-4">
        <p className="text-sm text-emerald-900">
          Saved {saved} price change{saved === 1 ? '' : 's'} — now live on
          /pricing and /for-vendors.{skippedNote}
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-2xl border border-ink/15 bg-cream p-4">
      <p className="text-sm text-ink/70">
        No changes to save — everything already matches what&apos;s live.
        {skippedNote}
      </p>
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

/**
 * Desktop-only column-header strip. Mirrors a row's grid template so the
 * labels sit directly above their inputs. Hidden below md — on mobile each
 * field carries its own inline label instead (rows reflow to a single column).
 */
function ColHeader({
  grid,
  cols,
}: {
  grid: string;
  cols: { label: string; align: 'left' | 'right' | 'center' }[];
}) {
  return (
    <div className={`hidden border-b border-ink/10 bg-ink/3 px-4 py-2 ${grid}`}>
      {cols.map((c) => (
        <span
          key={c.label}
          className={`font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 ${
            c.align === 'right'
              ? 'text-right'
              : c.align === 'center'
                ? 'text-center'
                : 'text-left'
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** A labeled number input. The label shows only below md (the desktop column
 *  header covers it on wide screens). */
function NumField({
  name,
  label,
  defaultValue,
  min = '0',
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 md:hidden">
        {label}
      </span>
      <input
        name={name}
        type="number"
        step="0.01"
        min={min}
        defaultValue={defaultValue}
        required={required}
        aria-label={label}
        className="input-field w-full text-right tabular-nums"
      />
    </label>
  );
}

/** Active checkbox. Inline label below md; the desktop column header labels it
 *  on wide screens so the checkbox sits alone, centered. */
function ActiveToggle({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 md:justify-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-ink/30"
      />
      <span className="text-sm text-ink/70 md:hidden">
        Active · visible on public surfaces
      </span>
    </label>
  );
}

function RetailEditRow({
  row,
  editorName,
}: {
  row: RetailRow;
  editorName: string | null;
}) {
  const margin = marginPct(row.retail_price_php, row.saas_overhead_cost_php);
  return (
    <div
      className={`gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 max-md:space-y-3 ${RETAIL_GRID} ${
        row.is_active ? '' : 'bg-ink/3'
      }`}
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
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
        <input
          name={`retail.title.${row.service_code}`}
          defaultValue={row.title}
          required
          aria-label={`${row.service_code} title`}
          className="input-field w-full"
        />
        <input
          name={`retail.desc.${row.service_code}`}
          defaultValue={row.description ?? ''}
          placeholder="Description (optional)"
          aria-label={`${row.service_code} description`}
          className="input-field mt-2 w-full text-sm"
        />
        <p className="mt-1 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
          {editorName ? ` by ${editorName}` : ''}
        </p>
      </div>
      <NumField
        name={`retail.cost.${row.service_code}`}
        label="Cost / event (₱)"
        defaultValue={row.saas_overhead_cost_php}
        required
      />
      <NumField
        name={`retail.price.${row.service_code}`}
        label="Retail price (₱)"
        defaultValue={row.retail_price_php}
        required
      />
      <div className="md:text-right">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 md:hidden">
          Margin
        </span>
        <span className="font-mono text-xs tabular-nums text-ink/70">
          {margin !== null ? `${margin}%` : '—'}
        </span>
      </div>
      <ActiveToggle
        name={`retail.active.${row.service_code}`}
        defaultChecked={row.is_active}
      />
    </div>
  );
}

function BundleEditRow({
  row,
  editorName,
}: {
  row: BundleRow;
  editorName: string | null;
}) {
  return (
    <div
      className={`gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 max-md:space-y-3 ${TWOCOL_GRID} ${
        row.is_active ? '' : 'bg-ink/3'
      }`}
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {row.package_code}
          </code>
          {!row.is_active && (
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              Inactive
            </span>
          )}
        </div>
        <input
          name={`bundle.title.${row.package_code}`}
          defaultValue={row.title}
          required
          aria-label={`${row.package_code} title`}
          className="input-field w-full"
        />
        <p className="mt-1 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
          {editorName ? ` by ${editorName}` : ''}
        </p>
      </div>
      <NumField
        name={`bundle.price.${row.package_code}`}
        label="Retail price (₱)"
        defaultValue={row.retail_price_php}
        required
      />
      <ActiveToggle
        name={`bundle.active.${row.package_code}`}
        defaultChecked={row.is_active}
      />
    </div>
  );
}

function VendorEditRow({ row }: { row: VendorRow }) {
  return (
    <div
      className={`gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 max-md:space-y-3 ${TWOCOL_GRID} ${
        row.is_active ? '' : 'bg-ink/3'
      }`}
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
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
        {/* Title is structural (wires the tier gate) — read-only. */}
        <p className="text-sm font-medium text-ink">{row.title}</p>
        <p className="mt-0.5 text-[11px] text-ink/45">
          Edited {timeAgo(row.updated_at)}
        </p>
      </div>
      <NumField
        name={`vendor.price.${row.sku_code}`}
        label="Price (₱)"
        defaultValue={row.price_php}
        min="0.01"
        required
      />
      <ActiveToggle
        name={`vendor.active.${row.sku_code}`}
        defaultChecked={row.is_active}
      />
    </div>
  );
}
