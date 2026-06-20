import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { saveAllPricing, createBundle } from './actions';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';
import {
  RetailRowEditor,
  BundleRowEditor,
  VendorRowEditor,
} from './_components/catalog-editor';
import { RETAIL_GRID, TWOCOL_GRID } from './_components/grids';

export const metadata = { title: 'Pricing · Admin' };

/**
 * /admin/pricing — V2 catalog single-form bulk editor + bundle creator.
 *
 * The whole catalog renders as ONE form where every row's price (+ title,
 * cost, description, active) is inline. A single "Save all changes" posts to
 * `saveAllPricing` which diffs each field and UPDATEs only what changed.
 *
 * Owner additions 2026-06-18:
 *   - Each row has a ⓘ "What this is for" panel (editable description) so codes
 *     like PANOOD / GUIDED_PACK are self-explanatory (client rows in
 *     _components/catalog-editor.tsx). Bundle + vendor descriptions land in the
 *     description columns added by migration 20270124000000.
 *   - A "Create a bundle" card (its own form → `createBundle`) inserts a new
 *     platform_package_catalog row from a name + price.
 *
 * This surface is the single source of truth for app prices: saves revalidate
 * /pricing + /for-vendors so public prices update within seconds.
 *
 * Canonical V2 tables: platform_retail_catalog_v2 · platform_package_catalog ·
 * vendor_billing_catalog · platform_settings.setnayan_pay_fee_pct.
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
  description: string | null;
  retail_price_php: number;
  is_active: boolean;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type VendorRow = {
  sku_code: string;
  title: string;
  description: string | null;
  price_php: number;
  offering_type: 'subscription_monthly' | 'subscription_annual' | 'token_pack';
  token_grant_count: number | null;
  is_active: boolean;
  display_order: number;
  updated_at: string;
};

type Props = {
  searchParams: Promise<{
    saved?: string;
    skipped?: string;
    error?: string;
    created?: string;
    createError?: string;
  }>;
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
  const savedCount = search.saved != null ? Number(search.saved) : null;
  const skippedCount = search.skipped != null ? Number(search.skipped) : 0;
  const hadError = search.error === '1';
  const createdCode = search.created ?? null;
  const createError = search.createError ?? null;

  const admin = createAdminClient();

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
        'package_code,title,description,retail_price_php,is_active,updated_at,updated_by_admin_id',
      )
      .order('retail_price_php', { ascending: true }),
    admin
      .from('vendor_billing_catalog')
      .select(
        'sku_code,title,description,price_php,offering_type,token_grant_count,is_active,display_order,updated_at',
      )
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    admin
      .from('platform_settings')
      .select('setnayan_pay_fee_pct')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  if (retailRes.error) logQueryError('AdminPricingPage (retail)', retailRes.error);
  if (bundleRes.error) logQueryError('AdminPricingPage (bundle)', bundleRes.error);
  if (vendorRes.error) logQueryError('AdminPricingPage (vendor)', vendorRes.error);
  if (settingsRes.error) logQueryError('AdminPricingPage (settings)', settingsRes.error);

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

  const settingsFee = (settingsRes.data as { setnayan_pay_fee_pct?: number | null } | null)
    ?.setnayan_pay_fee_pct;
  const feeIsFromDb = settingsFee != null && Number.isFinite(Number(settingsFee));
  const feePct = feeIsFromDb ? Number(settingsFee) : SETNAYAN_PAY_FEE_PCT;

  // Last-editor display names, resolved in one batch.
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
        (u.display_name as string | null) ?? (u.email as string | null) ?? 'Unknown';
      editorMap.set(u.user_id as string, name);
    }
  }
  const editedStr = (iso: string, byId: string | null) => {
    const by = byId ? editorMap.get(byId) ?? 'Unknown' : null;
    return `${timeAgo(iso)}${by ? ` by ${by}` : ''}`;
  };

  // Stats.
  const activeCount = retailRows.filter((r) => r.is_active).length;
  const inactiveCount = retailRows.length - activeCount;
  const paidRows = retailRows.filter((r) => r.retail_price_php > 0);
  const maxPrice = paidRows.length > 0 ? Math.max(...paidRows.map((r) => r.retail_price_php)) : 0;
  const minPrice = paidRows.length > 0 ? Math.min(...paidRows.map((r) => r.retail_price_php)) : 0;
  const marginValues = paidRows
    .map((r) => marginPct(r.retail_price_php, r.saas_overhead_cost_php))
    .filter((m): m is number => m !== null);
  const avgMargin =
    marginValues.length > 0
      ? Math.round(marginValues.reduce((s, m) => s + m, 0) / marginValues.length)
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pricing &amp; Catalog</h1>
        <p className="text-sm text-ink/60">
          Every price in the app reads from here. Click the ⓘ on a row to see what it is,
          edit any field, then hit <span className="font-medium text-ink">Save all changes</span>{' '}
          once — saves propagate to{' '}
          <Link href="/pricing" className="underline">/pricing</Link> and{' '}
          <Link href="/for-vendors" className="underline">/for-vendors</Link> within seconds.
        </p>
      </header>

      {createdCode && (
        <div className="mb-6 rounded-2xl border border-success-300/60 bg-success-50/80 p-4">
          <p className="text-sm text-success-900">
            Created bundle <code className="font-mono text-xs">{createdCode}</code> — set its
            price, description and active state in the Bundles section above, then Save.
          </p>
        </div>
      )}
      {createError && (
        <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-4">
          <p className="text-sm text-danger-900">
            {createError === 'name'
              ? 'A bundle needs a name.'
              : createError === 'price'
                ? 'Enter a valid bundle price (₱0 or more).'
                : 'Could not create the bundle — please try again.'}
          </p>
        </div>
      )}
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
        <Stat label="Max price" value={maxPrice > 0 ? `₱${formatPeso(maxPrice)}` : '—'} />
        <Stat label="Min price (paid)" value={minPrice > 0 ? `₱${formatPeso(minPrice)}` : '—'} />
        <Stat label="Avg margin (paid)" value={avgMargin !== null ? `${avgMargin}%` : '—'} />
      </div>

      {(retailRes.error || bundleRes.error) && (
        <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger-900">
            Catalog load error
          </p>
          <p className="mt-1 text-sm text-danger-900">
            The pricing catalog couldn&apos;t load right now. We&apos;ve logged the issue — refresh
            in a moment or check Sentry.
          </p>
        </div>
      )}

      <ConfirmForm
        action={saveAllPricing}
        title="Save these prices live?"
        confirmLabel="Save all changes"
        destructive={false}
        message="Saving ships these prices LIVE to the public catalog right away — only the rows you changed get written. Double-check the values before you confirm."
      >
        {/* ─── Customer SKUs ─────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Customer SKUs ({retailRows.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border border-ink/10">
            {retailRows.length === 0 ? (
              <Empty label="No SKUs in platform_retail_catalog_v2 yet." />
            ) : (
              <>
                <ColHeader
                  grid={RETAIL_GRID}
                  cols={[
                    { label: 'SKU · title', align: 'left' },
                    { label: 'Cost / event', align: 'right' },
                    { label: 'Retail price', align: 'right' },
                    { label: 'Margin', align: 'right' },
                    { label: 'Active', align: 'center' },
                  ]}
                />
                {retailRows.map((row) => (
                  <RetailRowEditor
                    key={row.service_code}
                    row={{
                      service_code: row.service_code,
                      title: row.title,
                      description: row.description,
                      retail_price_php: row.retail_price_php,
                      saas_overhead_cost_php: row.saas_overhead_cost_php,
                      is_token_able: row.is_token_able,
                      is_active: row.is_active,
                      edited: editedStr(row.updated_at, row.updated_by_admin_id),
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ─── Bundles ───────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              Bundles ({bundleRows.length})
            </h2>
            <a
              href="#create-bundle"
              className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Create a bundle
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl border border-ink/10">
            {bundleRows.length === 0 ? (
              <Empty label="No bundles yet — create one below." />
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
                  <BundleRowEditor
                    key={row.package_code}
                    row={{
                      package_code: row.package_code,
                      title: row.title,
                      description: row.description,
                      retail_price_php: row.retail_price_php,
                      is_active: row.is_active,
                      edited: editedStr(row.updated_at, row.updated_by_admin_id),
                    }}
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
            <code className="rounded bg-ink/5 px-1 font-mono text-xs">vendor_billing_catalog</code>.
            Price, description + active state are editable; titles, tier caps + token grants stay
            migration-owned.
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/10">
            {vendorRows.length === 0 ? (
              <Empty label="No SKUs in vendor_billing_catalog yet." />
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
                  <VendorRowEditor
                    key={row.sku_code}
                    row={{
                      sku_code: row.sku_code,
                      title: row.title,
                      description: row.description,
                      price_php: row.price_php,
                      offering_label: VENDOR_OFFERING_LABEL[row.offering_type],
                      token_grant_count: row.token_grant_count,
                      is_active: row.is_active,
                      edited: editedStr(row.updated_at, null),
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ─── Platform fee ──────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-semibold tracking-tight">Platform fee</h2>
          <p className="mb-3 text-sm text-ink/60">
            Setnayan Pay convenience fee added to a customer invoice when they pay a vendor booking
            through Setnayan. The vendor still receives the full booking amount — the fee is the
            customer&apos;s cost. Code constant {SETNAYAN_PAY_FEE_PCT}% is the fallback.
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
                className="input-field mt-1 w-full tabular-nums"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                {feeIsFromDb
                  ? 'Set in platform_settings.'
                  : 'Falling back to the code constant — save once to persist it.'}
              </span>
            </label>
          </div>
        </section>

        {/* ─── Sticky single save bar ───────────────────────────────── */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="max-w-md text-xs text-ink/55">
            Type new prices in any field above, then save them all at once. Only the rows you
            changed get written.
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
      </ConfirmForm>

      {/* ─── Create a bundle (its own form — HTML forms can't nest) ──── */}
      <section id="create-bundle" className="mb-10 scroll-mt-24">
        <h2 className="mb-1 text-base font-semibold tracking-tight">Create a bundle</h2>
        <p className="mb-3 text-sm text-ink/60">
          Add a new bundle to{' '}
          <code className="rounded bg-ink/5 px-1 font-mono text-xs">platform_package_catalog</code>.
          A bundle is a name + a price (its <span className="italic">code</span> is generated from
          the name). It appears in the Bundles section above, ready to fine-tune.
        </p>
        <ConfirmForm
          action={createBundle}
          title="Create this bundle?"
          confirmLabel="Add bundle"
          destructive={false}
          message="This creates a new live bundle product — it appears on the public /pricing and /for-vendors pages right away."
          className="rounded-2xl border border-ink/10 bg-paper p-4 sm:p-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Bundle name
              </span>
              <input
                name="bundle_name"
                type="text"
                required
                placeholder="e.g. Setnayan Starter"
                className="input-field mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Price (₱)
              </span>
              <input
                name="bundle_price"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="9999"
                className="input-field mt-1 w-full text-right tabular-nums"
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              What this bundle includes (optional)
            </span>
            <textarea
              name="bundle_desc"
              rows={2}
              placeholder="e.g. Setnayan AI plus the monogram, custom QR and websites."
              className="input-field mt-1 min-h-[52px] w-full py-2 text-sm leading-relaxed"
            />
          </label>
          <div className="mt-4">
            <SubmitButton
              className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
              pendingLabel="Creating…"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add bundle
            </SubmitButton>
          </div>
        </ConfirmForm>
      </section>

      <div className="rounded-2xl border border-warn-300/60 bg-warn-50/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-warn-900">
          Deferred V1.x
        </p>
        <p className="mt-1 text-sm text-warn-900">
          Two-admin approval gate on price deltas above ₱500 logs to console only for now. A
          bundle stores name + price + description; defining which services a bundle{' '}
          <span className="italic">unlocks</span> is a separate follow-up.
        </p>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="p-8 text-center">
      <p className="text-sm text-ink/60">{label}</p>
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
      <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-4">
        <p className="text-sm text-danger-900">
          Something went wrong saving one or more prices — we logged the error. Refresh and confirm
          the values below, then try again.
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
      <div className="mb-6 rounded-2xl border border-success-300/60 bg-success-50/80 p-4">
        <p className="text-sm text-success-900">
          Saved {saved} price change{saved === 1 ? '' : 's'} — now live on /pricing and
          /for-vendors.{skippedNote}
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-2xl border border-ink/15 bg-cream p-4">
      <p className="text-sm text-ink/70">
        No changes to save — everything already matches what&apos;s live.{skippedNote}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/5 bg-cream p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}

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
            c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
