import { openAccounts } from '@/lib/payment-channels';
import { paymentWasLogged } from '@/lib/payment-logged';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { paymentProofPolicy } from '@/lib/r2-client-ref';
import { computeOrderTotals, fetchOrderById, fetchPaymentsForOrder } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { everyOpenRailCarriesAmount, qrWords } from '@/lib/qr-amount-truth';
import { payAmount } from '@/lib/pay-amount';
import { isVendorBookingFeeServiceKey, isFeeOrderPayable } from '@/lib/vendor-booking-fees';
import { BookingFeeBody, BookingFeeReadFailed } from './fee-body';
import { createAdminClient } from '@/lib/supabase/admin';
import { chargeIdFromBookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { asDisputeStatus, foundYouLine } from '@/lib/booking-fee-dispute';
import { TOP_UP_CHARGE_KIND, topUpStage, type TopUpStage } from '@/lib/booking-fee-top-up';
import { manilaToday } from '@/lib/std-views';
import { logQueryError } from '@/lib/supabase/error-detect';
import { batchOrUnread } from '@/lib/booking-fees-page-reads';

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
  // 🧾 HONEST READ (supplier pages set two, Honest state · new): `fetchOrderById` THROWS on a refused read, which
  // rendered the error page as if the fee did not exist. A read that did not answer is said in place, with Try again;
  // only a read that answered with no row (or somebody else's bill) is the not-found page.
  let order: Awaited<ReturnType<typeof fetchOrderById>>;
  try {
    order = await fetchOrderById(supabase, orderId);
  } catch (err) {
    logQueryError('booking-fees/[orderId]: the fee', { message: err instanceof Error ? err.message : String(err) });
    return <BookingFeeReadFailed orderId={orderId} />;
  }
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
  // 🧾 A6-60 (final check 25 Nov): `fetchPaymentsForOrder` and the settings read THROW on a refused read — inside this
  // batch that used to reach the dashboard's error screen. Said in place, like the bill's own read above.
  const batch = await batchOrUnread(
    () =>
      Promise.all([
    fetchPaymentsForOrder(supabase, orderId),
    fetchPlatformSettings(supabase),
    chargeId
      ? supabase
          .from('booking_fee_disputes')
          .select('status, decision_note')
          .eq('charge_id', chargeId)
          .maybeSingle()
      : { data: null, error: null },
    ]),
    (err) => logQueryError('booking-fees/[orderId]: payments or settings', { message: err instanceof Error ? err.message : String(err) }),
  );
  if (!batch) return <BookingFeeReadFailed orderId={orderId} />;
  const [payments, settings, disputeRead] = batch;
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
  /*
    🕵️ FOUND YOU (owner 16 Nov 2026, DECISION_LOG e5d166cd (2)): every bill now says where and when the couple found
    the shop — "Found you on Setnayan · from Search, 3 Nov" — from the same found-record, same scope (THIS bill's own
    event and shop). Read for every bill with a charge, not only an accepted dispute. A failed or empty read draws no
    line, never a guess.
  */
  let disputeViewCount: number | null = null;
  let foundLine: string | null = null;
  // 💸 A TOP-UP (owner 2026-11-12, `lib/booking-fee-top-up.ts`): the fee grew with a booked quote. It is due on the
  // event day — "Settle early" before it (rule 2), "Due today" on it, overdue after. A6-61(c): THIS bill's own charge is
  // read ONCE (service role, proven the caller's above) for both the found-you line and the top-up; a failed read is
  // logged and draws no found-you line and the bill exactly as shipped.
  let topUp: { stage: TopUpStage; dueOn: string | null } | null = null;
  if (chargeId) {
    const admin = createAdminClient();
    const { data: charge, error: chargeErr } = await admin
      .from('booking_fee_charges')
      .select('event_id, vendor_profile_id, kind, expires_at')
      .eq('charge_id', chargeId)
      .maybeSingle();
    if (chargeErr) logQueryError('booking-fees/[orderId]: the bill’s charge', chargeErr);
    const c = charge as { event_id: string | null; vendor_profile_id: string; kind: string | null; expires_at: string | null } | null;
    if (c?.event_id) {
      const { data: found, error: foundErr } = await admin
        .from('event_vendor_found')
        .select('view_count, first_found_at, first_source')
        .eq('event_id', c.event_id)
        .eq('vendor_profile_id', c.vendor_profile_id)
        .maybeSingle();
      if (foundErr) logQueryError('booking-fees/[orderId]: found-you record', foundErr);
      const f = found as { view_count?: number; first_found_at?: string | null; first_source?: string | null } | null;
      if (disputeStatus === 'auto_accepted') disputeViewCount = f?.view_count ?? null;
      foundLine = foundYouLine(f?.first_found_at, f?.first_source);
    }
    if (payable && c?.kind === TOP_UP_CHARGE_KIND) {
      const dueOn = c.expires_at ? c.expires_at.slice(0, 10) : null;
      topUp = { stage: topUpStage(dueOn, manilaToday()), dueOn };
    }
  }
  // Disputable: an open bill, no dispute yet, and the dispute read answered.
  const canDispute = payable && Boolean(chargeId) && dispute === null;

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
    <BookingFeeBody
      orderId={orderId}
      order={order}
      headlineTotal={totals.headlineTotal}
      payable={payable}
      foundLine={foundLine}
      topUp={topUp}
      pointer={feeWords.pointer}
      settings={settings}
      disputeStatus={disputeStatus}
      disputeViewCount={disputeViewCount}
      decisionNote={dispute?.decision_note ?? null}
      canDispute={canDispute}
      loggedPayments={loggedPayments}
      screenshots={paymentScreenshotMap}
      search={search}
    />
  );
}
