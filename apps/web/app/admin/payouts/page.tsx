import Link from 'next/link';
import { Wallet, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import {
  PAYOUT_STAGE_LABEL,
  PAYOUT_STAGE_TONE,
  formatCentavosPhp,
  type PayoutStage,
} from '@/lib/payouts';
import { markPayoutPaidAction, holdPayoutAction } from './actions';

export const metadata = { title: 'Vendor payouts · Admin' };

type FilterKey = 'pending' | 'paid' | 'on_hold' | 'all';
type StageFilter = PayoutStage | 'all';

type Props = {
  searchParams: Promise<{
    filter?: string;
    stage?: string;
    vendor?: string;
    from?: string;
    to?: string;
    flash?: string;
    error?: string;
  }>;
};

type PayoutRow = {
  payout_id: string;
  public_id: string;
  order_id: string;
  vendor_profile_id: string;
  payout_stage: PayoutStage | null;
  stage: string;
  stage_pct: number;
  amount_centavos: number;
  gross_centavos: number | null;
  gateway_fee_centavos: number;
  bir_withholding_centavos: number;
  disbursement_fee_centavos: number;
  vendor_net_centavos: number | null;
  scheduled_at: string | null;
  dispute_window_ends_at: string | null;
  paid_at: string | null;
  released_at: string | null;
  on_hold: boolean;
  hold_reason: string | null;
  payout_method: string | null;
  payment_method: string | null;
  payout_reference: string | null;
  created_at: string;
  order: {
    public_id: string;
    reference_code: string;
    description: string;
    event_id: string | null;
  } | null;
  vendor: {
    business_name: string | null;
    public_id: string;
    public_visibility: string | null;
  } | null;
};

const FILTER_TABS: Array<{ key: FilterKey; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'all', label: 'All' },
];

const STAGE_TABS: Array<{ key: StageFilter; label: string }> = [
  { key: 'all', label: 'All stages' },
  { key: 'immediate_full', label: 'Immediate (verified)' },
  { key: 'stage_1_confirm', label: 'Stage 1 · 20%' },
  { key: 'stage_2_event_start', label: 'Stage 2 · 60%' },
  { key: 'stage_3_event_end', label: 'Stage 3 · 20%' },
];

