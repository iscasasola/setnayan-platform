import { ExternalLink } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  formatPhp,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/orders';
import { approvePayment, confirmOrderTotal, refundOrder, rejectPayment } from './actions';

export const metadata = { title: 'Payments · Admin' };

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

type Filter = 'pending' | 'all' | 'orders_needing_quote';

type PaymentJoined = {
  payment_id: string;
  order_id: string;
  user_id: string;
  amount_php: number;
  channel: string;
  reference_number: string | null;
  screenshot_url: string | null;
  paid_at: string;
  status: PaymentStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  order: {
    public_id: string;
    reference_code: string;
    description: string;
    requested_total_php: number;
    confirmed_total_php: number | null;
    status: OrderStatus;
  } | null;
  user: { email: string | null; public_id: string } | null;
};

type OrderJoined = {
  order_id: string;
  public_id: string;
  reference_code: string;
  description: string;
  requested_total_php: number;
  confirmed_total_php: number | null;
  status: OrderStatus;
  admin_notes: string | null;
  created_at: string;
  user: { email: string | null; public_id: string } | null;
};

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const search = await searchParams;
  const filter = (search.filter ?? 'pending') as Filter;

  const admin = createAdminClient();

  // Global subscription expiry sweep (Task #23 — pilot blocker). Admin
  // payments is the safety net: any per-scope sweep miss on couple/vendor
  // dashboards gets caught here. Fire-and-forget — never blocks the queue
  // render.
  void sweepLapsedSubscriptions(admin);

  let payments: PaymentJoined[] = [];
  let unquotedOrders: OrderJoined[] = [];

  if (filter === 'orders_needing_quote') {
    const { data } = await admin
      .from('orders')
      .select(
        'order_id,public_id,reference_code,description,requested_total_php,confirmed_total_php,status,admin_notes,created_at, user:users!orders_user_id_fkey(email, public_id)',
      )
      .eq('status', 'submitted')
      .order('created_at', { ascending: true })
      .limit(100);
    unquotedOrders = (data ?? []) as unknown as OrderJoined[];
  } else {
    let paymentsQuery = admin
      .from('payments')
      .select(
        'payment_id,order_id,user_id,amount_php,channel,reference_number,screenshot_url,paid_at,status,admin_notes,reviewed_at,created_at, order:orders(public_id, reference_code, description, requested_total_php, confirmed_total_php, status), user:users!payments_user_id_fkey(email, public_id)',
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter === 'pending') paymentsQuery = paymentsQuery.eq('status', 'pending');
    const { data } = await paymentsQuery;
    payments = (data ?? []) as unknown as PaymentJoined[];
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Payments &amp; reconciliation</h1>
        <p className="text-sm text-ink/60">
          Couples log payments after they transfer. Match each one against the order&rsquo;s
          reference code. Submitted orders without a confirmed total need a quote before couples can
          pay.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        <FilterChip activeFilter={filter} target="pending" label="Pending payments" />
        <FilterChip activeFilter={filter} target="all" label="All payments" />
        <FilterChip
          activeFilter={filter}
          target="orders_needing_quote"
          label="Orders needing a quote"
        />
      </nav>

      {filter === 'orders_needing_quote' ? (
        <OrdersNeedingQuote orders={unquotedOrders} />
      ) : (
        <PaymentsList payments={payments} />
      )}
    </div>
  );
}

function FilterChip({
  activeFilter,
  target,
  label,
}: {
  activeFilter: string;
  target: Filter;
  label: string;
}) {
  const isActive = activeFilter === target;
  return (
    <a
      href={`/admin/payments?filter=${target}`}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        isActive ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
    </a>
  );
}

