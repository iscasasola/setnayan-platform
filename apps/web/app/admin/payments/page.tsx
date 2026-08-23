import { ExternalLink } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { isRequestPlatform } from '@/lib/request-platform';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { InboxMatcher, type MatcherPayment } from './_components/inbox-matcher';
import { BatchApproveBar, BatchApproveCheckbox } from './_components/batch-approve-controls';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  formatPhp,
  isDecisivePaymentMatch,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/orders';
import {
  approvePayment,
  batchApprovePayments,
  confirmOrderTotal,
  refundOrder,
  rejectPayment,
  requestPaymentResubmit,
} from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { computeVatFromBase } from '@/lib/receipts';
import { isSameDayInManila } from '@/lib/papic-buy-urgency';
import { PageMasthead } from '@/app/_components/page-masthead';
export const metadata = { title: 'Payments · Admin' };

type Props = {
  // `notice` / `noticeType` surface an inline banner after a server action
  // redirects back here instead of throwing — e.g. approvePayment's shortfall
  // guard ("payment matched, order not promoted — ₱X short"). See actions.ts.
  searchParams: Promise<{ filter?: string; platform?: string; notice?: string; noticeType?: string }>;
};

type Filter = 'pending' | 'all' | 'orders_needing_quote';

type PaymentJoined = {
  payment_id: string;
  order_id: string;
  // NULL for a GUEST order — one minted from a Papic capture surface by
  // somebody with no Setnayan account (owner-locked 2026-07-29). The buyer
  // column renders `buyerLabel()` rather than a bare dash so the blank reads as
  // intent, not as a broken join.
  user_id: string | null;
  amount_php: number;
  channel: string;
  reference_number: string | null;
  screenshot_url: string | null;
  paid_at: string;
  status: PaymentStatus;
  admin_notes: string | null;
  // Set when an earlier admin review picked "Request resubmit" (Day 3 of
  // the voucher + inline-checkout sprint · 2026-05-29). Surfaces under the
  // payment-status pill so the next reviewer sees why the couple was asked
  // to re-upload. Column shipped by migration 20260529010000.
  admin_resubmit_notice: string | null;
  reviewed_at: string | null;
  created_at: string;
  order: {
    public_id: string;
    /** Drives the SAME-DAY jump below. Nullable — not every order is event-scoped. */
    event_id: string | null;
    reference_code: string;
    description: string;
    service_key: string | null;
    requested_total_php: number;
    confirmed_total_php: number | null;
    // Applied voucher discount in centavos. Needed so the decisive-match
    // predicate computes `owed` EXACTLY as approvePayment's shortfall guard
    // does (which nets the voucher off an unconfirmed base).
    voucher_discount_centavos: number | null;
    status: OrderStatus;
    // Originating platform — web | ios | android (migration 20270103040000).
    // Null on pre-migration rows / pre-stamp orders → shown as "web".
    platform: string | null;
  } | null;
  user: { email: string | null; public_id: string } | null;
};