export default async function AdminPayoutsPage({ searchParams }: Props) {
  const search = await searchParams;
  const filter = parseFilter(search.filter);
  const stage = parseStage(search.stage);
  const vendor = search.vendor?.trim() ?? '';
  const from = search.from?.trim() ?? '';
  const to = search.to?.trim() ?? '';

  const admin = createAdminClient();

  let query = admin
    .from('vendor_payouts')
    .select(
      `payout_id, public_id, order_id, vendor_profile_id, payout_stage,
       stage, stage_pct, amount_centavos, gross_centavos, gateway_fee_centavos,
       bir_withholding_centavos, disbursement_fee_centavos, vendor_net_centavos,
       scheduled_at, dispute_window_ends_at, paid_at, released_at, on_hold,
       hold_reason, payout_method, payment_method, payout_reference, created_at,
       order:orders!vendor_payouts_order_id_fkey(public_id, reference_code, description, event_id),
       vendor:vendor_profiles!vendor_payouts_vendor_profile_id_fkey(business_name, public_id, public_visibility)`,
    )
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (filter === 'pending') {
    query = query.is('paid_at', null).eq('on_hold', false);
  } else if (filter === 'paid') {
    query = query.not('paid_at', 'is', null);
  } else if (filter === 'on_hold') {
    query = query.eq('on_hold', true);
  }
  if (stage !== 'all') query = query.eq('payout_stage', stage);
  if (vendor) query = query.eq('vendor_profile_id', vendor);
  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) {
    logQueryError('AdminPayoutsPage (vendor_payouts)', error);
  }
  const rows = (data ?? []) as unknown as PayoutRow[];

  // Aggregate KPIs across the *current* filter selection.
  const pendingTotal = rows
    .filter((r) => !r.paid_at && !r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const paidTotal = rows
    .filter((r) => !!r.paid_at)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const onHoldTotal = rows
    .filter((r) => r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0006 + 0034 · Vendor Payout model (2026-05-16 lock)
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Vendor payouts</h1>
        <p className="max-w-3xl text-sm text-ink/65">
          One row per scheduled disbursement. Verified vendors are paid in a
          single <span className="font-medium">immediate</span> stage (T+1);
          coming-soon vendors release in three stages (20% on booking · 60%
          T+7 from event start · 20% T+7 from event end). Setnayan absorbs the
          ₱15-25 outbound fee — vendor net is shown post BIR withholding and
          gateway only.
        </p>
      </header>

      <FlashBanner flash={search.flash} error={search.error} />

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Clock3 className="h-4 w-4" />}
          label="Pending (filtered)"
          value={formatCentavosPhp(pendingTotal)}
          tone="bg-warn-100 text-warn-800"
          help={`${rows.filter((r) => !r.paid_at && !r.on_hold).length} stage(s)`}
        />
        <Stat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Paid (filtered)"
          value={formatCentavosPhp(paidTotal)}
          tone="bg-success-100 text-success-800"
          help={`${rows.filter((r) => !!r.paid_at).length} stage(s)`}
        />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="On hold (filtered)"
          value={formatCentavosPhp(onHoldTotal)}
          tone="bg-danger-100 text-danger-800"
          help={`${rows.filter((r) => r.on_hold).length} stage(s)`}
        />
      </section>

      <FilterBar
        filter={filter}
        stage={stage}
        vendor={vendor}
        from={from}
        to={to}
      />

      {error ? (
        <FormFlash tone="error">
          Payouts couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </FormFlash>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
          <Wallet aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No payouts match this filter.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Payouts land here the moment an admin reconciles a couple&rsquo;s
            payment in <Link className="text-terracotta hover:underline" href="/admin/payments">Payments</Link>.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <PayoutCard key={row.payout_id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar({
  filter,
  stage,
  vendor,
  from,
  to,
}: {
  filter: FilterKey;
  stage: StageFilter;
  vendor: string;
  from: string;
  to: string;
}) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map((t) => (
          <Link
            key={t.key}
            href={makeHref({ filter: t.key, stage, vendor, from, to })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === t.key
                ? 'bg-ink text-cream'
                : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STAGE_TABS.map((t) => (
          <Link
            key={t.key}
            href={makeHref({ filter, stage: t.key, vendor, from, to })}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              stage === t.key
                ? 'bg-terracotta text-cream'
                : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border border-ink/10 bg-cream p-3" method="get">
        <input type="hidden" name="filter" value={filter} />
        {stage !== 'all' ? <input type="hidden" name="stage" value={stage} /> : null}
        <label className="block text-xs text-ink/60">
          <span className="mb-1 block font-mono uppercase tracking-[0.15em]">Vendor profile ID</span>
          <input
            name="vendor"
            defaultValue={vendor}
            placeholder="UUID"
            className="h-9 w-72 max-w-full rounded-md border border-ink/20 bg-white px-2 text-sm"
          />
        </label>
        <label className="block text-xs text-ink/60">
          <span className="mb-1 block font-mono uppercase tracking-[0.15em]">From (scheduled)</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-md border border-ink/20 bg-white px-2 text-sm"
          />
        </label>
        <label className="block text-xs text-ink/60">
          <span className="mb-1 block font-mono uppercase tracking-[0.15em]">To (scheduled)</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-md border border-ink/20 bg-white px-2 text-sm"
          />
        </label>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
        <Link
          href={makeHref({ filter, stage, vendor: '', from: '', to: '' })}
          className="inline-flex h-11 items-center justify-center px-3 text-xs text-ink/60 hover:text-ink"
        >
          Reset
        </Link>
      </form>
    </div>
  );
}

function PayoutCard({ row }: { row: PayoutRow }) {
  const stage: PayoutStage = (row.payout_stage ??
    legacyStageToPayoutStage(row.stage)) as PayoutStage;
  const stageTone = PAYOUT_STAGE_TONE[stage];
  const stageLabel = PAYOUT_STAGE_LABEL[stage];
  const isPaid = !!row.paid_at;
  const isHeld = !!row.on_hold;

  return (
    <li className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] ${stageTone}`}>
              {stageLabel}
            </span>
            {isPaid ? (
              <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-800">
                Paid
              </span>
            ) : isHeld ? (
              <span className="rounded-full bg-danger-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-danger-800">
                On hold
              </span>
            ) : (
              <span className="rounded-full bg-warn-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-warn-800">
                Scheduled
              </span>
            )}
            {row.vendor?.public_visibility ? (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
                {row.vendor.public_visibility}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-ink">
            {row.vendor?.business_name ?? '(unknown vendor)'}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Order {row.order?.reference_code ?? row.order?.public_id ?? '—'} ·{' '}
            Payout {row.public_id}
          </p>
          <p className="line-clamp-1 text-xs text-ink/65">
            {row.order?.description ?? '—'}
          </p>
        </div>
        <div className="space-y-0.5 text-right">
          <p className="font-mono text-base font-semibold text-ink">
            {formatCentavosPhp(row.vendor_net_centavos ?? row.amount_centavos)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Stage {row.stage_pct}% of net
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/65 sm:grid-cols-4">
        <Field label="Scheduled" value={formatTimestamp(row.scheduled_at)} />
        <Field label="Paid at" value={formatTimestamp(row.paid_at)} />
        <Field label="Dispute window" value={formatTimestamp(row.dispute_window_ends_at)} />
        <Field label="Rail" value={row.payment_method ?? row.payout_method ?? '—'} />
        <Field label="Gross" value={formatCentavosPhp(row.gross_centavos)} />
        <Field label="Gateway" value={formatCentavosPhp(row.gateway_fee_centavos)} />
        <Field label="BIR 0.5%" value={formatCentavosPhp(row.bir_withholding_centavos)} />
        <Field
          label="Disburse fee"
          value={formatCentavosPhp(row.disbursement_fee_centavos)}
          help="Absorbed"
        />
      </dl>

      {row.hold_reason ? (
        <p className="mt-2 rounded-md border border-danger-200 bg-danger-50 px-2 py-1 text-xs text-danger-900">
          <span className="font-medium">On hold:</span> {row.hold_reason}
        </p>
      ) : null}

      {!isPaid ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          <form action={markPayoutPaidAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="payout_id" value={row.payout_id} />
            <select
              name="payment_method"
              defaultValue={row.payout_method ?? 'maya'}
              className="h-8 rounded-md border border-ink/20 bg-white px-2 text-xs"
            >
              <option value="maya">Maya</option>
              <option value="gcash">GCash</option>
              <option value="bdo_transfer">BDO transfer</option>
              <option value="check">Check</option>
            </select>
            <input
              name="payout_reference"
              placeholder="Reference #"
              className="h-8 w-40 rounded-md border border-ink/20 bg-white px-2 text-xs"
            />
            <SubmitButton className="button-primary h-8 px-3 text-xs">
              Mark paid
            </SubmitButton>
          </form>
          {!isHeld ? (
            <form action={holdPayoutAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="payout_id" value={row.payout_id} />
              <input
                name="reason"
                placeholder="Hold reason"
                required
                className="h-8 w-48 rounded-md border border-ink/20 bg-white px-2 text-xs"
              />
              <SubmitButton className="button-secondary h-8 px-3 text-xs">
                Place on hold
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Field({ label, value, help }: { label: string; value: string | null; help?: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd className="font-mono text-xs text-ink">
        {value ?? '—'}
        {help ? <span className="ml-1 text-ink/45">· {help}</span> : null}
      </dd>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  help,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  help: string;
  tone: string;
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

function FlashBanner({ flash, error }: { flash?: string; error?: string }) {
  if (!flash && !error) return null;
  return (
    <div className="mb-4 space-y-2">
      {flash ? (
        <p className="rounded-md border border-success-300/50 bg-success-50 px-4 py-3 text-sm text-success-900">
          {decodeURIComponent(flash)}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(error)}
        </p>
      ) : null}
    </div>
  );
}

function makeHref({
  filter,
  stage,
  vendor,
  from,
  to,
}: {
  filter: FilterKey;
  stage: StageFilter;
  vendor: string;
  from: string;
  to: string;
}): string {
  const params = new URLSearchParams();
  params.set('filter', filter);
  if (stage !== 'all') params.set('stage', stage);
  if (vendor) params.set('vendor', vendor);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `/admin/payouts?${qs}` : '/admin/payouts';
}

function parseFilter(raw: string | undefined): FilterKey {
  if (raw === 'paid' || raw === 'on_hold' || raw === 'all') return raw;
  return 'pending';
}

function parseStage(raw: string | undefined): StageFilter {
  switch (raw) {
    case 'immediate_full':
    case 'stage_1_confirm':
    case 'stage_2_event_start':
    case 'stage_3_event_end':
      return raw;
    default:
      return 'all';
  }
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

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
