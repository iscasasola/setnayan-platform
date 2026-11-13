import Link from 'next/link';
import { namesPhrase, openAccounts } from '@/lib/payment-channels';
import { paymentWasLogged } from '@/lib/payment-logged';
import { PaymentChannelName } from '@/app/_components/payment/payment-channel-name';
import { payPath } from '@/lib/pay-path';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { paymentProofPolicy } from '@/lib/r2-client-ref';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  computeOrderTotals,
  fetchOrderById,
  fetchPaymentsForOrder,
  formatPhp,
} from '@/lib/orders';
import {
  fetchPlatformSettings,
} from '@/lib/platform-settings';
import { everyOpenRailCarriesAmount, qrWords } from '@/lib/qr-amount-truth';
import { payAmount } from '@/lib/pay-amount';
import { bookingFeeErrorCopy,
  isVendorBookingFeeServiceKey,
  isFeeOrderPayable,
  VENDOR_BOOKING_FEES_PATH,
} from '@/lib/vendor-booking-fees';
import { ShopNotice } from '../../_components/kit';
import { createAdminClient } from '@/lib/supabase/admin';
import { chargeIdFromBookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { asDisputeStatus, disputeStateLine } from '@/lib/booking-fee-dispute';
import { SubmitButton } from '@/app/_components/submit-button';
import { DisputeNoteField } from '@/app/_components/dispute-note-field';
import { bookingFeeDispute } from '@/app/_actions/booking-fee-dispute-actions';
import { TOP_UP_CHARGE_KIND, TOP_UP_WORDS, topUpPayLabel, topUpStage, type TopUpStage } from '@/lib/booking-fee-top-up';
import { formatDueDate } from '@/lib/booking-fee-disclosure';
import { manilaToday } from '@/lib/std-views';
import { logQueryError } from '@/lib/supabase/error-detect';

export const metadata = { title: 'Booking fee · Supplier' };

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ logged?: string; error?: string; dispute?: string }>;
};

/**
 * /vendor-dashboard/booking-fees/[orderId] — the vendor pay page for one
 * booking-fee order. Same manual GCash/BDO QR flow couples use (reference +
 * amount + merchant QR + 24-hr verification), rebuilt on the vendor doorway so
 * it's reachable without couple-dashboard access. READ-ONLY on the fee; the only
 * write is logging a payment (proof), which the DB write-guard pins to
 * status='pending' — the vendor can never self-approve.
 */