type OrderJoined = {
  order_id: string;
  // NULL for a GUEST order — see the note on PaymentJoined.user_id.
  user_id: string | null;
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

/**
 * Who to show in the buyer column.
 *
 * A GUEST order has no account and therefore no email — deliberately, not
 * because a join failed. Saying so out loud matters at the reconciliation desk:
 * an admin looking at a ₱1,000 transfer with a dash where the buyer should be
 * has no way to tell "guest purchase" from "something is wrong with this row",
 * and the safe reaction to the second is to not approve it.
 */
function buyerLabel(email: string | null | undefined, userId: string | null | undefined): string {
  if (email) return email;
  return userId ? '—' : 'Guest · no account';
}

export default async function AdminPaymentsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filter = (search.filter ?? 'pending') as Filter;
  // Optional platform filter (web | ios | android) — orthogonal to the status
  // filter, so it composes with it. null = all platforms.
  const platformFilter = isRequestPlatform(search.platform) ? search.platform : null;
  // Inline notice from a redirecting server action (see actions.ts shortfall
  // guard). Trim + cap length so a crafted `?notice=` can't blow out the layout.
  const notice = typeof search.notice === 'string' ? search.notice.slice(0, 400).trim() : '';
  const noticeIsWarn = search.noticeType === 'warn';

  const admin = createAdminClient();

  // The rate the platform ACTUALLY charges — 0 today, because Setnayan is not
  // VAT-registered. Read here so the quote card can never re-invent a 12% of
  // its own; falls back to 0 on a failed read, which is both the legally safe
  // answer for a non-VAT taxpayer and the honest one.
  const vatRatePct = await getEffectiveVatRatePct(admin);

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
        'order_id,user_id,public_id,reference_code,description,requested_total_php,confirmed_total_php,status,admin_notes,created_at, user:users!orders_user_id_fkey(email, public_id)',
      )
      .eq('status', 'submitted')
      .order('created_at', { ascending: true })
      .limit(100);
    unquotedOrders = (data ?? []) as unknown as OrderJoined[];
  } else {
    // When a platform filter is active, the order embed becomes !inner so rows
    // whose order doesn't match the platform are excluded (a plain left-join
    // embed would keep them with a null order). Every payment has an order, so
    // !inner drops nothing else.
    const orderEmbed = platformFilter
      ? 'order:orders!inner(public_id, event_id, reference_code, description, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos, status, platform)'
      : 'order:orders(public_id, event_id, reference_code, description, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos, status, platform)';
    let paymentsQuery = admin
      .from('payments')
      .select(
        `payment_id,order_id,user_id,amount_php,channel,reference_number,screenshot_url,paid_at,status,admin_notes,admin_resubmit_notice,reviewed_at,created_at, ${orderEmbed}, user:users!payments_user_id_fkey(email, public_id)`,
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter === 'pending') paymentsQuery = paymentsQuery.eq('status', 'pending');
    if (platformFilter) paymentsQuery = paymentsQuery.eq('order.platform', platformFilter);
    const { data } = await paymentsQuery;
    payments = (data ?? []) as unknown as PaymentJoined[];
  }

  // Pre-resolve every payment-proof screenshot to a short-lived presigned GET
  // URL, keyed by payment_id. Payment proofs live in the PRIVATE thread-files
  // bucket, so the stored `r2://…` ref is NOT publicly readable — it must be
  // presigned server-side (24h TTL) before it can render in an <img>/<a>.
  // Legacy plain-URL values pass through unchanged. Doing this on the server
  // keeps R2 internals off the client and works for both old and new uploads.
  const screenshotUrlMap: Record<string, string> = {};
  await Promise.all(
    payments.map(async (p) => {
      if (!p.screenshot_url) return;
      const url = await displayUrlForStoredAsset(p.screenshot_url);
      if (url) screenshotUrlMap[p.payment_id] = url;
    }),
  );

  // ── SAME-DAY FIRST (owner 2026-08-02) ─────────────────────────────────────
  // "have an emergency purchase part if the event day is the day itself. these
  // will be priority." A 24-hour SLA is a fine promise on an ordinary order and
  // a broken product on a same-day one — the party ends before anyone looks. So
  // an order for an event happening TODAY jumps the whole queue, above even a
  // clean match: a clean match on next month's wedding can wait and this cannot.
  //
  // Same function the guest-facing buy panel uses to PROMISE the priority, so
  // the promise and the queue position cannot drift apart.
  const sameDayOrderIds = await fetchSameDayOrderIds(admin, payments);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
      <PageMasthead
        title="Payments & reconciliation"
      />

      {notice ? (
        <div
          role="alert"
          className={`mb-6 rounded-card border px-4 py-3 text-sm text-ink ${
            noticeIsWarn
              ? 'border-[color:var(--sn-warning)] bg-[var(--sn-warning-soft)]'
              : 'border-[color:var(--sn-success)] bg-[var(--sn-success-soft)]'
          }`}
        >
          {notice}
        </div>
      ) : null}

      <nav className="mb-3 flex flex-wrap gap-2">
        <FilterChip activeFilter={filter} platform={platformFilter} target="pending" label="Pending payments" />
        <FilterChip activeFilter={filter} platform={platformFilter} target="all" label="All payments" />
        <FilterChip
          activeFilter={filter}
          platform={platformFilter}
          target="orders_needing_quote"
          label="Orders needing a quote"
        />
      </nav>

      {filter !== 'orders_needing_quote' ? (
        <nav className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/40">
            Platform
          </span>
          <PlatformChip activePlatform={platformFilter} filter={filter} target={null} label="All" />
          <PlatformChip activePlatform={platformFilter} filter={filter} target="web" label="Web" />
          <PlatformChip activePlatform={platformFilter} filter={filter} target="ios" label="iOS app" />
          <PlatformChip activePlatform={platformFilter} filter={filter} target="android" label="Android app" />
        </nav>
      ) : null}

      {filter === 'orders_needing_quote' ? (
        <OrdersNeedingQuote orders={unquotedOrders} vatRatePct={vatRatePct} />
      ) : (
        <PaymentsList
          payments={payments}
          screenshotUrlMap={screenshotUrlMap}
          sameDayOrderIds={sameDayOrderIds}
        />
      )}
    </div>
  );
}

