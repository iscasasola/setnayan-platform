import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  SETNAYAN_PAY_FEE_PCT,
  computeMonthlySubtotals,
  convenienceFeePhp,
  fetchVendorEarnings,
} from '@/lib/vendor-earnings';
import { displayServiceLabel, formatPhp } from '@/lib/vendors';

export const metadata = { title: 'Earnings · Vendor' };

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function VendorEarningsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Categories the vendor offers (active or not — pricing history shouldn't
  // disappear when they pause a service).
  const services = await fetchVendorServices(supabase, profile.vendor_profile_id);
  const categories = Array.from(new Set(services.map((s) => s.category)));

  // Orders RLS is owner-only. Use the admin client to read matched payments
  // whose orders.service_key is in the vendor's categories. The vendor scope
  // is enforced by the category filter, not RLS.
  const admin = createAdminClient();
  const earnings =
    categories.length > 0 ? await fetchVendorEarnings(admin, categories) : [];

  const { ytdTotal, months } = computeMonthlySubtotals(earnings);

  // Pagination over the recent-orders list (most recent first).
  const pageRaw = Number.parseInt(search.page ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const start = (page - 1) * PAGE_SIZE;
  const visible = earnings.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(earnings.length / PAGE_SIZE));

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Wallet aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Earnings</h1>
        <p className="max-w-prose text-base text-ink/65">
          Read-only summary of paid orders that match the services on your profile.
          Earnings post the moment Setnayan admins reconcile a couple&rsquo;s payment.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Year-to-date"
          value={formatPhp(ytdTotal)}
          help={`${earnings.length} order${earnings.length === 1 ? '' : 's'} total`}
        />
        <Stat
          label="This month"
          value={formatPhp(months[months.length - 1]?.total_php ?? 0)}
          help={`${months[months.length - 1]?.order_count ?? 0} order${
            (months[months.length - 1]?.order_count ?? 0) === 1 ? '' : 's'
          }`}
        />
        <Stat
          label="Setnayan Pay fee"
          value={`${SETNAYAN_PAY_FEE_PCT}%`}
          help="Charged per booking; shown on every row."
        />
      </section>

      <section className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Last 12 months
        </h2>
        {months.every((m) => m.total_php === 0) ? (
          <p className="py-4 text-sm text-ink/55">
            No earnings yet. Add services on the Services tab — paid orders posted to
            those categories will roll up here.
          </p>
        ) : (
          <ol className="divide-y divide-ink/10">
            {months.map((m) => (
              <li
                key={m.ym}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    {m.order_count} order{m.order_count === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-ink">
                  {formatPhp(m.total_php)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Recent paid orders ({earnings.length})
          </h2>
          {totalPages > 1 ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Page {page} / {totalPages}
            </p>
          ) : null}
        </div>

        {earnings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
            <Wallet
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-ink">No paid orders yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
              Add services on the{' '}
              <Link href="/vendor-dashboard/services" className="text-terracotta hover:underline">
                Services
              </Link>{' '}
              tab. When a couple&rsquo;s order for one of your categories is marked
              paid, it lands here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((r) => {
              const gross = Number(
                r.payment_amount_php ??
                  r.confirmed_total_php ??
                  r.requested_total_php,
              );
              const fee = convenienceFeePhp(gross);
              const net = gross - fee;
              return (
                <li
                  key={r.order_id}
                  className="rounded-xl border border-ink/10 bg-cream p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {r.event_display_name ?? 'Event'}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {r.service_key ? displayServiceLabel(r.service_key) : '—'} ·{' '}
                        Paid {r.paid_at}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink/65">{r.description}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="font-mono text-sm font-semibold text-ink">
                        {formatPhp(gross)}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        Fee {formatPhp(fee)} · Net {formatPhp(net)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/vendor-dashboard/earnings?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40 ${
                page <= 1 ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              ‹ Newer
            </Link>
            <Link
              href={`/vendor-dashboard/earnings?page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={`inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40 ${
                page >= totalPages ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Older ›
            </Link>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {help ? <p className="mt-1 text-xs text-ink/55">{help}</p> : null}
    </div>
  );
}
