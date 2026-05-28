import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet, Clock3, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  computeMonthlySubtotals,
  fetchVendorEarnings,
} from '@/lib/vendor-earnings';
/* Retired 2026-05-28 V2 cutover: Setnayan Pay 5% convenience fee + 3-stage payout
 * model + BIR 0.5% withholding routing through Setnayan-as-rails all retire.
 * Historical PayoutStage labels stay so legacy V1 records render correctly;
 * new rows stop landing once cutover migration ships per CLAUDE.md 2026-05-28
 * V2 cutover decision-log rows. */
import {
  PAYOUT_STAGE_LABEL,
  PAYOUT_STAGE_TONE,
  formatCentavosPhp,
  resolveVendorVerificationState,
  type PayoutStage,
  type VendorVerificationState,
} from '@/lib/payouts';
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

  // Vendor Payout model (2026-05-16 lock) — pull this vendor's own scheduled
  // payouts so the page can render the confirmed / in-stage / paid split.
  // RLS already lets the vendor read their own payouts, so we use the user
  // client to respect server-side auth scoping.
  const { data: payoutRows } = await supabase
    .from('vendor_payouts')
    .select(
      `payout_id, payout_stage, stage, stage_pct, amount_centavos,
       vendor_net_centavos, gross_centavos, bir_withholding_centavos,
       gateway_fee_centavos, disbursement_fee_centavos,
       scheduled_at, paid_at, released_at, dispute_window_ends_at, on_hold,
       hold_reason, payment_method, payout_method, created_at,
       order:orders!vendor_payouts_order_id_fkey(reference_code, description)`,
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(100);

  type PayoutRow = {
    payout_id: string;
    payout_stage: PayoutStage | null;
    stage: string;
    stage_pct: number;
    amount_centavos: number;
    vendor_net_centavos: number | null;
    gross_centavos: number | null;
    bir_withholding_centavos: number;
    gateway_fee_centavos: number;
    disbursement_fee_centavos: number;
    scheduled_at: string | null;
    paid_at: string | null;
    released_at: string | null;
    dispute_window_ends_at: string | null;
    on_hold: boolean;
    hold_reason: string | null;
    payment_method: string | null;
    payout_method: string | null;
    created_at: string;
    order: { reference_code: string; description: string } | null;
  };
  const payouts = (payoutRows ?? []) as unknown as PayoutRow[];

  const verificationState: VendorVerificationState =
    resolveVendorVerificationState(profile);

  const pendingCentavos = payouts
    .filter((r) => !r.paid_at && !r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const paidCentavos = payouts
    .filter((r) => !!r.paid_at)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const onHoldCentavos = payouts
    .filter((r) => r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);

  // Pagination over the recent-orders list (most recent first).
  const pageRaw = Number.parseInt(search.page ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const start = (page - 1) * PAGE_SIZE;
  const visible = earnings.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(earnings.length / PAGE_SIZE));

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Wallet aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Earnings</h1>
        <p className="max-w-prose text-base text-ink/65">
          A log of bookings you&rsquo;ve closed through Setnayan. You keep 100% of what
          couples pay you — Setnayan no longer routes payments between you and your
          clients. This page is the running ledger you use to track direct bookings;
          your Setnayan subscription invoices and token-pack purchases live on the
          Tax documents tab.
        </p>
      </header>

      <article className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 text-sm text-ink/75">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium text-ink">How earnings work now</p>
          <p className="text-sm text-ink/70">
            Couples pay you directly off-platform. Setnayan never sits between you
            and your booking revenue. The rows below capture confirmed bookings on
            your services so you have a single audit trail across events — your
            own books still rule for tax filings on these direct bookings.
          </p>
        </div>
      </article>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Year-to-date"
          value={formatPhp(ytdTotal)}
          help={`${earnings.length} booking${earnings.length === 1 ? '' : 's'} logged`}
        />
        <Stat
          label="This month"
          value={formatPhp(months[months.length - 1]?.total_php ?? 0)}
          help={`${months[months.length - 1]?.order_count ?? 0} booking${
            (months[months.length - 1]?.order_count ?? 0) === 1 ? '' : 's'
          }`}
        />
        <Stat
          label="Your share"
          value="100%"
          help="You keep everything couples pay you — no platform cut."
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Legacy payout records ({payouts.length})
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
            <ShieldCheck className="h-3 w-3" aria-hidden /> {verificationState}
          </span>
        </div>

        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {/* Retired 2026-05-28 V2 cutover: Setnayan Pay routed payments retire.
              Rows below are historical only — bookings closed before V2 cutover
              that still settled through Setnayan-as-rails. New bookings settle
              direct between you and the couple. */}
          These are historical records from before Setnayan stepped out of the
          payments path. New bookings won&rsquo;t land here — you and your client
          settle directly, and the row above tracks the booking value for your books.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <PayoutKpi
            tone="bg-amber-100 text-amber-800"
            icon={<Clock3 className="h-4 w-4" />}
            label="Pending (legacy)"
            value={formatCentavosPhp(pendingCentavos)}
            help={`${payouts.filter((r) => !r.paid_at && !r.on_hold).length} stage(s)`}
          />
          <PayoutKpi
            tone="bg-emerald-100 text-emerald-800"
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Released (legacy)"
            value={formatCentavosPhp(paidCentavos)}
            help={`${payouts.filter((r) => !!r.paid_at).length} stage(s)`}
          />
          <PayoutKpi
            tone="bg-rose-100 text-rose-800"
            icon={<Wallet className="h-4 w-4" />}
            label="On hold"
            value={formatCentavosPhp(onHoldCentavos)}
            help={`${payouts.filter((r) => r.on_hold).length} stage(s)`}
          />
        </div>

        {payouts.length > 0 ? (
          /* Retired 2026-05-28 V2 cutover: legacy payouts list — display-only.
             No new rows write here once cutover migration ships. */
          <ul className="space-y-2">
            {payouts.slice(0, 25).map((row) => {
              const stage: PayoutStage = (row.payout_stage ??
                legacyStageToPayoutStage(row.stage)) as PayoutStage;
              return (
                <li
                  key={row.payout_id}
                  className="rounded-xl border border-ink/10 bg-cream p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${PAYOUT_STAGE_TONE[stage]}`}
                        >
                          {PAYOUT_STAGE_LABEL[stage]}
                        </span>
                        {row.paid_at ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                            Paid
                          </span>
                        ) : row.on_hold ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-rose-800">
                            On hold
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-800">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-ink">
                        {row.order?.reference_code ?? '—'}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink/65">
                        {row.order?.description ?? '—'}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {/* Retired 2026-05-28 V2 cutover: BIR + gateway breakdown
                            kept on legacy rows for audit only; new bookings don't
                            route through Setnayan so no rail fees apply. */}
                        Scheduled {formatTimestamp(row.scheduled_at)}
                      </p>
                      {row.hold_reason ? (
                        <p className="text-xs text-rose-800">
                          <span className="font-medium">Hold:</span> {row.hold_reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="font-mono text-sm font-semibold text-ink">
                        {formatCentavosPhp(row.vendor_net_centavos ?? row.amount_centavos)}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        Stage {row.stage_pct}%
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
            No legacy payout records on file. Direct-booking ledger below.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Booking ledger ({earnings.length})
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
            <p className="text-sm font-medium text-ink">No bookings logged yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
              Add services on the{' '}
              <Link href="/vendor-dashboard/services" className="text-terracotta hover:underline">
                Services
              </Link>{' '}
              tab. Once couples lock you on their event, your booked work shows
              up here for your own records.
            </p>
          </div>
        ) : (
          /* Retired 2026-05-28 V2 cutover: per-row Fee + Net columns dropped.
             Vendors keep 100% of what couples pay them so the full booking
             value is what they track. */
          <ul className="space-y-2">
            {visible.map((r) => {
              const gross = Number(
                r.payment_amount_php ??
                  r.confirmed_total_php ??
                  r.requested_total_php,
              );
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
                        Booked {r.paid_at}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink/65">{r.description}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="font-mono text-sm font-semibold text-ink">
                        {formatPhp(gross)}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        You keep 100%
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

function PayoutKpi({
  tone,
  icon,
  label,
  value,
  help,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{help}</p>
    </div>
  );
}

function legacyStageToPayoutStage(legacy: string): PayoutStage {
  switch (legacy) {
    case 'immediate':
      return 'immediate_full';
    case 'reservation':
      return 'stage_1_confirm';
    case 'pre_event':
      return 'stage_2_event_start';
    case 'post_event':
      return 'stage_3_event_end';
    default:
      return 'immediate_full';
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