function FilterChip({
  activeFilter,
  platform,
  target,
  label,
}: {
  activeFilter: string;
  platform: string | null;
  target: Filter;
  label: string;
}) {
  const isActive = activeFilter === target;
  // Preserve the active platform filter when switching status.
  const href = `/admin/payments?filter=${target}${platform ? `&platform=${platform}` : ''}`;
  return (
    <a href={href} aria-pressed={isActive} className={`sn-chip${isActive ? ' selected' : ''}`}>
      {label}
    </a>
  );
}

function PlatformChip({
  activePlatform,
  filter,
  target,
  label,
}: {
  activePlatform: string | null;
  filter: string;
  target: 'web' | 'ios' | 'android' | null;
  label: string;
}) {
  const isActive = activePlatform === target;
  // Preserve the active status filter when switching platform; target=null = all.
  const href = `/admin/payments?filter=${filter}${target ? `&platform=${target}` : ''}`;
  return (
    <a href={href} aria-pressed={isActive} className={`sn-chip${isActive ? ' selected' : ''}`}>
      {label}
    </a>
  );
}

/**
 * 🚨 THIS SCREEN TOLD THE OPERATOR THE BUYER OWED 12% MORE THAN THEY DO.
 *
 * It printed `requested_total_php * 1.12` as "buyer pays … incl. 12% VAT" and
 * labelled its input "Buyer pays base × 1.12 incl. VAT". Setnayan is NOT
 * VAT-registered (sole prop, 8% flat; VAT only at the ₱3M tripwire) and the
 * configured rate is 0, so on a ₱499 order it displayed ₱559.
 *
 * ⚖ THE MONEY WAS NEVER WRONG — ONLY THE SCREEN. Everything that decides what
 * is actually owed already reads the configured rate. But the operator types
 * the "Note to couple" from THIS card, so a number that is ₱60 too high is one
 * copy-paste away from being quoted to a real customer and chased for.
 *
 * Owner ruling 2026-08-20: *"just stay with 499. remove the 12% let's keep it
 * simple and effective for everybody."* So: one number, and no sentence about a
 * tax nobody charges.
 *
 * 🔑 DERIVED, NOT DELETED. The rate comes from settings rather than being
 * hardcoded to zero — the day the ₱3M threshold is crossed the owner sets one
 * number and these lines return by themselves, with the right figure.
 */
