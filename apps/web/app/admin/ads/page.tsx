import Link from 'next/link';
import { Megaphone, CheckCircle2, XCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  daysRemaining,
  fetchAllAdSubscriptionsForAdmin,
  findAdOption,
  type VendorAdSubscriptionRow,
} from '@/lib/vendor-ads';
import { formatCentavosPhp } from '@/lib/sku-catalog';
import { SubmitButton } from '@/app/_components/submit-button';
import { adminCancelAdSubscription } from './actions';

export const metadata = { title: 'Ad subscriptions · Admin' };

type AdsStatus = 'active' | 'cancelled' | 'expired' | 'all';

type Props = {
  searchParams: Promise<{
    status?: string;
    cancelled?: string;
    error?: string;
  }>;
};

const STATUSES: ReadonlyArray<AdsStatus> = ['active', 'cancelled', 'expired', 'all'];
const STATUS_LABEL: Record<AdsStatus, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  expired: 'Expired',
  all: 'All',
};

function parseStatus(raw: string | undefined): AdsStatus {
  if (raw && (STATUSES as readonly string[]).includes(raw)) {
    return raw as AdsStatus;
  }
  return 'active';
}

export default async function AdminAdsPage({ searchParams }: Props) {
  const search = await searchParams;
  const status = parseStatus(search.status);
  const admin = createAdminClient();

  const rows = await fetchAllAdSubscriptionsForAdmin(admin, status);

  // Hydrate vendor business names so the queue is browseable. We use the
  // admin client so RLS doesn't filter to the operator's own profile.
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_profile_id)));
  const vendorById = new Map<string, { business_name: string; business_slug: string | null; public_id: string }>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, business_slug, public_id')
      .in('vendor_profile_id', vendorIds);
    for (const v of (vendors ?? []) as Array<{
      vendor_profile_id: string;
      business_name: string;
      business_slug: string | null;
      public_id: string;
    }>) {
      vendorById.set(v.vendor_profile_id, {
        business_name: v.business_name,
        business_slug: v.business_slug,
        public_id: v.public_id,
      });
    }
  }

  // Summary tallies on the "active" view — quick read on platform-wide ad spend.
  const activeGross = rows
    .filter((r) => !r.cancelled_at && new Date(r.expires_at).getTime() > Date.now())
    .reduce((acc, r) => acc + r.gross_centavos, 0);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0022 · § 5b
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Megaphone aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Ad subscriptions</h1>
        </div>
        <p className="max-w-2xl text-sm text-ink/65">
          Boosted Ads (weekly by radius) and Sponsored Boost (long-commit, 30km,
          verified-only). Cancel for non-payment or operator-driven reason; record an
          optional refund in centavos. Refund payment runs through the existing
          Payments rail — this is the queue marker.
        </p>
      </header>

      <FlashBanner search={search} />

      <StatusTabs current={status} />

      {status === 'active' ? (
        <p className="mb-4 text-sm text-ink/70">
          {rows.length} active subscription{rows.length === 1 ? '' : 's'} · gross at
          purchase: <span className="font-mono">{formatCentavosPhp(activeGross)}</span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          No subscriptions in this view.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <SubscriptionCard
              key={row.ad_subscription_id}
              row={row}
              vendor={vendorById.get(row.vendor_profile_id) ?? null}
              status={status}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FlashBanner({
  search,
}: {
  search: { cancelled?: string; error?: string };
}) {
  if (search.cancelled) {
    return (
      <div
        role="status"
        className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>Subscription cancelled. Process the refund (if any) in /admin/payments.</span>
      </div>
    );
  }
  if (search.error) {
    return (
      <div
        role="alert"
        className="mb-4 flex items-start gap-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
      >
        <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{search.error}</span>
      </div>
    );
  }
  return null;
}

function StatusTabs({ current }: { current: AdsStatus }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 text-sm">
      {STATUSES.map((s) => (
        <Link
          key={s}
          href={s === 'active' ? '/admin/ads' : `/admin/ads?status=${s}`}
          className={`shrink-0 rounded-full px-3 py-1 ${
            current === s
              ? 'bg-terracotta text-cream'
              : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
          }`}
        >
          {STATUS_LABEL[s]}
        </Link>
      ))}
    </nav>
  );
}

function SubscriptionCard({
  row,
  vendor,
  status,
}: {
  row: VendorAdSubscriptionRow;
  vendor: { business_name: string; business_slug: string | null; public_id: string } | null;
  status: AdsStatus;
}) {
  const opt = findAdOption(row.sku_code);
  const isActive =
    !row.cancelled_at && new Date(row.expires_at).getTime() > Date.now();
  const tier = opt?.tier ?? (row.sku_code.startsWith('sponsored') ? 'sponsored' : 'boosted');
  const accent =
    tier === 'sponsored'
      ? 'border-amber-300 bg-amber-50'
      : 'border-terracotta/30 bg-terracotta/5';

  return (
    <li className={`space-y-3 rounded-2xl border p-4 ${accent}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-ink">
            {vendor ? vendor.business_name : 'Unknown vendor'}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {vendor?.public_id ?? row.vendor_profile_id}
          </p>
          {vendor?.business_slug ? (
            <Link
              href={`/v/${vendor.business_slug}`}
              className="text-xs text-terracotta hover:underline"
            >
              /v/{vendor.business_slug}
            </Link>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            isActive
              ? 'bg-emerald-100 text-emerald-800'
              : row.cancelled_at
                ? 'bg-ink/10 text-ink/55'
                : 'bg-amber-100 text-amber-900'
          }`}
        >
          {isActive ? 'Active' : row.cancelled_at ? 'Cancelled' : 'Expired'}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 text-xs text-ink/70">
        <Cell label="SKU">{opt?.label ?? row.sku_code}</Cell>
        <Cell label="Radius">{row.radius_km}km</Cell>
        <Cell label="Term">{opt?.termLabel ?? '—'}</Cell>
        <Cell label="Gross">{formatCentavosPhp(row.gross_centavos)}</Cell>
        <Cell label="Started">
          {new Date(row.started_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Cell>
        <Cell label={isActive ? 'Days remaining' : 'Expires'}>
          {isActive
            ? `${daysRemaining(row)}d`
            : new Date(row.expires_at).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
        </Cell>
        <Cell label="Auto-renew">{row.auto_renew ? 'Yes' : 'No'}</Cell>
        {row.refund_centavos !== null ? (
          <Cell label="Refunded">{formatCentavosPhp(row.refund_centavos)}</Cell>
        ) : null}
      </div>

      {row.cancel_reason ? (
        <p className="rounded-md bg-ink/5 px-3 py-2 text-xs italic text-ink/70">
          “{row.cancel_reason}”
        </p>
      ) : null}

      {isActive ? (
        <form
          action={adminCancelAdSubscription}
          className="space-y-2 border-t border-ink/10 pt-3"
        >
          <input type="hidden" name="ad_subscription_id" value={row.ad_subscription_id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Reason
              </span>
              <input
                type="text"
                name="reason"
                placeholder="Non-payment, vendor request, ..."
                className="input-field h-9 text-xs"
                maxLength={300}
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Refund (centavos)
              </span>
              <input
                type="number"
                name="refund_centavos"
                min={0}
                max={row.gross_centavos}
                step={1}
                placeholder="e.g. 500000 = ₱5,000"
                className="input-field h-9 text-xs"
              />
            </label>
          </div>
          <SubmitButton
            className="button-secondary h-9 px-3 text-xs"
            pendingLabel="Cancelling…"
          >
            Cancel + record refund
          </SubmitButton>
        </form>
      ) : null}
      {status === 'cancelled' && row.cancelled_by_user_id ? (
        <p className="text-xs text-ink/55">
          Cancelled by {row.cancelled_by_user_id.slice(0, 8)} ·{' '}
          {row.cancelled_at
            ? new Date(row.cancelled_at).toLocaleString('en-PH')
            : ''}
        </p>
      ) : null}
    </li>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
      <p className="text-xs text-ink">{children}</p>
    </div>
  );
}