function OrdersNeedingQuote({ orders }: { orders: OrderJoined[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
        No orders waiting for a quote.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.order_id} className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                {o.public_id} · ref <span className="text-terracotta-700">{o.reference_code}</span>
              </p>
              <p className="text-sm font-semibold text-ink">{o.user?.email ?? '—'}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                ORDER_STATUS_TONE[o.status]
              }`}
            >
              {ORDER_STATUS_LABEL[o.status]}
            </span>
          </div>
          <p className="whitespace-pre-wrap rounded-md bg-ink/[0.03] p-3 text-sm text-ink/75">
            {o.description}
          </p>
          <p className="text-xs text-ink/55">
            Requested (pre-VAT):{' '}
            <span className="font-mono">{formatPhp(o.requested_total_php)}</span>
            {' · '}buyer pays{' '}
            <span className="font-mono">{formatPhp(Number(o.requested_total_php) * 1.12)}</span>{' '}
            incl. 12% VAT
          </p>
          <form
            action={confirmOrderTotal}
            className="grid grid-cols-1 gap-2 border-t border-ink/10 pt-3 sm:grid-cols-3"
          >
            <input type="hidden" name="order_id" value={o.order_id} />
            <label className="space-y-1 sm:col-span-1">
              <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Confirmed pre-VAT total (PHP)
              </span>
              <input
                name="confirmed_total_php"
                type="number"
                min={0}
                step="0.01"
                defaultValue={String(o.requested_total_php)}
                required
                className="input-field h-9 py-0 text-sm"
              />
              <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                Buyer pays base &times; 1.12 incl. VAT
              </span>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Note to couple
              </span>
              <input
                name="admin_notes"
                placeholder="Inclusions, terms, payment instructions"
                className="input-field h-9 py-0 text-sm"
              />
            </label>
            <SubmitButton
              className="inline-flex items-center justify-center rounded-md bg-terracotta px-4 py-1.5 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70 sm:col-span-3"
              pendingLabel="Confirming…"
            >
              Confirm quote · move to awaiting payment
            </SubmitButton>
          </form>
        </li>
      ))}
    </ul>
  );
}

function PaymentsList({ payments }: { payments: PaymentJoined[] }) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
        Nothing to reconcile.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {payments.map((p) => {
        const matchesRef =
          !!p.reference_number &&
          !!p.order?.reference_code &&
          p.reference_number.toUpperCase().includes(p.order.reference_code.toUpperCase());
        return (
          <li key={p.payment_id} className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                  Order {p.order?.public_id ?? '—'} · ref{' '}
                  <span className="text-terracotta-700">{p.order?.reference_code ?? '—'}</span>
                </p>
                <p className="text-sm font-semibold text-ink">{p.user?.email ?? '—'}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  PAYMENT_STATUS_TONE[p.status]
                }`}
              >
                {PAYMENT_STATUS_LABEL[p.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Amount" value={formatPhp(p.amount_php)} />
              <Stat label="Channel" value={p.channel} />
              <Stat label="Reference" value={p.reference_number ?? '—'} mono />
              <Stat label="Paid" value={p.paid_at} mono />
            </div>

            {p.order ? (
              <p className="text-xs text-ink/65">
                Order total:{' '}
                <span className="font-mono">
                  {formatPhp(p.order.confirmed_total_php ?? p.order.requested_total_php)}
                </span>
                {' · status '}
                <span className="font-mono">{ORDER_STATUS_LABEL[p.order.status]}</span>
                {matchesRef ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                    Reference matches
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amber-900">
                    Verify reference manually
                  </span>
                )}
              </p>
            ) : null}

            {p.screenshot_url ? (
              <a
                href={p.screenshot_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
              >
                Screenshot
                <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              </a>
            ) : null}

            {p.status === 'pending' ? (
              <div className="space-y-2 border-t border-ink/10 pt-3">
                <form action={approvePayment} className="space-y-2">
                  <input type="hidden" name="payment_id" value={p.payment_id} />
                  <input
                    name="admin_notes"
                    placeholder="Optional note (e.g. bank confirmed at 14:32)"
                    className="input-field h-9 py-0 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-ink/65">
                    <input
                      type="checkbox"
                      name="promote_order"
                      defaultChecked
                      className="h-4 w-4 cursor-pointer accent-terracotta"
                    />
                    Also mark order as paid
                  </label>
                  <SubmitButton
                    className="inline-flex items-center justify-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-emerald-800 disabled:opacity-70"
                    pendingLabel="Approving…"
                  >
                    Approve · matched
                  </SubmitButton>
                </form>
                <form action={rejectPayment} className="space-y-2">
                  <input type="hidden" name="payment_id" value={p.payment_id} />
                  <input
                    name="admin_notes"
                    placeholder="Why is this rejected? (e.g. amount mismatch)"
                    className="input-field h-9 py-0 text-sm"
                  />
                  <SubmitButton
                    className="inline-flex items-center justify-center rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800 disabled:opacity-70"
                    pendingLabel="Rejecting…"
                  >
                    Reject
                  </SubmitButton>
                </form>
              </div>
            ) : p.order && (p.order.status === 'paid' || p.order.status === 'fulfilled') ? (
              <RefundForm
                orderId={p.order_id}
                orderPublicId={p.order.public_id}
                defaultAmountPhp={
                  p.order.confirmed_total_php ?? p.order.requested_total_php
                }
              />
            ) : null}

            {p.status !== 'pending' && p.admin_notes ? (
              <p className="rounded-md bg-ink/[0.03] p-3 text-xs text-ink/75">
                {p.admin_notes}
                {p.reviewed_at ? (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                    · reviewed {p.reviewed_at.slice(0, 10)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * RefundForm — inline refund action on a paid/fulfilled order row.
 *
 * WHY (CLAUDE.md 2026-05-23 row "Refund action on /admin/payments"):
 * Pilot couples (5-20 personal/family cohort, June 1 launch) will double-pay
 * under manual GCash reconciliation. Today's only recovery path is Supabase
 * Studio under live customer pressure. The inline form lets the owner record
 * the bank-transfer reversal + notify the couple in one click without
 * leaving /admin/payments.
 *
 * Pre-fills the refund amount with the order's confirmed total (or requested
 * total if not yet quoted). Reason is required (≥ 20 chars, enforced
 * server-side too). Proof URL is optional in V1 — admin often refunds first
 * and attaches the screenshot later.
 *
 * Single-admin authority for V1 per the pilot scope. Two-admin gate for
 * refunds > ₱25,000 (per 0023 § 9.1) lands V1.x alongside the dedicated
 * refund detail page.
 */
function RefundForm({
  orderId,
  orderPublicId,
  defaultAmountPhp,
}: {
  orderId: string;
  orderPublicId: string;
  defaultAmountPhp: number;
}) {
  return (
    <details className="border-t border-ink/10 pt-3">
      <summary className="cursor-pointer text-xs font-medium text-violet-800 hover:text-violet-900">
        Record a refund for order {orderPublicId}
      </summary>
      <form action={refundOrder} className="mt-2 space-y-2">
        <input type="hidden" name="order_id" value={orderId} />
        <label className="block space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Amount refunded (PHP)
          </span>
          <input
            name="refund_amount_php"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={String(defaultAmountPhp)}
            required
            className="input-field h-9 py-0 text-sm"
          />
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Pre-filled with the order total — edit if you sent back a different amount.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Reason (at least 20 characters)
          </span>
          <textarea
            name="reason"
            required
            minLength={20}
            maxLength={2000}
            placeholder="E.g. Couple double-paid via GCash on June 4 — reversed transfer GCash ref 99887766 sent back to their original number."
            rows={2}
            className="input-field min-h-[60px] py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Proof URL (optional)
          </span>
          <input
            name="proof_url"
            type="url"
            placeholder="Link to the reverse-transfer screenshot — you can add this later."
            className="input-field h-9 py-0 text-sm"
          />
        </label>
        <SubmitButton
          className="inline-flex items-center justify-center rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-violet-800 disabled:opacity-70"
          pendingLabel="Recording refund…"
        >
          Record refund · notify couple
        </SubmitButton>
      </form>
    </details>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-ink/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold text-ink ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