function OrdersNeedingQuote({
  orders,
  vatRatePct,
}: {
  orders: OrderJoined[];
  vatRatePct: number;
}) {
  const vatApplies = vatRatePct > 0;
  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-[color:var(--sn-ink-400)]">
        No orders waiting for a quote.
      </div>
    );
  }
  return (
    <div className="sn-tile">
      <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.order_id} className="sn-row space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                {o.public_id} · ref <span className="text-terracotta-700">{o.reference_code}</span>
              </p>
              <p className="text-sm font-semibold text-ink">{buyerLabel(o.user?.email, o.user_id)}</p>
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
            {vatApplies ? 'Requested (pre-VAT): ' : 'Buyer pays: '}
            <span className="font-mono">{formatPhp(o.requested_total_php)}</span>
            {vatApplies ? (
              <>
                {' · '}buyer pays{' '}
                <span className="font-mono">
                  {formatPhp(computeVatFromBase(Number(o.requested_total_php), vatRatePct).gross)}
                </span>{' '}
                incl. {vatRatePct}% VAT
              </>
            ) : null}
          </p>
          <form
            action={confirmOrderTotal}
            className="grid grid-cols-1 gap-2 border-t border-ink/10 pt-3 sm:grid-cols-3"
          >
            <input type="hidden" name="order_id" value={o.order_id} />
            <label className="space-y-1 sm:col-span-1">
              <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                {vatApplies ? 'Confirmed pre-VAT total (PHP)' : 'Confirmed total (PHP)'}
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
                {vatApplies
                  ? `Buyer pays this plus ${vatRatePct}% VAT`
                  : 'This is exactly what the buyer pays'}
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
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-mulberry px-4 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:col-span-3"
              pendingLabel="Confirming…"
            >
              Confirm quote · move to awaiting payment
            </SubmitButton>
          </form>
        </li>
      ))}
      </ul>
    </div>
  );
}

