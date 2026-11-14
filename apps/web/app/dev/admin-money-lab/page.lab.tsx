/**
 * /dev/admin-money-lab — Admin › Money's inner screens on fixtures: no sign-in, no database. DEV-ONLY: production
 * builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 14 Nov 2026, "Yes, queue the builds" — the approved drawing is `Setnayan-specs/prototypes/admin_pub/money.html`.
 * Draws the REAL desk (`app/admin/payments/_components/desk.tsx`) and the REAL Refunds view
 * (`app/admin/payments/supplier-refunds/supplier-refunds-view.tsx`) inside the real five-tab shell, so a walk can
 * screenshot each state at 390 and 1280:
 *
 *   ?v=desk          Money · To confirm, busy (default)      ?v=desk-empty · ?v=desk-fail
 *   ?v=all           All payments (pending, resubmit, matched, rejected)
 *   ?v=quotes        Needs a quote                           ?v=quotes-empty
 *   ?v=open          one payment opened — pending, not clean ?v=open-dup · ?v=open-clean · ?v=open-paid
 *   ?v=record        a search naming one order → Record a payment received
 *   ?v=refunds       Money · Refunds                         ?v=refunds-empty · ?v=refunds-fail
 *
 * The buttons post to the real server actions, which refuse without an admin session — a lab press changes nothing.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AdminRailContext } from '@/app/admin/_components/admin-rail-context';
import { AdminBottomNav } from '@/app/admin/_components/admin-bottom-nav';
import { AdminPinnedRow, AdminThumbRow } from '@/app/admin/_components/admin-tab-rows';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ADMIN_AVATAR_ROWS } from '@/lib/admin/admin-tabs';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';
import type { RemedyDesk } from '@/lib/admin/service-remedies.server';
import {
  DeskHead,
  DeskNums,
  OpenedPayment,
  OrdersNeedingQuote,
  PaymentsList,
  RecordPaymentCard,
  type DeskAddress,
  type DeskBill,
  type DuplicateExposureResult,
  type OrderEventInfoResult,
  type OrderJoined,
  type PaymentJoined,
  type ReceiptReadRow,
} from '@/app/admin/payments/_components/desk';
import { SupplierRefundsView, type SupplierRefundRow } from '@/app/admin/payments/supplier-refunds/supplier-refunds-view';

const ACCOUNT = { signedIn: true, initials: 'SA', shopName: null, isAdmin: true } as const;
const SWITCHER: SwitcherData = {
  userId: 'lab-admin',
  displayName: 'Setnayan Admin',
  email: 'admin@example.com',
  isAnonymous: false,
  photoUrl: null,
  photoFrame: null,
  events: [],
  eventsMeasured: true,
  context: { hasVendor: false, vendorName: null, isAdmin: true, canOpenShop: false, shops: [] },
  otherAccounts: [],
  canAddAccount: false,
};
const COUNTS: AdminQueueCounts = { payments: 3, 'booking-fees': 2, 'supplier-refunds': 2, payouts: 0, subscriptions: 1, 'payment-options': 1 };

const HOURS = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const TODAY = new Date().toISOString().slice(0, 10);

/** Five payments, one of each kind the desk tells apart. */
const PAYMENTS: PaymentJoined[] = [
  pay('p-today', 'maria@example.ph', 147, 'gcash', 'S89O3PQ1-0032', 'pending', { code: 'S89O3PQ1', total: 147, key: 'papic_credits', event: 'e-today', pub: 'S89O-3PQ1', h: 2 }),
  pay('p-short', 'santos.family@example.ph', 899, 'bdo', null, 'pending', { code: 'S89O8TT2', total: 999, key: 'live_watch', event: 'e-later', pub: 'S89O-8TT2', h: 26, platform: 'ios' }),
  pay('p-dup', 'jose@example.ph', 2499, 'gcash', '6789 0012', 'pending', { code: 'S89O7K2M', total: 2499, key: 'thank_you_film', event: 'e-later', pub: 'S89O-7K2M', h: 3 }),
  pay('p-resub', 'reyes@example.ph', 1499, 'gcash', '0045 1120', 'resubmit_requested', { code: 'S89O1ZZ9', total: 1499, key: 'custom_song', event: null, pub: 'S89O-1ZZ9', h: 40 }, { notice: 'The screenshot is blurry — please send a clearer one that shows the reference number.' }),
  pay('p-paid', 'dela.cruz@example.ph', 2499, 'gcash', 'S89O9WX4', 'matched', { code: 'S89O9WX4', total: 2499, key: 'thank_you_film', event: 'e-later', pub: 'S89O-9WX4', h: 70, status: 'paid' }, { note: 'Bank confirmed at 14:32' }),
  pay('p-rej', 'lopez@example.ph', 500, 'gcash', '1111', 'rejected', { code: 'S89O4KQ2', total: 999, key: 'live_watch', event: null, pub: 'S89O-4KQ2', h: 90, status: 'cancelled' }, { note: 'Amount mismatch — nothing in the inbox' }),
];