export default async function VendorBookingFeeDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/vendor-dashboard/booking-fees/${orderId}`));
  const supabase = await createClient();

  // RLS scopes this to the caller's own orders; we additionally require it to be
  // (a) owned by this user and (b) a booking-fee order, so this page can only
  // ever render one of the VENDOR's OWN fee orders — never another vendor's,
  // never a non-fee order.
  const order = await fetchOrderById(supabase, orderId);
  if (
    !order ||
    order.user_id !== user.id ||
    !isVendorBookingFeeServiceKey(order.service_key)
  ) {
    notFound();
  }

  // One round trip: the payments, the platform settings and the bill's dispute (🕵️ below) ask nothing of each other —
  // only of `order`, proven above. The dispute read never throws (it hands back its error), so the batch rejects
  // exactly when, and with what, the two-read batch did.
  const chargeId = chargeIdFromBookingFeeLockServiceKey(order.service_key);
  const [payments, settings, disputeRead] = await Promise.all([
    fetchPaymentsForOrder(supabase, orderId),
    fetchPlatformSettings(supabase),
    chargeId
      ? supabase
          .from('booking_fee_disputes')
          .select('status, decision_note')
          .eq('charge_id', chargeId)
          .maybeSingle()
      : { data: null, error: null },
  ]);
  // Fee orders are `vendor_`-prefixed → VAT-INCLUSIVE: the stored total IS the
  // gross the vendor pays. Pass vatRatePct=0 so no VAT line is added on top.
  const totals = computeOrderTotals(order, payments, 0);
  const loggedPayments = payments.filter(paymentWasLogged);
  const payable = isFeeOrderPayable(order.status);

  /**
   * 🔑 WHAT THE CODES ON THIS SCREEN — AND ON /pay — ACTUALLY CARRY.
   * This page used to state, in a hand-written line, that "the code on the
   * payment page already has the amount in it", while the two images it prints
   * ITSELF are the STATIC uploaded merchant codes, which carry nothing. On
   * 2026-09-20 the owner scanned one and his wallet opened at ₱0. Both
   * sentences now come off one resolver run against the same stored payloads
   * /pay renders from.
   */
  const feeWords = qrWords(
    everyOpenRailCarriesAmount({
      amountPhp: totals.headlineTotal,
      // Every OPEN receiving account, as /pay will render them.
      rails: openAccounts(settings).map((a) => ({ open: true, payload: a.qrPayload })),
    }),
    payAmount(totals.headlineTotal),
    { reference: order.reference_code },
  );
  /**
   * ⚠ THE IMAGES BELOW ARE ALWAYS THE STATIC ONES. `settings.*_qr_url` is the
   * uploaded picture and nothing mints it per-order here, so this caption is
   * NOT `feeWords` — it is the static verdict, unconditionally, and saying
   * otherwise would be the same lie one level down.
   */
  const staticImageWords = qrWords(false, payAmount(totals.headlineTotal), {
    reference: order.reference_code,
  });

  /*
    🕵️ THE DISPUTE (DECISION_LOG 2026-07-27 grace-first ladder; owner 2026-11-05 "build dispute"). The bill's own
    charge, its dispute if any (the supplier's own read, RLS), and — only to quote it back — how often the couple
    opened this shop on Setnayan. That count lives in the couple-only found-record, so it is read with the service
    role, scoped to THIS bill's own (event, shop), which the checks above already proved is the caller's.
    A failed read shows no dispute control rather than a wrong one. (The dispute row is read in the batch above.)
  */
  const dispute = disputeRead.error
    ? undefined
    : ((disputeRead.data as { status: string; decision_note: string | null } | null) ?? null);
  const disputeStatus = dispute ? asDisputeStatus(dispute.status) : null;
  let disputeViewCount: number | null = null;
  if (disputeStatus === 'auto_accepted' && chargeId) {
    const admin = createAdminClient();
    const { data: charge } = await admin
      .from('booking_fee_charges')
      .select('event_id, vendor_profile_id')
      .eq('charge_id', chargeId)
      .maybeSingle();
    const c = charge as { event_id: string | null; vendor_profile_id: string } | null;
    if (c?.event_id) {
      const { data: found } = await admin
        .from('event_vendor_found')
        .select('view_count')
        .eq('event_id', c.event_id)
        .eq('vendor_profile_id', c.vendor_profile_id)
        .maybeSingle();
      disputeViewCount = (found as { view_count?: number } | null)?.view_count ?? null;
    }
  }
  // Disputable: an open bill, no dispute yet, and the dispute read answered.
  const canDispute = payable && Boolean(chargeId) && dispute === null;

  // 💸 A TOP-UP (owner 2026-11-12, `lib/booking-fee-top-up.ts`): the fee grew with a booked quote. It is due on the
  // event day — "Settle early" before it (rule 2), "Due today" on it, overdue after. Service-role read of THIS bill's
  // own charge (proven the caller's above); a failed read draws the bill exactly as shipped.
  let topUp: { stage: TopUpStage; dueOn: string | null } | null = null;
  if (payable && chargeId) {
    const { data: ch, error: chErr } = await createAdminClient()
      .from('booking_fee_charges')
      .select('kind, expires_at')
      .eq('charge_id', chargeId)
      .maybeSingle();
    if (chErr) logQueryError('booking-fees/[orderId]: top-up kind', chErr);
    const c = ch as { kind: string | null; expires_at: string | null } | null;
    if (c?.kind === TOP_UP_CHARGE_KIND) {
      const dueOn = c.expires_at ? c.expires_at.slice(0, 10) : null;
      topUp = { stage: topUpStage(dueOn, manilaToday()), dueOn };
    }
  }

  const paymentScreenshotMap: Record<string, string> = {};
  await Promise.all(
    payments.map(async (p) => {
      if (!p.screenshot_url) return;
      // 🔒 Scoped to this fee order's own proof folders (the generic signer is
      // public-bucket-only); the order was matched to this vendor above.
      const url = await displayUrlForPrivateStoredAsset(
        p.screenshot_url,
        paymentProofPolicy({ orderId: order.order_id, eventId: order.event_id ?? null, userId: order.user_id ?? null }),
      );
      if (url) paymentScreenshotMap[p.payment_id] = url;
    }),
  );

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={VENDOR_BOOKING_FEES_PATH}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to booking fees
      </Link>

      {search.logged === '1' ? (
        <ShopNotice tone="success" role="status">
          Payment logged. Our team reconciles within 24 hours and your fee moves
          to paid — no action needed on your end.
        </ShopNotice>
      ) : null}
      {/* 🚨 WAS `decodeURIComponent(search.error)` RENDERED DIRECTLY. Harmless
          only because nothing ever wrote the parameter — a dead reader. Now that
          it HAS a writer, a fixed code lookup is the difference between showing
          our own sentence and showing whatever a stranger put in a link, inside
          our red warning styling, on the screen where a vendor sends us money.
          An unknown code renders nothing at all. */}
      {bookingFeeErrorCopy(search.error) ? (
        <ShopNotice tone="gold" role="alert">
          {bookingFeeErrorCopy(search.error)}
        </ShopNotice>
      ) : null}

      <PageMasthead
        titleNode={
          <>
            Reference{' '}
            <span className="font-mono text-terracotta-700">{order.reference_code}</span>
          </>
        }
        actions={
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              ORDER_STATUS_TONE[order.status]
            }`}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        }
      />

      <section className="sn-tile space-y-3 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
          Order <span className="normal-case">{order.public_id}</span>
        </p>
        <p className="whitespace-pre-wrap text-sm text-ink/75">{order.description}</p>
        {topUp ? (
          // 💸 The top-up's stage, said on its own bill (prototype: Held → Due today → Overdue).
          <p
            role="status"
            data-top-up-stage={topUp.stage}
            className="rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold"
            style={{
              color: topUp.stage === 'overdue' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-warn))',
              background: `color-mix(in srgb, rgb(var(--color-${topUp.stage === 'overdue' ? 'danger' : 'warn'})) 12%, transparent)`,
            }}
          >
            {TOP_UP_WORDS.badge[topUp.stage]}
            {topUp.dueOn ? ` · the event day, ${formatDueDate(topUp.dueOn)}` : ''}
            <small className="block font-normal text-ink/65">
              {topUp.stage === 'held'
                ? 'Your quote rose, so your booking fee grows by this top-up. Nothing closes before the event day — you may settle it early.'
                : topUp.stage === 'due_today'
                  ? 'Due today. Nothing closes today; settle it before tomorrow to keep the event open.'
                  : 'Overdue. The event stays closed until it is settled — your chat with the couple stays open.'}
            </small>
          </p>
        ) : null}
        <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            Amount to send
          </p>
          <p className="font-mono text-2xl font-semibold text-ink">
            {formatPhp(totals.headlineTotal)}
          </p>
        </div>
        {payable ? (
          <p className="text-xs text-ink/55">
            Up for verification — once you pay and we confirm it (within 24 hours),
            this fee moves to paid automatically.
          </p>
        ) : null}
        {order.admin_notes ? (
          <p className="rounded-md bg-ink/[0.04] p-3 text-sm text-ink/75">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Note from Setnayan
            </span>
            <br />
            {order.admin_notes}
          </p>
        ) : null}
      </section>

      {payable ? (
        <section className="sn-tile space-y-4 p-5">
          <h2 className="sn-eye">Payment instructions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
                  Amount to send
                </p>
                <p className="font-mono text-lg font-semibold text-ink">
                  {formatPhp(totals.headlineTotal)}
                </p>
              </div>
              {/* ⚖ THE COPY VALUE KEEPS ITS CENTAVOS AND IS NEVER ROUNDED —
                  not up, and above all not down. GCash and BDO both accept a
                  centavo amount, so the exact figure is payable exactly as
                  typed; rounding DOWN underpays the charge and rounding UP
                  overpays it, and either one leaves an admin reconciling a
                  transfer against a number nobody ever recorded.
                  `String(837.5)` is `"837.5"` — the right value wearing the
                  wrong number of digits, and one keystroke away from `837.05`
                  in a bank field. `.toFixed(2)` is the same two decimals the
                  `/pay` QR carries in EMV tag 54 (see `lib/pay-amount.ts`), so
                  what a supplier PASTES and what their wallet PRE-FILLS are
                  the same digits. */}
              <CopyButton value={totals.headlineTotal.toFixed(2)} label="Copy" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-700">
                  Reference code
                </p>
                <p className="truncate font-mono text-lg font-semibold text-ink">
                  {order.reference_code}
                </p>
              </div>
              <CopyButton value={order.reference_code} label="Copy" />
            </div>
          </div>
          {/* 🔁 THE SECOND PAYMENT SURFACE THAT SAT HERE IS GONE (2026-09-20).
              It printed both receiving accounts and their STATIC QR codes —
              codes that carry no amount, which is the ₱0 scan the owner hit on
              this very lane ("the amount is not filled up. it only shows 0.",
              paying a real ₱837.50 booking fee). Below it, this page told the
              supplier to "log it below" — and the form it meant moved to /pay
              on 2026-08-21, so the instruction had been pointing at nothing.

              🔑 THE FACTS OF THE BILL STAY; THE WAYS TO PAY IT DO NOT. The
              amount and the reference above are what this page is FOR. Sending
              the money happens on /pay, which mints the code with the figure
              already inside it and takes the proof — see "Paying this fee"
              below, and app/_components/payment/payment-rails.tsx for the one
              surface every payment screen now renders. */}
          <p className="text-xs leading-relaxed text-ink/60">
            Include the{' '}
            <span className="font-semibold text-ink">reference code</span> in your
            transfer note so we can match it to this fee.
          </p>
        </section>
      ) : null}

      {/* ── SENDING THE MONEY LIVES ON THE ONE PAYMENT PAGE (owner 2026-08-21) ──
          What sat here asked the shop to type the amount and pick a rail with
          no code to scan. /pay puts the exact figure inside the QR.
          ⚖ The owner's 2026-08-06 rule — a reference is REQUIRED on this lane,
          because an admin reconciles this against a bank message rather than
          guessing — travels with it: `requiresReference` makes the field
          mandatory there and nowhere else. */}
      {payable ? (
        <section className="sn-tile space-y-3 p-5">
          <h2 className="sn-eye">Paying this fee</h2>
          <p className="text-sm text-ink/70">
            {feeWords.pointer} Have your {namesPhrase(openAccounts(settings).map((a) => a.label), 'bank or e-wallet')}{' '}
            confirmation to hand — we need its reference number to match your payment.
          </p>
          <Link
            href={payPath(order.reference_code)}
            className="button-primary inline-flex items-center gap-2"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {/* 💸 Rule 2: a top-up may be settled EARLY — before the event day the door says so. */}
            {topUp ? topUpPayLabel(topUp.dueOn, manilaToday()) : 'Send your payment'}
          </Link>
        </section>
      ) : null}

      {disputeStatus ? (
        <section className="sn-tile space-y-2 p-5" data-fee-dispute={disputeStatus}>
          <h2 className="sn-eye">Your dispute</h2>
          <p className="text-sm text-ink/75">
            {disputeStateLine(disputeStatus, disputeViewCount, dispute?.decision_note ?? null)}
          </p>
        </section>
      ) : search.dispute === 'error' || search.dispute === 'not_disputable' ? (
        <ShopNotice tone="gold" role="alert">
          {search.dispute === 'not_disputable'
            ? 'This fee can no longer be disputed here — it is not an open bill.'
            : 'We could not send your dispute just now. Nothing has changed. Please try again.'}
        </ShopNotice>
      ) : null}

      {canDispute ? (
        <section className="sn-tile space-y-3 p-5" data-fee-dispute-form="">
          <h2 className="sn-eye">Think this fee is wrong?</h2>
          <p className="text-sm text-ink/70">
            If this couple did not find you through Setnayan, tell us and we will look at it.
          </p>
          <form action={bookingFeeDispute} className="space-y-3">
            <input type="hidden" name="op" value="open" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <DisputeNoteField name="What happened?" empty="Optional" fieldName="reason" />
            <SubmitButton pendingLabel="Sending…" className="button-secondary">Dispute this fee</SubmitButton>
          </form>
        </section>
      ) : null}

      <section className="sn-tile space-y-3 p-5">
        <h2 className="sn-eye">Payment log</h2>
        {/* 🧾 RW-37: the bill's own placeholder row is not a payment — it used to read "PAID <today> · PENDING REVIEW". */}
        {loggedPayments.length === 0 ? (
          <p className="sn-row border-dashed p-4 text-center text-xs text-ink/55">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {loggedPayments.map((p) => (
              <li
                key={p.payment_id}
                className="flex flex-col gap-1 rounded-md bg-ink/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-mono font-semibold">{formatPhp(p.amount_php)}</span>
                    <span className="ml-2 text-ink/65">
                      · <PaymentChannelName settings={settings} channel={p.channel} />
                      {p.reference_number ? ` · ref ${p.reference_number}` : ''}
                    </span>
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Paid {p.paid_at}
                    {p.reviewed_at ? ` · reviewed ${p.reviewed_at.slice(0, 10)}` : ''}
                  </p>
                  {p.screenshot_url && paymentScreenshotMap[p.payment_id] ? (
                    <a
                      href={paymentScreenshotMap[p.payment_id]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-mulberry hover:underline"
                    >
                      Screenshot
                    </a>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    PAYMENT_STATUS_TONE[p.status]
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