function PaymentsList({
  payments,
  screenshotUrlMap,
  sameDayOrderIds,
}: {
  payments: PaymentJoined[];
  /**
   * order_ids whose event is TODAY in Manila. Resolved in the page (async) and
   * passed down because this component is synchronous — and passed as a SET of
   * ids rather than a boolean per row so the list and the count in the banner
   * above it cannot disagree.
   */
  sameDayOrderIds: Set<string>;
  /**
   * Map of payment_id → presigned display URL for the payment-proof screenshot.
   * Resolved server-side in the page component because proofs live in the
   * PRIVATE thread-files bucket and the stored `r2://…` ref is not publicly
   * readable — it must be presigned before it can render.
   */
  screenshotUrlMap: Record<string, string>;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-[color:var(--sn-ink-400)]">
        Nothing to reconcile.
      </div>
    );
  }
  // Lightweight rows for the paste-and-match helper. Keep only the fields the
  // matcher needs (no screenshot URLs / notes) so the client bundle stays small.
  const matcherRows: MatcherPayment[] = payments.map((p) => ({
    payment_id: p.payment_id,
    reference_code: p.order?.reference_code ?? null,
    // The WALLET reference the couple submitted — the matcher's strongest tier
    // compares it against whatever the admin pastes from their own bank app.
    reference_number: p.reference_number,
    amount_php: p.amount_php,
    label: p.user?.email ?? p.order?.public_id ?? '—',
    orderPublicId: p.order?.public_id ?? null,
  }));

  // Decorate each payment with the DECISIVE-MATCH verdict (reference contains
  // the order code AND this single transfer fully reconciles the gross owed —
  // computed by the same pure predicate the server re-checks on approve). Only
  // PENDING rows can be clean matches. Surface clean matches first so the admin
  // clears the safe ones fastest, then batch-approve or one-click them.
  //
  // ── SAME-DAY FIRST (owner 2026-08-02) ─────────────────────────────────────
  // "have an emergency purchase part if the event day is the day itself. these
  // will be priority." A 24-hour SLA is a fine promise on an ordinary order and
  // a broken product on a same-day one — the party ends before anyone looks. So
  // an order for an event happening TODAY jumps the whole queue, above even a
  // clean match, because a clean match on next month's wedding can wait and this
  // cannot. Read here rather than joined so a failure costs the ORDERING only.
  const decorated = payments.map((p) => ({
    p,
    sameDay: sameDayOrderIds.has(p.order_id),
    decisive:
      p.status === 'pending' &&
      isDecisivePaymentMatch({
        referenceNumber: p.reference_number,
        referenceCode: p.order?.reference_code ?? null,
        amountPhp: p.amount_php,
        requestedTotalPhp: p.order?.requested_total_php ?? null,
        confirmedTotalPhp: p.order?.confirmed_total_php ?? null,
        voucherDiscountPhp:
          p.order?.voucher_discount_centavos != null
            ? Number(p.order.voucher_discount_centavos) / 100
            : 0,
        serviceKey: p.order?.service_key ?? null,
      }),
  }));
  // Stable sort, two keys in priority order: TODAY's events first (the clock is
  // the constraint), then clean matches (speed of clearing). Stable, so anything
  // tied keeps the created_at order the query already applied.
  const ordered = [...decorated].sort(
    (a, b) => Number(b.sameDay) - Number(a.sameDay) || Number(b.decisive) - Number(a.decisive),
  );
  const totalCleanMatches = decorated.filter((d) => d.decisive).length;
  const totalSameDay = decorated.filter((d) => d.sameDay && d.p.status === 'pending').length;

  return (
    <>
      <InboxMatcher payments={matcherRows} />
      {/* The clock, before the list. An admin scanning this page needs to know a
          party is happening RIGHT NOW before they start working top-down — the
          ordering already put these first, but a count says why. */}
      {totalSameDay > 0 ? (
        <p className="mb-3 rounded-xl border-2 border-terracotta bg-terracotta/5 px-3 py-2 text-sm font-medium text-ink">
          {totalSameDay === 1
            ? '1 pending payment is for an event happening TODAY — confirm it first.'
            : `${totalSameDay} pending payments are for events happening TODAY — confirm those first.`}
        </p>
      ) : null}
      <BatchApproveBar action={batchApprovePayments} totalCleanMatches={totalCleanMatches} />
      <div className="sn-tile">
      <ul className="space-y-3">
      {ordered.map(({ p, decisive, sameDay }) => {
        // Did the couple put OUR order code in their transfer note?
        //
        // ⚠ Since the per-order payment QR shipped (2026-07-31) this is rarely
        // true and its absence is NOT a red flag. A scanned-QR payment goes out
        // through GCash Express Send with no note we can see, and the code
        // cannot ride inside the QR either — GCash rejects the EMVCo tag 62
        // template outright. So a QR payer has no way to carry it.
        //
        // It still fires for MANUAL transfers, where the payer types a note.
        // The label below therefore reports what this actually is — a bonus
        // signal when present — instead of implying something is wrong when
        // it is absent, which would train the admin to ignore the badge.
        const noteCarriesOrderCode =
          !!p.reference_number &&
          !!p.order?.reference_code &&
          p.reference_number.toUpperCase().includes(p.order.reference_code.toUpperCase());
        return (
          <li
            key={p.payment_id}
            id={`payment-${p.payment_id}`}
            className={`sn-row scroll-mt-20 space-y-3 p-4${
              sameDay ? ' ring-2 ring-terracotta' : decisive ? ' ring-1 ring-success-300/70' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                  Order {p.order?.public_id ?? '—'} · ref{' '}
                  <span className="text-terracotta-700">{p.order?.reference_code ?? '—'}</span>
                </p>
                <p className="text-sm font-semibold text-ink">{buyerLabel(p.user?.email, p.user_id)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    PAYMENT_STATUS_TONE[p.status]
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[p.status]}
                </span>
                {sameDay ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-terracotta-700 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-cream">
                    Event today
                  </span>
                ) : null}
                {decisive ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-700 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-cream">
                      Clean match
                    </span>
                    <BatchApproveCheckbox paymentId={p.payment_id} />
                  </>
                ) : null}
              </div>
            </div>

            {p.order?.description ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{p.order.description}</p>
                {p.order.service_key ? (
                  <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                    {p.order.service_key}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Amount" value={formatPhp(p.amount_php)} />
              <Stat label="Channel" value={p.channel} />
              <Stat
                label="Platform"
                value={
                  p.order?.platform === 'ios'
                    ? 'iOS app'
                    : p.order?.platform === 'android'
                      ? 'Android app'
                      : 'Web'
                }
              />
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
                {noteCarriesOrderCode ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--sn-success-soft)] px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[color:var(--sn-success)]">
                    Order code in note
                  </span>
                ) : p.reference_number ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--sn-neutral-soft,var(--sn-warning-soft))] px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink/60">
                    Check their ref in your app
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--sn-warning-soft)] px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[color:var(--sn-warning)]">
                    No reference given
                  </span>
                )}
              </p>
            ) : null}

            {p.screenshot_url && screenshotUrlMap[p.payment_id] ? (
              <div className="space-y-1">
                <a
                  href={screenshotUrlMap[p.payment_id]}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotUrlMap[p.payment_id]}
                    alt="Payment screenshot"
                    className="max-h-64 w-auto rounded-md border border-ink/10 object-contain"
                  />
                </a>
                <a
                  href={screenshotUrlMap[p.payment_id]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-mulberry hover:underline"
                >
                  Open full size
                  <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                </a>
              </div>
            ) : null}

            {p.status === 'pending' ? (
              <div className="space-y-2 border-t border-ink/10 pt-3">
                {decisive ? (
                  /*
                    ONE-CLICK APPROVE — decisive clean match only (reference code
                    present AND the transfer fully covers the amount owed). No
                    confirm modal: this is a single click on a row the admin has
                    reviewed. It still runs the SAME approvePayment → shortfall
                    guard → provisioning path (promote_order forced on because a
                    clean match fully reconciles); if the amount ever fails to
                    reconcile at write time the guard refuses to promote. Non-
                    clean rows below keep the full confirm modal.
                  */
                  <form action={approvePayment} className="space-y-1">
                    <input type="hidden" name="payment_id" value={p.payment_id} />
                    <input type="hidden" name="promote_order" value="on" />
                    <SubmitButton
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-success-700 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-success-800 disabled:opacity-70"
                      pendingLabel="Approving…"
                    >
                      One-click approve · clean match
                    </SubmitButton>
                    <p className="text-[11px] text-ink/50">
                      Reference matches and the amount fully covers what&rsquo;s owed. Confirm the
                      transfer in your inbox first.
                    </p>
                  </form>
                ) : (
                  <ConfirmForm
                    action={approvePayment}
                    title="Approve this payment?"
                    confirmLabel="Approve · matched"
                    destructive={false}
                    message="This marks the payment matched (and, if checked, the order paid) — it issues the receipt, unlocks the couple's purchase, and releases the vendor payout. Approve only after you've confirmed the transfer in the bank/GCash inbox."
                    className="space-y-2"
                  >
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
                    {/*
                      Unticked by default, and only ever meaningful after the
                      admin has been REFUSED once and read the warning naming
                      the other order. 🔑 It cannot unlock the same-order case —
                      one transfer counted twice against one bill is refused in
                      the core no matter what this box says, because the
                      shortfall guard would add it up into a false "fully paid".
                    */}
                    <label className="flex items-center gap-2 text-xs text-ink/65">
                      <input
                        type="checkbox"
                        name="acknowledge_duplicate"
                        className="h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      One transfer really covers two orders — I checked the bank
                    </label>
                    <SubmitButton
                      className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-success-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-success-800 disabled:opacity-70"
                      pendingLabel="Approving…"
                    >
                      Approve · matched
                    </SubmitButton>
                  </ConfirmForm>
                )}
                {/*
                  Day 3 of the voucher + inline-checkout sprint (CLAUDE.md
                  2026-05-29 Day 3 row): "Request resubmit" middle path. Use
                  this when the screenshot is unclear, the reference code is
                  missing, or the amount doesn't match — the couple can
                  re-upload from the order detail page without starting over.
                  The notice is required + emailed verbatim to the couple.
                */}
                <form action={requestPaymentResubmit} className="space-y-2">
                  <input type="hidden" name="payment_id" value={p.payment_id} />
                  <textarea
                    name="admin_resubmit_notice"
                    placeholder="What does the couple need to fix? (e.g. screenshot is blurry, reference code missing from notes)"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={2}
                    className="input-field min-h-[60px] py-2 text-sm"
                  />
                  <SubmitButton
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-warn-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-warn-800 disabled:opacity-70"
                    pendingLabel="Requesting resubmit…"
                  >
                    Request resubmit
                  </SubmitButton>
                </form>
                <ConfirmForm
                  action={rejectPayment}
                  title="Reject this payment?"
                  confirmLabel="Reject"
                  message="This rejects the payment and CANCELS the linked order — the couple loses any access it unlocked and is notified with your reason. For a 'needs more proof' case use Request resubmit instead."
                  className="space-y-2"
                >
                  <input type="hidden" name="payment_id" value={p.payment_id} />
                  <input
                    name="admin_notes"
                    placeholder="Why is this rejected? (e.g. amount mismatch)"
                    className="input-field h-9 py-0 text-sm"
                  />
                  <SubmitButton
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-danger-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-danger-800 disabled:opacity-70"
                    pendingLabel="Rejecting…"
                  >
                    Reject
                  </SubmitButton>
                </ConfirmForm>
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

            {/*
              Surface the existing admin_resubmit_notice when the payment is
              in 'resubmit_requested' state so a follow-up admin reviewer (or
              the same reviewer on a fresh page load) sees the context for why
              the couple was asked to re-upload. Distinct from the admin_notes
              line below (which surfaces for matched / rejected payments).
            */}
            {p.status === 'resubmit_requested' && p.admin_resubmit_notice ? (
              <div className="rounded-md border border-[color:var(--sn-warning)] bg-[var(--sn-warning-soft)] p-3 text-xs text-[color:var(--sn-warning)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  Resubmit notice sent to couple
                </p>
                <p className="mt-1 whitespace-pre-wrap">{p.admin_resubmit_notice}</p>
                {p.reviewed_at ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                    Requested {p.reviewed_at.slice(0, 10)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {p.status !== 'pending' && p.status !== 'resubmit_requested' && p.admin_notes ? (
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
      </div>
    </>
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
      <summary className="cursor-pointer text-xs font-medium text-ink/70 hover:text-ink">
        Record a refund for order {orderPublicId}
      </summary>
      <ConfirmForm
        action={refundOrder}
        title="Record this refund?"
        confirmLabel="Record refund · notify couple"
        message="This permanently marks the order refunded, revokes any access it granted, writes an audit row, and notifies the couple. Send the reverse transfer first — this can't be undone here."
        className="mt-2 space-y-2"
      >
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
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sn-gold-500)] focus-visible:ring-offset-2 disabled:opacity-70"
          pendingLabel="Recording refund…"
        >
          Record refund · notify couple
        </SubmitButton>
      </ConfirmForm>
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


/**
 * Which of these payments belong to an event happening TODAY (Manila)?
 *
 * One batched read keyed on the orders already on screen — never a per-row
 * query, and never a join that could drop rows if it failed. Returns order_ids
 * rather than event_ids so the caller matches on what it already holds.
 *
 * Degrades to an EMPTY set on any failure: losing the same-day jump costs the
 * queue its ordering, which an admin can still work around by reading the event
 * date on the row. Throwing here would take down the payments console itself.
 */
async function fetchSameDayOrderIds(
  admin: ReturnType<typeof createAdminClient>,
  payments: readonly PaymentJoined[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const byEvent = new Map<string, string[]>();
  for (const p of payments) {
    const eid = p.order?.event_id ?? null;
    if (!eid) continue;
    const list = byEvent.get(eid);
    if (list) list.push(p.order_id);
    else byEvent.set(eid, [p.order_id]);
  }
  if (byEvent.size === 0) return out;
  try {
    const { data, error } = await admin
      .from('events')
      .select('event_id, event_date')
      .in('event_id', [...byEvent.keys()]);
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      const date = (row as { event_date?: string | null }).event_date ?? null;
      if (!isSameDayInManila(date)) continue;
      for (const oid of byEvent.get(String((row as { event_id?: unknown }).event_id ?? '')) ?? []) {
        out.add(oid);
      }
    }
    return out;
  } catch {
    return out;
  }
}