function pay(
  id: string,
  email: string,
  amount: number,
  channel: string,
  ref: string | null,
  status: PaymentJoined['status'],
  o: { code: string; total: number; key: string; event: string | null; pub: string; h: number; platform?: string; status?: NonNullable<PaymentJoined['order']>['status'] },
  extra: { notice?: string; note?: string } = {},
): PaymentJoined {
  return {
    payment_id: `00000000-0000-4000-8000-${id.replace(/[^a-z]/g, '').padEnd(12, '0').slice(0, 12)}`,
    order_id: `order-${id}`,
    user_id: `user-${id}`,
    amount_php: amount,
    channel,
    reference_number: ref,
    screenshot_url: null,
    paid_at: HOURS(o.h).slice(0, 10),
    status,
    admin_notes: extra.note ?? null,
    admin_resubmit_notice: extra.notice ?? null,
    reviewed_at: status === 'pending' ? null : HOURS(o.h - 1),
    created_at: HOURS(o.h),
    order: {
      public_id: o.pub,
      event_id: o.event,
      reference_code: o.code,
      description: 'Bought on the Event Hub',
      service_key: o.key,
      requested_total_php: o.total,
      confirmed_total_php: null,
      voucher_discount_centavos: null,
      status: o.status ?? 'awaiting_payment',
      platform: o.platform ?? 'web',
    },
    user: { email, public_id: `S89U-${id.toUpperCase()}` },
  };
}

const TITLES: Record<string, string> = {
  papic_credits: 'Papic credits',
  live_watch: 'Live Watch',
  thank_you_film: 'Thank-you film',
  custom_song: 'Custom song',
};
const BILLS = new Map<string, DeskBill>(
  PAYMENTS.map((p) => [
    p.order_id,
    { kind: 'single', line: { serviceCode: p.order!.service_key!, label: TITLES[p.order!.service_key!]!, quantity: 1, chargedPhp: p.order!.requested_total_php, regularPhp: null } },
  ]),
);
const EVENTS: OrderEventInfoResult = {
  failed: false,
  byEventId: new Map([
    ['e-today', { publicId: 'S89E-TODAY', displayName: 'Maria & Jose wedding', eventType: 'wedding', eventDate: TODAY }],
    ['e-later', { publicId: 'S89E-LATER', displayName: 'Santos christening', eventType: 'christening', eventDate: '2026-12-14' }],
  ]),
};
const SAME_DAY = new Set(['order-p-today']);
const DUPS: DuplicateExposureResult = {
  failed: false,
  byPaymentId: new Map([[PAYMENTS[2]!.payment_id, { kind: 'other_order', otherOrderPublicId: 'S89O-2HJ8', otherAmountPhp: 2499 }]]),
};
const READS: Record<string, ReceiptReadRow> = {
  [PAYMENTS[0]!.payment_id]: {
    payment_id: PAYMENTS[0]!.payment_id,
    status: 'ok',
    reference_matches: true,
    amount_matches: true,
    seen_references: ['S89O3PQ1-0032'],
    seen_amounts: [147],
    summary: 'Sent ₱147.00 to SETNAYAN · reference S89O3PQ1-0032.',
    error: null,
    created_at: HOURS(1),
  },
};
const REMEDIES: RemedyDesk = {
  failed: false,
  byOrderId: new Map([
    ['order-p-paid', { done: [], converted: false, nextEvent: { id: 'e-next', name: 'Dela Cruz anniversary' }, paidPhp: 2499, credits: 24, pack: '₱999 = 3,000 credits' }],
  ]),
};
const QUOTES: OrderJoined[] = [
  {
    order_id: 'q1',
    user_id: 'u-q1',
    public_id: 'S89O-4KQ2',
    reference_code: 'S89O4KQ2',
    description: 'Custom song for the Lopez debut — a first-dance song with two verses about the family.',
    requested_total_php: 4999,
    confirmed_total_php: null,
    status: 'submitted',
    admin_notes: null,
    created_at: HOURS(30),
    user: { email: 'lopez@example.ph', public_id: 'S89U-Q1' },
  },
];
const SUPPLIER_REFUNDS: SupplierRefundRow[] = [
  { refund_id: 'r1', event_id: 'ev1', vendor_profile_id: 'v1', amount_php: 5000, refunded_on: '2026-11-08', reason: 'Date moved, deposit returned', proof_r2_key: 'x', created_at: '2026-11-08T03:00:00Z', removed_at: null },
  { refund_id: 'r2', event_id: 'ev2', vendor_profile_id: 'v2', amount_php: 1000, refunded_on: '2026-11-02', reason: 'Overcharged', proof_r2_key: null, created_at: '2026-11-02T03:00:00Z', removed_at: '2026-11-03T03:00:00Z' },
];

