/**
 * desk.tsx — what Admin › Money › Payments DRAWS (admin drawing 2026-11-13, `money` · `money-quotes` · `pay`).
 *
 * The page (`../page.tsx`) does every read and hands the results here; this module only renders them, so the
 * fixture lab (`app/dev/admin-money-lab`) can draw the same desk — busy, empty, failed, and one payment opened —
 * at 390 and 1280 without a database. Nothing in here reads or decides: the decisive-match verdict, the duplicate
 * verdict and the bill come from the same pure helpers the server re-checks on approve.
 */
import Link from 'next/link';
import { paymentWasLogged } from '@/lib/payment-logged';
import { ProofImage } from '@/app/_components/proof-image';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { InboxMatcher, type MatcherPayment } from './inbox-matcher';
import { BatchApproveBar, BatchApproveCheckbox } from './batch-approve-controls';
import { RemedyReasonRow } from './remedy-reason-row';
import { FormPick } from '../../work/_components/form-pick';
import { FormDate } from './form-date';
import { manilaTodayISO } from '@/lib/event-board';
import { Fold } from '@/app/_components/fold';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import {
  TEMPLATE_MONEY,
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateNums,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { ChevronLeft, Clock } from 'lucide-react';
import { ageShort } from '@/lib/admin/queue-counts';
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
import { ONBOARDING_SERVICES_SKU } from '@/lib/onboarding-order-items';
import { summarizeDeskMoney, type DeskBillLine } from '@/lib/admin-payment-desk';
import type { EventTypeName } from '@/lib/admin/event-type-names.server';
import { formatEventDate } from '@/lib/events';
import {
  approvePayment,
  batchApprovePayments,
  confirmOrderTotal,
  refundOrder,
  rejectPayment,
  requestPaymentResubmit,
  rereadPaymentReceipt,
} from '../actions';
import {
  channelLabel,
  type ChannelSettings,
  type ReceivingAccount,
} from '@/lib/payment-channels';
import { canLogPaymentAgainstOrder } from '@/lib/order-promotion-rule';
import { randomUUID } from 'node:crypto';
import { computeVatFromBase } from '@/lib/receipts';
import { formatCount } from '@/lib/format-number';
import type { RemedyDesk, RemedyDeskRow } from '@/lib/admin/service-remedies.server';

export type Filter = 'pending' | 'all' | 'orders_needing_quote';

/** One row of `payment_receipt_reads` — advisory, see the migration's header. */
export type ReceiptReadRow = {
  payment_id: string;
  status: 'ok' | 'unreadable' | 'failed';
  reference_matches: boolean | null;
  amount_matches: boolean | null;
  seen_references: string[] | null;
  seen_amounts: number[] | null;
  summary: string | null;
  error: string | null;
  created_at: string;
};

export type PaymentJoined = {
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

export type OrderJoined = {
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
export function buyerLabel(email: string | null | undefined, userId: string | null | undefined): string {
  if (email) return email;
  return userId ? '—' : 'Guest · no account';
}

export type DeskAddress = { filter: Filter; platform: string | null; q: string };

export const PLATFORM_WORD: Readonly<Record<'all' | 'web' | 'ios' | 'android', string>> = {
  all: 'All',
  web: 'Web',
  ios: 'iOS app',
  android: 'Android app',
};

export function deskHref(at: DeskAddress & { open?: string }): string {
  const sp = new URLSearchParams();
  if (at.filter !== 'pending') sp.set('filter', at.filter);
  if (at.platform) sp.set('platform', at.platform);
  if (at.q) sp.set('q', at.q);
  if (at.open) sp.set('open', at.open);
  const s = sp.toString();
  return s ? `/admin/payments?${s}` : '/admin/payments';
}


/**
 * The desk's head (admin drawing 2026-11-13): the three shipped filters as one segmented control (≤3 sections, T2),
 * the search over any number a person might quote at you, and `Platform ▾` — the one picker, never a chip strip.
 */
export function DeskHead({ here }: { here: DeskAddress }) {
  const filter = here.filter;
  return (
    <>
      {/* The three shipped filters (`?filter=`) — ≤3 sections, so the
          drawing's rule allows one segmented control (T2). */}
      <nav aria-label="Which payments" className="sn-seg mt-1" data-payments-filter="">
        {(
          [
            ['pending', 'To confirm'],
            ['all', 'All payments'],
            ['orders_needing_quote', 'Needs a quote'],
          ] as const
        ).map(([target, label]) => (
          <Link
            key={target}
            href={deskHref({ ...here, filter: target, q: '' })}
            aria-current={filter === target ? 'page' : undefined}
            className="sn-seg-item"
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Find one payment by any number a person might quote at you: the
          reference code from their email, our internal order id, or the bank
          reference they typed off their own receipt. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form method="get" className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
          {filter ? <input type="hidden" name="filter" value={filter} /> : null}
          {here.platform ? <input type="hidden" name="platform" value={here.platform} /> : null}
          <label htmlFor="payment-search" className="sr-only">
            Search by order reference, order id, or bank reference
          </label>
          <input
            id="payment-search"
            type="search"
            name="q"
            defaultValue={here.q}
            placeholder="Reference code, order id, or bank reference"
            className="sn-input min-h-11 min-w-0 flex-1"
          />
          <button type="submit" className="ab ab-brand">
            Search
          </button>
          {here.q ? (
            <Link href={deskHref({ ...here, q: '' })} className="ab ab-neutral" prefetch={false}>
              Clear
            </Link>
          ) : null}
        </form>
        {filter !== 'orders_needing_quote' ? (
          <LinkPickMenu
            label="Platform"
            value={here.platform ?? 'all'}
            buttonText={`Platform · ${PLATFORM_WORD[(here.platform ?? 'all') as keyof typeof PLATFORM_WORD]}`}
            dataAttr="payments-platform"
            options={(['all', 'web', 'ios', 'android'] as const).map((k) => ({
              key: k,
              label: PLATFORM_WORD[k],
              href: deskHref({ ...here, platform: k === 'all' ? null : k }),
            }))}
          />
        ) : null}
      </div>

      {here.q ? (
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          Showing matches for <b className="text-ink">{here.q}</b>. A search looks past the newest 100 rows.
        </p>
      ) : null}
    </>
  );
}

/** `null` = that read was refused — the number prints "—", never 0. */
export type DeskNumsRead = { receivedWeekPhp: number | null; toConfirm: number | null };

/** `sameDay: null` = the list itself was not read, so how many are for today is not known either. */
export function DeskNums({ nums, sameDay }: { nums: DeskNumsRead; sameDay: number | null }) {
  return (
    <TemplateNums
      items={[
        nums.receivedWeekPhp === null
          ? { label: 'Received this week · couldn’t read', value: '—', tone: 'warn' }
          : { label: 'Received this week', value: formatPhp(nums.receivedWeekPhp), tone: 'ok' },
        nums.toConfirm === null
          ? { label: 'To confirm · couldn’t count', value: '—', tone: 'warn' }
          : { label: 'To confirm', value: formatCount(nums.toConfirm), tone: nums.toConfirm > 0 ? 'danger' : undefined },
        sameDay === null
          ? { label: 'Event today · couldn’t read', value: '—', tone: 'warn' }
          : { label: 'Event today', value: formatCount(sameDay), tone: sameDay > 0 ? 'warn' : undefined },
      ]}
    />
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
export function OrdersNeedingQuote({
  orders,
  vatRatePct,
  readFailed,
  query,
}: {
  orders: OrderJoined[];
  vatRatePct: number;
  /** Which read was refused, if any — see `readFailed` in the page. */
  readFailed: 'queue' | 'search' | null;
  /** The search term as typed, for the no-match line. */
  query: string;
}) {
  const vatApplies = vatRatePct > 0;
  const retry = `/admin/payments?filter=orders_needing_quote${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  if (readFailed) return <ReadFailedNotice which={readFailed} retryHref={retry} />;
  if (orders.length === 0) {
    return (
      <TemplateSection label="Orders needing a quote" right="0" data="payments-quotes">
        <TemplateEmpty data="payments-quotes">
          {query ? `No order matches “${query}”.` : 'No orders waiting for a quote.'}
        </TemplateEmpty>
      </TemplateSection>
    );
  }
  return (
    <TemplateSection
      label="Orders needing a quote"
      right={formatCount(orders.length)}
      tip="Orders submitted without a fixed price — the oldest 100. Confirm the total and the order moves to awaiting payment."
      data="payments-quotes"
    >
      <TemplateRows label="Orders needing a quote">
        {orders.map((o) => (
          <li key={o.order_id} data-template-row="quote" className="py-2">
            <div className="flex min-h-14 items-center gap-2.5">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold leading-tight text-ink">
                  {o.public_id} · {buyerLabel(o.user?.email, o.user_id)}
                </b>
                <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>
                  ref {o.reference_code} · {vatApplies ? 'Requested (pre-VAT): ' : 'Buyer pays: '}
                  {formatPhp(o.requested_total_php)}
                  {vatApplies ? (
                    <>
                      {' · '}buyer pays {formatPhp(computeVatFromBase(Number(o.requested_total_php), vatRatePct).gross)} incl.{' '}
                      {vatRatePct}% VAT
                    </>
                  ) : null}
                </span>
              </span>
              <span className={`flex-none rounded-full px-2 py-0.5 text-[12px] font-semibold ${ORDER_STATUS_TONE[o.status]}`}>
                {ORDER_STATUS_LABEL[o.status]}
              </span>
            </div>
            <p className={`whitespace-pre-wrap ${TEMPLATE_SUBLINE}`}>{o.description}</p>
            <Fold title="Confirm total" line="Moves it to awaiting payment" data="payments-quote-confirm">
              <form action={confirmOrderTotal} className="space-y-2">
                <input type="hidden" name="order_id" value={o.order_id} />
                <label className="block space-y-1 text-[14px] text-ink">
                  {vatApplies ? 'Confirmed pre-VAT total (PHP)' : 'Confirmed total (PHP)'}
                  <input
                    name="confirmed_total_php"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={String(o.requested_total_php)}
                    required
                    className="sn-input min-h-11 w-full tabular-nums"
                  />
                  <span className={`block ${TEMPLATE_SUBLINE}`}>
                    {vatApplies ? `Buyer pays this plus ${vatRatePct}% VAT` : 'This is exactly what the buyer pays'}
                  </span>
                </label>
                <label className="block space-y-1 text-[14px] text-ink">
                  Note to couple
                  <input
                    name="admin_notes"
                    placeholder="Inclusions, terms, payment instructions"
                    className="sn-input min-h-11 w-full"
                  />
                </label>
                <SubmitButton className="ab ab-brand ab-main w-full" pendingLabel="Confirming…">
                  Confirm quote · move to awaiting payment
                </SubmitButton>
              </form>
            </Fold>
          </li>
        ))}
      </TemplateRows>
    </TemplateSection>
  );
}

/**
 * Rendered INSTEAD of an empty state when the read behind it was refused — an
 * empty queue and an unread queue must never look alike on a money desk.
 */
export function ReadFailedNotice({ which, retryHref }: { which: 'queue' | 'search'; retryHref: string }) {
  return (
    <TemplateFail retryHref={retryHref} data={`payments-${which}`}>
      {which === 'search'
        ? 'The search couldn’t run — this is not “no match”. Refresh to try again.'
        : 'Couldn’t load this — refresh to try again. This is not an empty queue.'}
    </TemplateFail>
  );
}

export type Decorated = {
  p: PaymentJoined;
  sameDay: boolean;
  dup: CardDuplicate | null;
  decisive: boolean;
};

/**
 * Decorate each payment with the DECISIVE-MATCH verdict (reference contains the
 * order code AND this single transfer fully reconciles the gross owed — computed
 * by the same pure predicate the server re-checks on approve). Only PENDING rows
 * can be clean matches.
 *
 * ⛔ `receiptReads` is NOT an argument: the AI read is rendered, never consulted
 * (`lib/an-ai-may-not-approve-money.test.ts`).
 */
export function decoratePayments(
  payments: readonly PaymentJoined[],
  sameDayOrderIds: Set<string>,
  dupExposure: DuplicateExposureResult,
): Decorated[] {
  return payments.map((p) => {
    // A reference collision known BEFORE the click. Computed with the same
    // rule approvePaymentCore consults, so the card and the refusal agree.
    const dup = p.status === 'pending' ? (dupExposure.byPaymentId.get(p.payment_id) ?? null) : null;
    return {
      p,
      sameDay: sameDayOrderIds.has(p.order_id),
      dup,
      decisive:
        p.status === 'pending' &&
        // A collided row is never one-click/batch material — the core would
        // refuse or warn anyway; sending it through the full confirm form is
        // what puts the informed acknowledgement in front of the admin.
        dup === null &&
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
    };
  });
}

/** What the buyer bought, in a person's words (never the raw machine code when a title exists). */
export function whatTheyBought(p: PaymentJoined, deskBills: Map<string, DeskBill>): string {
  if (!p.order) return 'Order not found';
  if (p.order.service_key === ONBOARDING_SERVICES_SKU) return 'Bought while creating their event';
  const bill = deskBills.get(p.order_id);
  if (bill?.kind === 'single') return bill.line.label;
  return p.order.description || p.order.service_key || 'An order';
}

/** The money verdict for one row — the SAME figure the approval guard checks. */
export function rowVerdict(p: PaymentJoined, deskBills: Map<string, DeskBill>): { text: string; bad: boolean } | null {
  if (!p.order) return null;
  const bill = deskBills.get(p.order_id) ?? { kind: 'none' as const };
  if (bill.kind === 'unreadable') return { text: 'Could not read what’s on this bill', bad: true };
  const lines: DeskBillLine[] = bill.kind === 'lines' ? bill.lines : bill.kind === 'single' ? [bill.line] : [];
  const money = summarizeDeskMoney({
    lines,
    requestedTotalPhp: p.order.requested_total_php,
    confirmedTotalPhp: p.order.confirmed_total_php,
    voucherDiscountCentavos: p.order.voucher_discount_centavos,
    serviceKey: p.order.service_key,
    transferredPhp: p.amount_php,
  });
  if (money.verdict === 'exact') return { text: 'Covers the amount to send exactly', bad: false };
  if (money.verdict === 'short') return { text: `${formatPhp(Math.abs(money.deltaPhp))} short of the amount to send`, bad: true };
  return { text: `${formatPhp(money.deltaPhp)} more than the amount to send`, bad: true };
}

/** The section each payment status lands in, in the order they are drawn. */
export const STATUS_SECTIONS: ReadonlyArray<{ status: PaymentStatus; label: string }> = [
  { status: 'pending', label: 'To confirm' },
  { status: 'resubmit_requested', label: 'Resubmit requested' },
  { status: 'matched', label: 'Matched' },
  { status: 'rejected', label: 'Rejected' },
];

export function PaymentsList({
  payments,
  here,
  sameDayOrderIds,
  receiptReads,
  deskBills,
  dupExposure,
  channelSettings,
  readFailed,
  query,
}: {
  /** 🏷 F-A-15: an event type's admin-managed name (the opened payment uses it). */
  typeName: EventTypeName;
  /** Where the desk is — each row opens its payment on top of it. */
  here: DeskAddress;
  /** The receiving-accounts list, so a payment's channel id prints as its NAME. */
  channelSettings: ChannelSettings;
  /** Which read was refused, if any — see `readFailed` in the page. */
  readFailed: 'queue' | 'search' | null;
  /** The search term as typed, for the no-match line. */
  query: string;
  payments: PaymentJoined[];
  /** Itemised bill per order_id — see fetchDeskBills. */
  deskBills: Map<string, DeskBill>;
  /** Reference collisions per pending payment_id — see fetchDuplicateExposure. */
  dupExposure: DuplicateExposureResult;
  /**
   * order_ids whose event is TODAY in Manila — a SET of ids rather than a
   * boolean per row so the list and the count in the banner cannot disagree.
   */
  sameDayOrderIds: Set<string>;
  /**
   * Map of payment_id → the NEWEST advisory read of that payment's screenshot.
   * ⛔ RENDERED, NEVER CONSULTED. `decisive` is computed without it and a guard
   * pins that: `lib/an-ai-may-not-approve-money.test.ts`.
   */
  receiptReads: Record<string, ReceiptReadRow>;
}) {
  if (readFailed) return <ReadFailedNotice which={readFailed} retryHref={deskHref(here)} />;
  if (payments.length === 0) {
    return (
      <TemplateSection label="To confirm" right="0">
        <TemplateEmpty data="payments">{query ? `No payment matches “${query}”.` : 'Nothing to reconcile.'}</TemplateEmpty>
      </TemplateSection>
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
    href: deskHref({ ...here, open: p.payment_id }),
  }));

  const decorated = decoratePayments(payments, sameDayOrderIds, dupExposure);
  // ── SAME-DAY FIRST (owner 2026-08-02) ─────────────────────────────────────
  // "have an emergency purchase part if the event day is the day itself. these
  // will be priority." An order for an event happening TODAY jumps the whole
  // queue, above even a clean match. Stable sort, two keys in priority order:
  // TODAY's events first (the clock is the constraint), then clean matches
  // (speed of clearing); ties keep the created_at order the query applied.
  const ordered = [...decorated].sort(
    (a, b) => Number(b.sameDay) - Number(a.sameDay) || Number(b.decisive) - Number(a.decisive),
  );
  const totalCleanMatches = decorated.filter((d) => d.decisive).length;
  const totalSameDay = decorated.filter((d) => d.sameDay && d.p.status === 'pending').length;
  const nowMs = Date.now();

  return (
    <>
      <div className="mt-3">
        <Fold title="Match a notification" line="Paste the SMS or app alert" data="payments-matcher">
          <InboxMatcher payments={matcherRows} />
        </Fold>
      </div>
      {/* The clock, before the list. An admin scanning this page needs to know a
          party is happening RIGHT NOW before they start working top-down — the
          ordering already put these first, but a count says why. */}
      {totalSameDay > 0 ? (
        <p
          role="status"
          className="mt-3 flex min-h-11 items-center gap-2 text-[14px] font-semibold"
          style={{ color: 'rgb(var(--color-warn))' }}
        >
          <Clock aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
          {totalSameDay === 1
            ? '1 pending payment is for an event happening TODAY — confirm it first.'
            : `${formatCount(totalSameDay)} pending payments are for events happening TODAY — confirm those first.`}
        </p>
      ) : null}
      <div className="mt-3">
        <BatchApproveBar action={batchApprovePayments} totalCleanMatches={totalCleanMatches} />
      </div>
      {STATUS_SECTIONS.map(({ status, label }, i) => {
        const rows = ordered.filter((d) => d.p.status === status);
        if (rows.length === 0) return null;
        return (
          <TemplateSection
            key={status}
            label={label}
            first={i === 0}
            right={formatCount(rows.length)}
            tip={
              status === 'pending'
                ? 'Same-day events first, then clean matches, then newest. The newest 100 payments — a search looks past them.'
                : undefined
            }
            data={`payments-${status}`}
          >
            <TemplateRows label={label}>
              {rows.map((d) => (
                <PaymentRow
                  key={d.p.payment_id}
                  d={d}
                  openHref={deskHref({ ...here, open: d.p.payment_id })}
                  query={query}
                  what={whatTheyBought(d.p, deskBills)}
                  channel={channelLabel(channelSettings, d.p.channel)}
                  verdict={rowVerdict(d.p, deskBills)}
                  read={receiptReads[d.p.payment_id]}
                  age={ageShort(d.p.created_at, nowMs)}
                />
              ))}
            </TemplateRows>
          </TemplateSection>
        );
      })}
    </>
  );
}

/**
 * One payment, one line (admin drawing 2026-11-13 · T18 `na()`): who · how much,
 * what · how · which reference · how long ago, the money verdict — and ONE
 * action. A clean match confirms in the row; anything that needs judgement
 * opens the payment, where every fact and every action of the old card lives.
 */
export function PaymentRow({
  d,
  openHref,
  query,
  what,
  channel,
  verdict,
  read,
  age,
}: {
  d: Decorated;
  openHref: string;
  query: string;
  what: string;
  channel: string;
  verdict: { text: string; bad: boolean } | null;
  read: ReceiptReadRow | undefined;
  age: string | null;
}) {
  const { p, decisive, sameDay, dup } = d;
  const ref = p.reference_number ? `ref ···${p.reference_number.slice(-4)}` : 'no reference given';
  const aiSays =
    read?.status === 'ok'
      ? read.reference_matches === false || read.amount_matches === false
        ? { text: 'AI read: their screenshot disagrees', bad: true }
        : read.reference_matches === true
          ? { text: 'AI read: reference on the screenshot', bad: false }
          : null
      : null;
  const third = decisive
    ? { text: 'Clean match · ref + amount', bad: false }
    : dup
      ? { text: dup.kind === 'same_order' ? 'Reference already counted on this order' : 'Reference counted on another order', bad: true }
      : (verdict ?? aiSays);
  return (
    <li id={`payment-${p.payment_id}`} data-template-row="payment" className="scroll-mt-24">
      <div className={`flex w-full items-center gap-2.5 py-2 ${p.status === 'pending' ? 'min-h-16' : 'min-h-14'}`}>
        {p.status === 'pending' ? (
          <i
            aria-hidden
            data-template-edge={sameDay ? 'late' : 'due'}
            className="block h-9 w-1 flex-none rounded-sm"
            style={{ background: sameDay ? 'rgb(var(--color-danger))' : 'var(--m-orange)' }}
          />
        ) : null}
        {decisive ? <BatchApproveCheckbox paymentId={p.payment_id} /> : null}
        <Link href={openHref} prefetch={false} className="sn-press min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold leading-tight text-ink">
            {buyerLabel(p.user?.email, p.user_id)} · <span className={TEMPLATE_MONEY}>{formatPhp(p.amount_php)}</span>
          </b>
          <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>
            {[what, channel, ref, sameDay && p.status === 'pending' ? 'Event today' : age].filter(Boolean).join(' · ')}
          </span>
          {third ? (
            <span
              className="mt-0.5 block truncate text-[13px] font-medium"
              style={{ color: `rgb(var(--color-${third.bad ? 'warn' : 'ok'}))` }}
            >
              {third.text}
            </span>
          ) : null}
        </Link>
        {p.status === 'pending' && decisive ? (
          /*
            ONE-CLICK APPROVE — decisive clean match only (reference code present
            AND the transfer fully covers the amount owed). It still runs the SAME
            approvePayment → shortfall guard → provisioning path (promote_order
            forced on because a clean match fully reconciles); if the amount ever
            fails to reconcile at write time the guard refuses to promote.
          */
          <form action={approvePayment} className="flex-none">
            <input type="hidden" name="payment_id" value={p.payment_id} />
            <input type="hidden" name="q" value={query} />
            <input type="hidden" name="promote_order" value="on" />
            <SubmitButton
              className="ab ab-ok ab-main"
              pendingLabel="Approving…"
              aria-label="One-click approve · clean match. Reference matches and the amount fully covers what’s owed — confirm the transfer in your inbox first."
            >
              Confirm
            </SubmitButton>
          </form>
        ) : p.status === 'pending' ? (
          <Link href={openHref} prefetch={false} className="ab ab-neutral flex-none">
            Open
          </Link>
        ) : (
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[12px] font-semibold ${PAYMENT_STATUS_TONE[p.status]}`}
          >
            {PAYMENT_STATUS_LABEL[p.status]}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * A PAYMENT, OPENED (admin drawing 2026-11-13 · `pay`): it rises over the desk
 * at `?open=<payment_id>` with every fact and every action the old card held —
 * the screenshot and what the reader saw on it, the facts, who and which event,
 * what the bill covers, the duplicate verdict, then the decision (Confirm ·
 * Ask to resubmit · Reject) on a pending payment, or the remedies (Convert ·
 * Move · Record a refund) on a paid one. Nothing was dropped, only moved here.
 */
export function OpenedPayment({
  payment,
  readFailed,
  back,
  typeName,
  screenshotUrlMap,
  sameDayOrderIds,
  receiptReads,
  eventInfo,
  deskBills,
  dupExposure,
  remedyDesk,
  channelSettings,
  query,
}: {
  payment: PaymentJoined | null;
  readFailed: 'queue' | 'search' | null;
  back: string;
  typeName: EventTypeName;
  screenshotUrlMap: Record<string, string>;
  sameDayOrderIds: Set<string>;
  /** ⛔ RENDERED, NEVER CONSULTED (`lib/an-ai-may-not-approve-money.test.ts`). */
  receiptReads: Record<string, ReceiptReadRow>;
  eventInfo: OrderEventInfoResult;
  deskBills: Map<string, DeskBill>;
  dupExposure: DuplicateExposureResult;
  remedyDesk: RemedyDesk;
  channelSettings: ChannelSettings;
  query: string;
}) {
  const backLink = (
    <Link href={back} prefetch={false} className="ab ab-neutral quiet mt-1" data-payment-back="">
      <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
      Payments
    </Link>
  );
  if (readFailed) {
    return (
      <>
        {backLink}
        <ReadFailedNotice which="queue" retryHref={back} />
      </>
    );
  }
  if (!payment) {
    return (
      <>
        {backLink}
        <TemplateEmpty data="payment-gone">That payment no longer exists — it may have been removed. Go back to the list.</TemplateEmpty>
      </>
    );
  }
  const [d] = decoratePayments([payment], sameDayOrderIds, dupExposure) as [Decorated];
  const { p, decisive, sameDay, dup } = d;
  // Did the couple put OUR order code in their transfer note?
  //
  // ⚠ Since the per-order payment QR shipped (2026-07-31) this is rarely
  // true and its absence is NOT a red flag. A scanned-QR payment goes out
  // through GCash Express Send with no note we can see, and the code cannot
  // ride inside the QR either — GCash rejects the EMVCo tag 62 template
  // outright. It still fires for MANUAL transfers, where the payer types a
  // note, so the label reports a bonus signal when present instead of
  // implying something is wrong when it is absent.
  const noteCarriesOrderCode =
    !!p.reference_number &&
    !!p.order?.reference_code &&
    p.reference_number.toUpperCase().includes(p.order.reference_code.toUpperCase());
  const platformWord =
    p.order?.platform === 'ios' ? 'iOS app' : p.order?.platform === 'android' ? 'Android app' : 'Web';
  const serviceChip = p.order?.service_key
    ? p.order.service_key === ONBOARDING_SERVICES_SKU
      ? 'Bought while creating their event'
      : deskBills.get(p.order_id)?.kind === 'single'
        ? (deskBills.get(p.order_id) as Extract<DeskBill, { kind: 'single' }>).line.label
        : p.order.service_key
    : null;

  return (
    <article data-opened-payment={p.payment_id} className="sn-rise">
      {backLink}
      <header className="mt-2">
        <p className={TEMPLATE_SUBLINE}>
          Order {p.order?.public_id ?? '—'} · ref {p.order?.reference_code ?? '—'}
        </p>
        <h2 className="mt-0.5 text-[22px] font-bold leading-tight text-ink">
          {buyerLabel(p.user?.email, p.user_id)} · <span className={TEMPLATE_MONEY}>{formatPhp(p.amount_php)}</span>
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${PAYMENT_STATUS_TONE[p.status]}`}>
            {PAYMENT_STATUS_LABEL[p.status]}
          </span>
          {sameDay ? (
            <span className="rounded-full bg-terracotta-700 px-2 py-0.5 text-[12px] font-semibold text-cream">
              Event today
            </span>
          ) : null}
          {decisive ? (
            <span className="rounded-full bg-success-700 px-2 py-0.5 text-[12px] font-semibold text-cream">
              Clean match
            </span>
          ) : null}
        </p>
      </header>

      {/* ⬆ app/_components/proof-image.tsx — ONE component so no payment
          screen can drift back to a 48px thumbnail. `screenshotUrlMap` is
          presigned server-side under `paymentProofPolicy`; nothing about this
          render is public. */}
      {p.screenshot_url && screenshotUrlMap[p.payment_id] ? (
        <div className="mt-3">
          <ProofImage url={screenshotUrlMap[p.payment_id] as string} alt="Payment screenshot" />
        </div>
      ) : null}

      <ReceiptReadCard read={receiptReads[p.payment_id]} paymentId={p.payment_id} hasScreenshot={Boolean(p.screenshot_url)} />

      <TemplateSection label="The payment" data="payment-facts">
        <dl className="text-[15px] [&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
          {(
            [
              ['Amount', <span key="a" className={TEMPLATE_MONEY}>{formatPhp(p.amount_php)}</span>],
              ['Channel', channelLabel(channelSettings, p.channel)],
              ['Platform', platformWord],
              ['Reference', <span key="r" className="tabular-nums">{p.reference_number ?? '—'}</span>],
              // 🧾 RW-37: a bill's own placeholder row (no reference, no screenshot) is not a payment — say so.
              ['Paid', paymentWasLogged(p) ? p.paid_at : 'Nothing logged yet'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex min-h-10 items-baseline justify-between gap-3 py-1.5">
              <dt className="text-[color:var(--m-slate-2)]">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </TemplateSection>

      <TemplateSection label="Buyer · order" data="payment-order">
        <TemplateRows label="Buyer and order">
          <TemplateRow title={buyerLabel(p.user?.email, p.user_id)} line="Buyer" />
          {p.order?.description ? (
            <TemplateRow title={p.order.description} line={serviceChip ?? undefined} />
          ) : null}
          <li data-template-row="payment-event" className="py-2">
            <CelebrationLine
              eventId={p.order?.event_id ?? null}
              info={p.order?.event_id ? (eventInfo.byEventId.get(p.order.event_id) ?? null) : null}
              readFailed={eventInfo.failed}
              typeName={typeName}
            />
          </li>
          {p.order ? (
            /* The numbers live in the money block below, which quotes the SAME
               "amount to send" the approval guard checks. */
            <TemplateRow
              title={`Order status ${ORDER_STATUS_LABEL[p.order.status]}`}
              right={
                noteCarriesOrderCode ? (
                  <span className="rounded-full bg-[var(--sn-success-soft)] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--sn-success-deep)]">
                    Order code in note
                  </span>
                ) : p.reference_number ? (
                  <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--m-slate-2)]">
                    Check their ref in your app
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--sn-warning-soft)] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--sn-warning-deep)]">
                    No reference given
                  </span>
                )
              }
            />
          ) : null}
        </TemplateRows>
      </TemplateSection>

      {p.order ? (
        <DeskMoneyBlock bill={deskBills.get(p.order_id) ?? { kind: 'none' }} order={p.order} transferredPhp={p.amount_php} />
      ) : null}

      {/*
        Surface the existing admin_resubmit_notice when the payment is in
        'resubmit_requested' state so the next reviewer sees why the couple was
        asked to re-upload. Distinct from the admin_notes line below.
      */}
      {p.status === 'resubmit_requested' && p.admin_resubmit_notice ? (
        <TemplateSection label="Resubmit notice sent to couple" data="payment-resubmit-notice">
          <p className="whitespace-pre-wrap text-[14px] text-ink">{p.admin_resubmit_notice}</p>
          {p.reviewed_at ? <p className={TEMPLATE_SUBLINE}>Requested {p.reviewed_at.slice(0, 10)}</p> : null}
        </TemplateSection>
      ) : null}

      {p.status !== 'pending' && p.status !== 'resubmit_requested' && p.admin_notes ? (
        <TemplateSection label="Note" data="payment-note">
          <p className="text-[14px] text-ink">
            {p.admin_notes}
            {p.reviewed_at ? <span className={TEMPLATE_SUBLINE}> · reviewed {p.reviewed_at.slice(0, 10)}</span> : null}
          </p>
        </TemplateSection>
      ) : null}

      {p.status === 'pending' ? (
        <PendingDecision p={p} decisive={decisive} dup={dup} dupFailed={dupExposure.failed} query={query} />
      ) : p.order && (p.order.status === 'paid' || p.order.status === 'fulfilled') ? (
        <TemplateSection
          label="If they can’t use it"
          tip="A paid service they cannot use becomes Papic credits, or — unused — moves to their next event. Record a refund only for money you already sent back by hand (a double payment)."
          data="payment-remedies"
        >
          <ServiceRemedyForms
            orderId={p.order_id}
            orderPublicId={p.order.public_id}
            row={remedyDesk.byOrderId.get(p.order_id) ?? null}
            failed={remedyDesk.failed}
            query={query}
            closed={false}
          />
          <RefundForm
            orderId={p.order_id}
            orderPublicId={p.order.public_id}
            defaultAmountPhp={p.order.confirmed_total_php ?? p.order.requested_total_php}
          />
        </TemplateSection>
      ) : p.order && p.order.status === 'lapsed' ? (
        // Switched off — show what was done with it, no actions.
        <TemplateSection label="What was already done" data="payment-remedies">
          <ServiceRemedyForms
            orderId={p.order_id}
            orderPublicId={p.order.public_id}
            row={remedyDesk.byOrderId.get(p.order_id) ?? null}
            failed={remedyDesk.failed}
            query={query}
            closed
          />
        </TemplateSection>
      ) : null}
    </article>
  );
}

/**
 * The decision on a pending payment — Confirm (clean match: one press; anything
 * else: the full confirm with the note, "Also mark order as paid" and the
 * duplicate acknowledgement), Ask to resubmit, Reject. Each one asks first with
 * its consequence named, except the clean-match press and the resubmit request,
 * which never asked.
 */
export function PendingDecision({
  p,
  decisive,
  dup,
  dupFailed,
  query,
}: {
  p: PaymentJoined;
  decisive: boolean;
  dup: CardDuplicate | null;
  dupFailed: boolean;
  query: string;
}) {
  return (
    <TemplateSection
      label="Decide"
      tip="Confirm only after you’ve seen the transfer in the bank / GCash inbox."
      data="payment-decide"
    >
      {decisive ? (
        /*
          ONE-CLICK APPROVE — decisive clean match only. No confirm modal: this is
          a single click on a payment the admin has reviewed. It still runs the
          SAME approvePayment → shortfall guard → provisioning path.
        */
        <form action={approvePayment} className="space-y-1 py-2">
          <input type="hidden" name="payment_id" value={p.payment_id} />
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="promote_order" value="on" />
          <SubmitButton className="ab ab-ok ab-main w-full" pendingLabel="Approving…">
            One-click approve · clean match
          </SubmitButton>
          <p className={TEMPLATE_SUBLINE}>
            Reference matches and the amount fully covers what&rsquo;s owed. Confirm the transfer in your inbox first.
          </p>
        </form>
      ) : (
        <Fold title="Confirm" line="Approve · matched" data="payment-confirm" defaultOpen>
          <ConfirmForm
            action={approvePayment}
            title="Approve this payment?"
            confirmLabel="Approve · matched"
            destructive={false}
            message="This marks the payment matched (and, if checked, the order paid) — it issues the receipt, unlocks the couple's purchase, and releases the supplier payout. Approve only after you've confirmed the transfer in the bank/GCash inbox."
            className="space-y-2"
          >
            <input type="hidden" name="payment_id" value={p.payment_id} />
            <input type="hidden" name="q" value={query} />
            <input
              name="admin_notes"
              placeholder="Optional note (e.g. bank confirmed at 14:32)"
              aria-label="Note (admin only)"
              className="sn-input min-h-11 w-full"
            />
            <label className="flex min-h-11 items-center gap-2 text-[14px] text-ink">
              <input type="checkbox" name="promote_order" defaultChecked className="h-5 w-5 cursor-pointer accent-terracotta" />
              Also mark order as paid
            </label>
            {/*
              THE ACKNOWLEDGEMENT ONLY RENDERS WHEN THERE IS SOMETHING TO
              ACKNOWLEDGE (owner 2026-08-28). `dup` is derived with the SAME rule
              approvePaymentCore consults, so the box appears exactly when the
              guard would warn — and it names the other order. Unticked by
              default, always. 🔑 It cannot unlock the same-order case.
            */}
            {dup?.kind === 'other_order' ? (
              <label className="flex items-start gap-2 py-1 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
                <input type="checkbox" name="acknowledge_duplicate" className="mt-0.5 h-5 w-5 cursor-pointer accent-terracotta" />
                <span>
                  This reference is already counted on order{' '}
                  <span className="font-semibold">{dup.otherOrderPublicId ?? 'another order'}</span>
                  {dup.otherAmountPhp != null ? <> ({formatPhp(dup.otherAmountPhp)} counted there)</> : null}. Tick only if
                  one transfer really covers both — check the bank first.
                </span>
              </label>
            ) : dup?.kind === 'same_order' ? (
              <p className="py-1 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
                This reference is already counted on THIS order. Approving it again would count one transfer twice, so the
                approval will be refused — there is no override for this case.
              </p>
            ) : dupFailed ? (
              /* The collision check could not run — the approval guard will
                 refuse with its own message, but the way out of that refusal
                 needs the box to exist. Say why it shows. */
              <label className="flex items-center gap-2 py-1 text-[14px] text-ink">
                <input type="checkbox" name="acknowledge_duplicate" className="h-5 w-5 cursor-pointer accent-terracotta" />
                One transfer really covers two orders — I checked the bank (we could not check past payments automatically
                just now)
              </label>
            ) : p.reference_number ? (
              <p className={TEMPLATE_SUBLINE}>Duplicate check: no confirmed payment carries this reference.</p>
            ) : null}
            <SubmitButton className="ab ab-ok ab-main w-full" pendingLabel="Approving…">
              Approve · matched
            </SubmitButton>
          </ConfirmForm>
        </Fold>
      )}
      {/*
        "Request resubmit" middle path (2026-05-29): use it when the screenshot
        is unclear, the reference code is missing, or the amount doesn't match —
        the couple can re-upload without starting over. The notice is required
        and emailed verbatim to the couple.
      */}
      <Fold title="Ask to resubmit" line="Nothing is rejected · no access is lost" data="payment-resubmit">
        <form action={requestPaymentResubmit} className="space-y-2">
          <input type="hidden" name="payment_id" value={p.payment_id} />
          <textarea
            name="admin_resubmit_notice"
            placeholder="What does the couple need to fix? (e.g. screenshot is blurry, reference code missing from notes)"
            aria-label="What does the couple need to fix?"
            required
            minLength={10}
            maxLength={2000}
            rows={2}
            className="sn-input min-h-[72px] w-full py-2"
          />
          <SubmitButton className="ab ab-info ab-main w-full" pendingLabel="Requesting resubmit…">
            Request resubmit
          </SubmitButton>
        </form>
      </Fold>
      <Fold title="Reject" line="Cancels the linked order" data="payment-reject" danger>
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
            aria-label="Why is this rejected?"
            className="sn-input min-h-11 w-full"
          />
          <SubmitButton className="ab ab-danger ab-main w-full" pendingLabel="Rejecting…">
            Reject
          </SubmitButton>
        </ConfirmForm>
      </Fold>
    </TemplateSection>
  );
}

/**
 * A PAID SERVICE THEY CANNOT USE — the two things the public refund page
 * promises (`app/(shell)/refunds/page.tsx`; owner 2026-11-05 "yes to refund"):
 * its value becomes Papic credits, or, unused, it moves to their next event.
 * Neither moves money. Both post to `refundOrder` with an `intent` (the
 * server-action budget is at its ceiling); the work and the double-click guard
 * are one SQL transaction each (lib/admin/service-remedies.server.ts).
 *
 * ⚖ OWNER 2026-11-05: the credit figure is what they paid at the best-value
 * Papic pack on sale, computed by the SQL function the conversion itself grants
 * from — so there is NO box to type a number into. The form posts the figure it
 * shows; the database refuses if prices moved in between. Converting also
 * switches the service off (the order becomes `lapsed`).
 */
export function ServiceRemedyForms({
  orderId,
  orderPublicId,
  row,
  failed,
  query,
  closed,
}: {
  orderId: string;
  orderPublicId: string;
  row: RemedyDeskRow | null;
  failed: boolean;
  query: string;
  /** The order is switched off (`lapsed`): show the history, offer nothing. */
  closed: boolean;
}) {
  if (closed && (!row || row.done.length === 0)) return null;
  if (failed || !row) {
    return (
      <p className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
        Couldn’t check what was already done with this order, so Convert and Move are hidden. Refresh the page.
      </p>
    );
  }
  const hint = `block ${TEMPLATE_SUBLINE}`;
  const reasonBox = (placeholder: string) => <RemedyReasonRow placeholder={placeholder} />;
  const button = 'ab ab-brand ab-main w-full';

  return (
    <div className="space-y-1">
      {row.done.length > 0 ? (
        <ul className="space-y-1 py-1 text-[14px] text-ink">
          {row.done.map((d, i) => (
            <li key={`${d.kind}-${i}`}>
              {d.kind === 'papic_credits'
                ? `Converted to ${formatCount(d.credits ?? 0)} Papic credits`
                : `Moved from ${d.fromEventName ? `“${d.fromEventName}”` : 'an earlier event'} to ${d.toEventName ? `“${d.toEventName}”` : 'their next event'}`}
              <span className={`ml-1 ${TEMPLATE_SUBLINE}`}>
                · {d.createdAt.slice(0, 10)}
              </span>
              <span className={`block ${TEMPLATE_SUBLINE}`}>{d.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {closed || row.converted || !row.credits ? null : (
        <Fold title="Convert to Papic credits" line="No money is sent back" data="payment-convert">
          <ConfirmForm
            action={refundOrder}
            title={`Convert to ${formatCount(row.credits)} Papic credits?`}
            confirmLabel="Convert · tell the couple"
            message="Adds the credits to their event and switches this service off. Records who did it and why, and tells the couple in the app. No money is sent back. It can be done once per order."
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="intent" value="convert_to_papic_credits" />
            <input type="hidden" name="order_id" value={orderId} />
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <input type="hidden" name="expected_credits" value={String(row.credits ?? '')} />
            <p className={hint}>
              They paid {formatPhp(row.paidPhp)}.{' '}
              {row.credits !== null && row.credits > 0 ? (
                <>
                  That is <span className="font-medium text-ink">{formatCount(row.credits)} Papic credits</span>
                  {row.pack ? ` at the best-value pack (${row.pack}).` : '.'}
                </>
              ) : row.credits === 0 ? (
                'That is too little to make even one Papic credit.'
              ) : (
                'No Papic pack is on sale right now, so this can’t be converted.'
              )}
            </p>
            {reasonBox('E.g. The live video could not start on the day — our encoder failed.')}
            <SubmitButton className={button} pendingLabel="Converting…">
              Convert · tell the couple
            </SubmitButton>
          </ConfirmForm>
        </Fold>
      )}

      {closed || row.converted ? null : row.nextEvent ? (
        <Fold title="Move to their next event" line="Only if they haven’t used it" data="payment-move">
          <ConfirmForm
            action={refundOrder}
            title={`Move to “${row.nextEvent.name ?? 'their next event'}”?`}
            confirmLabel="Move · tell the couple"
            message={`Order ${orderPublicId} leaves this event and goes to their next one. Only if they haven’t used it. Records who did it and why, and tells the couple in the app.`}
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="intent" value="move_to_next_event" />
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="to_event_id" value={row.nextEvent.id} />
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <p className={hint}>
              Their next event: <span className="font-medium text-ink">{row.nextEvent.name ?? 'Untitled event'}</span>
            </p>
            {reasonBox('E.g. Their wedding was called off before they used it.')}
            <SubmitButton className={button} pendingLabel="Moving…">
              Move · tell the couple
            </SubmitButton>
          </ConfirmForm>
        </Fold>
      ) : (
        <p className={hint}>Unused? It waits for their next event — they haven’t created one yet.</p>
      )}
    </div>
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
export function RefundForm({
  orderId,
  orderPublicId,
  defaultAmountPhp,
}: {
  orderId: string;
  orderPublicId: string;
  defaultAmountPhp: number;
}) {
  return (
    <Fold title={`Record a refund for order ${orderPublicId}`} line="Money you already sent back by hand" data="payment-refund" danger>
      <ConfirmForm
        action={refundOrder}
        title="Record this refund?"
        confirmLabel="Record refund · notify couple"
        message="This permanently marks the order refunded, revokes any access it granted, writes an audit row, and notifies the couple. Send the reverse transfer first — this can't be undone here."
        className="mt-2 space-y-2"
      >
        <input type="hidden" name="order_id" value={orderId} />
        <label className="block space-y-1">
          <span className="block text-[14px] text-ink">Amount refunded (PHP)</span>
          <input
            name="refund_amount_php"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={String(defaultAmountPhp)}
            required
            className="sn-input min-h-11 w-full"
          />
          <span className={`block ${TEMPLATE_SUBLINE}`}>
            Pre-filled with the order total — edit if you sent back a different amount.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="block text-[14px] text-ink">Reason (at least 20 characters)</span>
          <textarea
            name="reason"
            required
            minLength={20}
            maxLength={2000}
            placeholder="E.g. Couple double-paid via GCash on June 4 — reversed transfer GCash ref 99887766 sent back to their original number."
            rows={2}
            className="sn-input min-h-[72px] w-full py-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="block text-[14px] text-ink">Proof URL (optional)</span>
          <input
            name="proof_url"
            type="url"
            placeholder="Link to the reverse-transfer screenshot — you can add this later."
            className="sn-input min-h-11 w-full"
          />
        </label>
        <SubmitButton className="ab ab-danger ab-main w-full" pendingLabel="Recording refund…">
          Record refund · notify couple
        </SubmitButton>
      </ConfirmForm>
    </Fold>
  );
}

// ─── WHICH CELEBRATION (owner 2026-08-28: "what event") ──────────────────────

export type OrderEventInfo = {
  publicId: string;
  displayName: string;
  eventType: string | null;
  eventDate: string | null;
};

export type OrderEventInfoResult = {
  /** keyed by event_id. */
  byEventId: Map<string, OrderEventInfo>;
  /** True when the read itself failed — the card says so instead of a blank. */
  failed: boolean;
};

/**
 * One line saying which event this money is for — or saying, plainly,
 * why there isn't one. Three states that must never look alike (the same
 * principle as buyerLabel above): not event-scoped is INTENT, a failed read is
 * a fault, and a missing row means the event was removed.
 */
export function CelebrationLine({
  eventId,
  info,
  readFailed,
  typeName,
}: {
  typeName: EventTypeName;
  eventId: string | null;
  info: OrderEventInfo | null;
  readFailed: boolean;
}) {
  const word = <span className="block text-[13px] text-[color:var(--m-slate-2)]">For</span>;
  if (!eventId) {
    return (
      <p className="py-2 text-[14px] text-ink">
        {word}
        Not tied to an event — an account-level purchase.
      </p>
    );
  }
  if (!info) {
    return (
      <p className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
        {word}
        {readFailed
          ? 'Could not read which event this is for — reload before approving.'
          : 'The event on this bill no longer exists.'}
      </p>
    );
  }
  return (
    <div className="flex min-h-14 items-center gap-2.5 py-2">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold leading-tight text-ink">{info.displayName}</b>
        <span className="mt-0.5 block truncate text-[13px] leading-snug text-[color:var(--m-slate-2)]">
          For · {info.eventType ? <>{typeName(info.eventType)} · </> : null}
          {/* A NULL date must read as intent, never as a blank or a dash that looks
              like a broken join — same rule as buyerLabel. */}
          {info.eventDate ? formatEventDate(info.eventDate) : 'no date set'}
        </span>
      </span>
      <a
        className="ab ab-neutral flex-none"
        href={`/admin/accounts?tab=events&q=${encodeURIComponent(info.publicId)}`}
      >
        Open event
      </a>
    </div>
  );
}

// ─── WHAT THEY BOUGHT + THE MONEY (owner 2026-08-28) ─────────────────────────

/**
 * What the bill covers, per order:
 *   • 'lines'      — an onboarding BASKET, itemised from its own line rows.
 *   • 'single'     — an ordinary one-product order, titled from the catalog.
 *   • 'none'       — a legacy ad-hoc order with no product key; the money block
 *                    still renders (owed comes from the order row itself).
 *   • 'unreadable' — a basket whose lines could not be read. Said out loud —
 *                    a silently empty bill is something an admin might approve
 *                    against.
 */
export type DeskBill =
  | { kind: 'lines'; lines: DeskBillLine[] }
  | { kind: 'single'; line: DeskBillLine }
  | { kind: 'none' }
  | { kind: 'unreadable' };

/**
 * The money, top to bottom, in the Ledger register (mono figures, right-aligned
 * column): what each line normally costs → what the sign-up discount took off →
 * any voucher → AMOUNT TO SEND → what the buyer actually transferred → the
 * difference.
 *
 * 🔒 The AMOUNT TO SEND is summarizeDeskMoney's `owedPhp`, which is
 * orderGrossOwed with the shortfall guard's own arguments — this card can never
 * quote a figure the guard would then refuse.
 */
export function DeskMoneyBlock({
  bill,
  order,
  transferredPhp,
}: {
  bill: DeskBill;
  order: NonNullable<PaymentJoined['order']>;
  transferredPhp: number;
}) {
  const lines: DeskBillLine[] =
    bill.kind === 'lines' ? bill.lines : bill.kind === 'single' ? [bill.line] : [];
  const money = summarizeDeskMoney({
    lines,
    requestedTotalPhp: order.requested_total_php,
    confirmedTotalPhp: order.confirmed_total_php,
    voucherDiscountCentavos: order.voucher_discount_centavos,
    serviceKey: order.service_key,
    transferredPhp,
  });
  const row = 'flex min-h-10 items-baseline justify-between gap-3 py-1.5';
  const num = `shrink-0 text-right ${TEMPLATE_MONEY}`;
  const verdictTone = money.verdict === 'exact' ? 'ok' : 'warn';
  return (
    <TemplateSection label="What this bill covers" data="payment-bill">
      {bill.kind === 'unreadable' ? (
        <p role="alert" className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          Could not read what&rsquo;s on this bill. Do not approve against a blank bill — reload, and if it stays blank,
          this is a fault on our side.
        </p>
      ) : null}
      <dl className="text-[15px] [&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
        {lines.map((l) => (
          <div key={l.serviceCode} className={row}>
            <dt className="min-w-0 text-ink">{l.label}</dt>
            {/* Each line shows what it NORMALLY costs; the discount row below
                takes the difference off, landing on the amount to send. */}
            <dd className={num}>{formatPhp(l.regularPhp ?? l.chargedPhp)}</dd>
          </div>
        ))}
        {money.signupSavingPhp > 0 ? (
          <div className={row}>
            <dt className="text-ink">Sign-up discount</dt>
            <dd className={num}>−{formatPhp(money.signupSavingPhp)}</dd>
          </div>
        ) : null}
        {money.voucherPhp > 0 ? (
          <div className={row}>
            <dt className="text-ink">
              Voucher
              {money.voucherInsideConfirmedTotal ? (
                <span className={TEMPLATE_SUBLINE}> (already in the confirmed total)</span>
              ) : null}
            </dt>
            <dd className={num}>
              {money.voucherInsideConfirmedTotal ? '' : '−'}
              {formatPhp(money.voucherPhp)}
            </dd>
          </div>
        ) : null}
        <div className={row}>
          <dt className="font-semibold text-ink">Amount to send</dt>
          <dd className={num}>{formatPhp(money.owedPhp)}</dd>
        </div>
        <div className={row}>
          <dt className="text-ink">They transferred</dt>
          <dd className={num}>{formatPhp(money.transferredPhp)}</dd>
        </div>
      </dl>
      <p className="py-1 text-[14px] font-semibold" style={{ color: `rgb(var(--color-${verdictTone}))` }}>
        {money.verdict === 'exact'
          ? '✓ Covers the amount to send exactly.'
          : money.verdict === 'short'
            ? `${formatPhp(Math.abs(money.deltaPhp))} short of the amount to send.`
            : `${formatPhp(money.deltaPhp)} more than the amount to send.`}
      </p>
    </TemplateSection>
  );
}

// ─── REFERENCE COLLISIONS, KNOWN BEFORE THE CLICK (owner 2026-08-28) ─────────

/** What the card renders about a collision — enriched for naming. */
export type CardDuplicate =
  | { kind: 'same_order' }
  | { kind: 'other_order'; otherOrderPublicId: string | null; otherAmountPhp: number | null };

export type DuplicateExposureResult = {
  byPaymentId: Map<string, CardDuplicate>;
  /** True when the collision read failed — the generic checkbox renders so the
      guard's own refusal message still has a box to point at. */
  failed: boolean;
};

/**
 * What the reader saw on the buyer's screenshot.
 *
 * Owner, 2026-08-28: *"can we assign an AI to verify if that last 6 digits do
 * exist on the photo?"* This is the answer, sitting above the approve button so
 * the admin does not have to be the OCR.
 *
 * ⛔ IT IS A CARD AND NOTHING ELSE. It hides no row, disables no control and
 * feeds no predicate — `decisive`, which gates one-click approval, is computed
 * without ever looking at this. The one-person admin plan (2026-07-11) binds it:
 * the machine may prepare and may hold back, it may never be the thing that lets
 * money through.
 *
 * 🎨 The text tokens are the `-deep` pair on purpose. `--sn-success` on
 * `--sn-success-soft` measures 3.97:1 — below the 4.5:1 floor — and the repo
 * ships `--sn-success-deep` (5.03:1) and `--sn-warning-deep` (5.84:1) for
 * exactly this placement, saying so in globals.css beside the definition.
 * ⚠ The older "Order code in note" badge a few lines up still uses the plain
 * pair and is a real AA failure; it is NAMED here, not silently changed, because
 * a colour edit on somebody else's badge belongs in its own change.
 */
export function ReceiptReadCard({
  read,
  paymentId,
  hasScreenshot,
}: {
  read: ReceiptReadRow | undefined;
  paymentId: string;
  hasScreenshot: boolean;
}) {
  // No picture ⇒ nothing to read, and no card. A buyer may send a reference
  // number alone (the form allows it), and an empty "we could not read it" card
  // on that row would look like a fault where there is none.
  if (!hasScreenshot) return null;

  const tone: 'agrees' | 'disagrees' | 'unknown' =
    read?.status !== 'ok'
      ? 'unknown'
      : read.reference_matches === false || read.amount_matches === false
        ? 'disagrees'
        : read.reference_matches === true
          ? 'agrees'
          : 'unknown';

  const toneVar = tone === 'agrees' ? 'ok' : tone === 'disagrees' ? 'danger' : null;

  return (
    <TemplateSection
      label="Reading their screenshot"
      tip="Advisory only — it gates nothing. The AI prepares; you press."
      right={
        <form action={rereadPaymentReceipt}>
          <input type="hidden" name="payment_id" value={paymentId} />
          <SubmitButton className="ab ab-neutral" pendingLabel="Reading…">
            {read ? 'Read it again' : 'Read it'}
          </SubmitButton>
        </form>
      }
      data="payment-ai-read"
    >
      <p
        className="text-[14px] leading-relaxed text-ink"
        data-read-tone={tone}
        style={toneVar ? { color: `rgb(var(--color-${toneVar}))` } : undefined}
      >
        {read
          ? (read.summary ?? read.error ?? 'Nothing came back.')
          : 'Nobody has read this picture yet.'}
      </p>

      {read?.status === 'ok' && (read.seen_references?.length || read.seen_amounts?.length) ? (
        // What the parser actually found, so the sentence above can be checked
        // rather than believed.
        <p className={`mt-1 tabular-nums ${TEMPLATE_SUBLINE}`}>
          {[
            read.seen_references?.length ? `on it: ${read.seen_references.join(' · ')}` : null,
            read.seen_amounts?.length
              ? `amounts: ${read.seen_amounts.map((a) => `₱${Number(a).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`).join(' · ')}`
              : null,
          ]
            .filter(Boolean)
            .join('  |  ')}
        </p>
      ) : null}
    </TemplateSection>
  );
}

export type RecordTarget =
  | { kind: 'readFailed' }
  | {
      kind: 'order';
      orderId: string;
      publicId: string | null;
      referenceCode: string | null;
      description: string | null;
      totalPhp: number | null;
      status: string;
      accounts: ReceivingAccount[];
    };

/**
 * "Money arrived that nobody logged." Records it in the customer's own shape
 * and confirms it through the same approval path (approvePayment · intent=record).
 */
export function RecordPaymentCard({ record, query }: { record: RecordTarget; query: string }) {
  if (record.kind === 'readFailed') {
    return (
      <TemplateFail data="record-payment">
        Couldn&rsquo;t load this order or our accounts, so recording a payment is off for now. Refresh to try again.
      </TemplateFail>
    );
  }
  const label = record.publicId ?? record.referenceCode ?? 'this order';
  if (!canLogPaymentAgainstOrder(record.status)) {
    return (
      <p className={`py-2 ${TEMPLATE_SUBLINE}`}>
        {label} is &ldquo;{record.status}&rdquo; and is no longer taking payments.
      </p>
    );
  }
  const field = 'block space-y-1 text-[14px] text-ink';
  return (
    <TemplateSection
      label="Record a payment received"
      tip="Records it in the customer’s own shape and confirms it through the same approval. A double tap records one payment."
      data="record-payment"
    >
      <p className={TEMPLATE_SUBLINE}>
        Money arrived for <b className="text-ink">{label}</b>? Record it here and it&rsquo;s confirmed.
        {record.totalPhp != null ? <> Order total {formatPhp(record.totalPhp)}.</> : null}
      </p>
      <form id="record-payment-form" action={approvePayment} className="mt-2 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="intent" value="record" />
        <input type="hidden" name="order_id" value={record.orderId} />
        <input type="hidden" name="q" value={query} />
        {/* One key per render: a double tap or a retry records ONE payment. */}
        <input type="hidden" name="client_idempotency_key" value={randomUUID()} />
        <label className={field}>
          Amount received (₱)
          <input name="amount_php" required inputMode="decimal" className="sn-input min-h-11 w-full tabular-nums" />
        </label>
        <div className={field}>
          <span className="block">Paid into</span>
          {/* The house dropdown — any set of choices is one PickMenu, never a raw select (T2). */}
          <FormPick
            name="channel"
            form="record-payment-form"
            label="Paid into"
            placeholder="Pick our account"
            dataAttr="record-payment-channel"
            options={record.accounts.map((a) => ({ key: a.id, label: `${a.label}${a.enabled ? '' : ' (off)'}` }))}
          />
        </div>
        <div className="sm:self-end">
          {/* The app's one date row (T21) — it carries its own label — never a native date box. Money cannot arrive tomorrow. */}
          <FormDate name="paid_at" label="Date received" today={manilaTodayISO()} max={manilaTodayISO()} data="record-payment-date" />
        </div>
        <label className={field}>
          Bank reference
          <input name="reference_number" maxLength={64} className="sn-input min-h-11 w-full tabular-nums" />
        </label>
        <label className={`${field} sm:col-span-2`}>
          Note
          <input name="admin_notes" maxLength={500} placeholder="e.g. seen in the BDO app at 14:32" className="sn-input min-h-11 w-full" />
        </label>
        <div className="sm:col-span-2">
          <SubmitButton className="ab ab-ok ab-main w-full" pendingLabel="Recording…">
            Record and confirm
          </SubmitButton>
        </div>
      </form>
    </TemplateSection>
  );
}