export default async function AdminMoneyLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const v = sp.v ?? 'desk';
  const refunds = v.startsWith('refunds');
  const at = refunds ? '/admin/payments/supplier-refunds' : '/admin/payments';
  const avatarRows = ADMIN_AVATAR_ROWS.flatMap((r) => (r.href ? [{ key: r.key, href: r.href, label: r.label }] : []));
  const here: DeskAddress = {
    filter: v === 'all' ? 'all' : v.startsWith('quotes') ? 'orders_needing_quote' : 'pending',
    platform: null,
    q: v === 'record' ? 'S89O-3PQ1' : '',
  };
  const list = v === 'all' ? PAYMENTS : PAYMENTS.filter((p) => p.status === 'pending');
  const openOne =
    v === 'open' ? PAYMENTS[1]! : v === 'open-dup' ? PAYMENTS[2]! : v === 'open-clean' ? PAYMENTS[0]! : v === 'open-paid' ? PAYMENTS[4]! : null;

  const body = refunds ? (
    <SupplierRefundsView
      rows={v === 'refunds-fail' ? null : v === 'refunds-empty' ? [] : SUPPLIER_REFUNDS}
      readError={v === 'refunds-fail' ? { message: 'lab' } : null}
      shopName={new Map([['v1', 'Casa Verde'], ['v2', 'Lumina Studio']])}
      eventName={new Map([['ev1', 'Reyes debut'], ['ev2', 'Mendoza wedding']])}
      ours={
        v === 'refunds-fail'
          ? null
          : v === 'refunds-empty'
            ? []
            : [{ refundId: 'o1', orderId: 'o1', orderPublicId: 'S89O-1ZZ9', amountPhp: 1499, reason: 'Double-paid via GCash — reversed to their number', refundedAt: '2026-11-04T05:00:00Z', proofAttached: true }]
      }
      waiting={
        v === 'refunds-fail'
          ? null
          : v === 'refunds-empty'
            ? []
            : [{ approvalId: 'a1', orderPublicId: 'S89O-6TT2', amountPhp: 28000, reason: 'The venue cancelled; the couple paid twice', expiresAt: '2026-11-17T05:00:00Z' }]
      }
    />
  ) : openOne ? (
    <OpenedPayment
      payment={openOne}
      readFailed={null}
      back="/dev/admin-money-lab"
      typeName={(k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Event')}
      screenshotUrlMap={{}}
      sameDayOrderIds={SAME_DAY}
      receiptReads={READS}
      eventInfo={EVENTS}
      deskBills={BILLS}
      dupExposure={DUPS}
      remedyDesk={REMEDIES}
      channelSettings={{}}
      query=""
    />
  ) : (
    <>
      <DeskHead here={here} />
      {here.filter !== 'orders_needing_quote' ? (
        <DeskNums
          nums={v === 'desk-fail' ? { receivedWeekPhp: null, toConfirm: null } : { receivedWeekPhp: v === 'desk-empty' ? 0 : 5594, toConfirm: v === 'desk-empty' ? 0 : 3 }}
          sameDay={v === 'desk-fail' ? null : v === 'desk-empty' ? 0 : 1}
        />
      ) : null}
      {v === 'record' ? (
        <RecordPaymentCard
          record={{ kind: 'order', orderId: 'order-p-today', publicId: 'S89O-3PQ1', referenceCode: 'S89O3PQ1', description: 'Papic credits', totalPhp: 147, status: 'awaiting_payment', accounts: [{ id: 'gcash', label: 'GCash · Setnayan', enabled: true }, { id: 'bdo', label: 'BDO · Setnayan', enabled: true }, { id: 'maribank-7k2q', label: 'Maribank', enabled: false }] as never }}
          query={here.q}
        />
      ) : null}
      {here.filter === 'orders_needing_quote' ? (
        <OrdersNeedingQuote orders={v === 'quotes-empty' ? [] : QUOTES} vatRatePct={0} readFailed={null} query="" />
      ) : (
        <PaymentsList
          typeName={(k) => k ?? 'Event'}
          payments={v === 'desk-empty' ? [] : list}
          here={here}
          sameDayOrderIds={SAME_DAY}
          receiptReads={READS}
          deskBills={BILLS}
          dupExposure={DUPS}
          channelSettings={{}}
          readFailed={v === 'desk-fail' ? 'queue' : null}
          query=""
        />
      )}
    </>
  );

  return (
    <div className="app-surface sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        account={ACCOUNT}
        navLabels={{}}
        railContext={<AdminRailContext queueCounts={COUNTS} overdue={0} unreadable={0} at={at} />}
        topBarSlot={
          <div className="flex min-w-0 items-center gap-3">
            <AccountSwitcher data={SWITCHER} here="admin" adminRows={avatarRows} />
          </div>
        }
        createSlot={null}
      >
        <div className="sn-vt-page pb-[calc(env(safe-area-inset-bottom)+92px+var(--sn-thumb-room,0px))] lg:pb-0">
          <AdminPinnedRow queueCounts={COUNTS} at={at} />
          {refunds ? body : <div className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-1 sm:px-6">{body}</div>}
        </div>
      </FrontDoorShell>
      <AdminBottomNav queueCounts={COUNTS} overdue={0} unreadable={0} at={at} />
      <AdminThumbRow at={at} />
    </div>
  );
}
