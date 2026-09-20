/**
 * THE NEXT MONEY STEP, READ — the I/O half of `moneyStep`
 * (lib/accepted-quote-terms.ts, the pure rule its test executes).
 *
 * One read shape for every surface that shows a booked supplier's money: the
 * couple's "Amount to pay" card, both ends of the chat quote card, the public
 * proposal page. Three reads, each kept apart from "none":
 *   • the booking row (status + deposit markers) — refused → step 'unknown';
 *   • the accepted quote (`ACCEPTED_QUOTE_SELECT`) — refused → no terms, and
 *     `termsUnreadable` says so (the minimum is still enforced server-side by
 *     `recordDeposit`, which fails closed on its own read);
 *   • the ledger — refused → `ledger: null`, never ₱0.
 *
 * The caller chooses the client: the couple's own RLS client on couple pages;
 * the admin client on supplier pages ONLY after the page has proven the
 * supplier owns this booking (a supplier holds no `event_vendors` RLS).
 */
import 'server-only';
import { depositProofDisplayUrl } from '@/lib/deposit-proof.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACCEPTED_QUOTE_SELECT,
  acceptedQuoteTerms,
  moneyStep,
  type AcceptedQuoteRow,
  type AcceptedQuoteTerms,
  type MoneyStep,
} from './accepted-quote-terms';
import { CONFIRMED_VENDOR_STATUSES } from './events';

export type BookedMoney = {
  step: MoneyStep;
  terms: AcceptedQuoteTerms | null;
  termsUnreadable: boolean;
  /** `event_vendors.vendor_id` — the booking the actions post against. */
  eventVendorId: string | null;
  /** The booking's deposit markers, for the card that renders them. null = unread. */
  deposit: {
    recordedAt: string | null;
    acknowledgedAt: string | null;
    declinedAt: string | null;
    declineReason: string | null;
    /**
     * The couple's receipt as a SHORT-LIVED SIGNED LINK, or null.
     *
     * 🔒 SIGNED HERE, NOT HANDED ON RAW. The first draft of this returned the
     * stored `r2://` ref and let each caller sign it — and
     * `lib/deposit-proofs-are-private.test.ts` refused it, correctly: its
     * invariant is that a file which READS `deposit_proof_url` is the file that
     * passes it through `depositProofDisplayUrl`. Two callers signing for
     * themselves is two chances to forget, and forgetting means either no
     * receipt or a raw ref in an `<img src>`. So the one read signs once,
     * scoped to its own `eventId`, and nobody downstream can get it wrong.
     *
     * null for: no receipt, a value that fails the event's own folder policy,
     * or an unavailable signer. Fail-soft by construction — this function's
     * whole job is the money STEP, and a receipt must never cost a caller that.
     */
    proofUrl: string | null;
  } | null;
  /**
   * The ledger row that IS the first payment (`is_deposit_record`), still
   * unconfirmed — what the supplier's "Confirm" posts (`confirmVendorPayment`,
   * which acknowledges the deposit through `confirm_vendor_payment`). null = none.
   */
  firstPaymentRowId: string | null;
};

const NONE = { deposit: null, firstPaymentRowId: null } as const;

const CONFIRMED = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

export async function readBookedMoney(
  db: SupabaseClient,
  args: {
    eventId: string;
    /** Either the booking id, or the supplier's profile id on this event. */
    eventVendorId?: string | null;
    vendorProfileId?: string | null;
    eventDate?: string | null;
  },
): Promise<BookedMoney> {
  let bookingQuery = db
    .from('event_vendors')
    .select(
      'vendor_id, status, marketplace_vendor_id, deposit_recorded_at, deposit_acknowledged_at, deposit_declined_at, deposit_decline_reason, deposit_proof_url, created_at',
    )
    .eq('event_id', args.eventId);
  if (args.eventVendorId) bookingQuery = bookingQuery.eq('vendor_id', args.eventVendorId);
  else if (args.vendorProfileId) bookingQuery = bookingQuery.eq('marketplace_vendor_id', args.vendorProfileId);
  else return { step: { kind: 'not_booked' }, terms: null, termsUnreadable: false, eventVendorId: null, ...NONE };

  const { data: bookingRows, error: bookingErr } = await bookingQuery
    .order('created_at', { ascending: false })
    .limit(5);
  if (bookingErr) {
    console.error('[readBookedMoney] booking read refused', bookingErr.message, { event_id: args.eventId });
    return { step: { kind: 'unknown' }, terms: null, termsUnreadable: false, eventVendorId: args.eventVendorId ?? null, ...NONE };
  }
  const rows = (bookingRows ?? []) as {
    vendor_id: string;
    status: string | null;
    marketplace_vendor_id: string | null;
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_declined_at: string | null;
    deposit_decline_reason: string | null;
    deposit_proof_url: string | null;
  }[];
  // A supplier can sit on one event twice (two categories); the booked row wins.
  const booking = rows.find((r) => CONFIRMED.has(r.status ?? '')) ?? rows[0] ?? null;
  if (!booking) {
    return { step: { kind: 'not_booked' }, terms: null, termsUnreadable: false, eventVendorId: null, ...NONE };
  }

  let terms: AcceptedQuoteTerms | null = null;
  let termsUnreadable = false;
  if (booking.marketplace_vendor_id) {
    const { data: quoteRows, error: quoteErr } = await db
      .from('vendor_proposals')
      .select(ACCEPTED_QUOTE_SELECT)
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', booking.marketplace_vendor_id)
      .eq('status', 'accepted')
      .limit(1);
    if (quoteErr) {
      console.error('[readBookedMoney] accepted-quote read refused', quoteErr.message, { event_id: args.eventId });
      termsUnreadable = true;
    } else {
      terms = acceptedQuoteTerms((quoteRows ?? []) as AcceptedQuoteRow[], args.eventDate ?? null);
    }
  }

  const { data: payRows, error: payErr } = await db
    .from('event_vendor_payments')
    .select('payment_id, amount_php, is_deposit_record, vendor_confirmed_at')
    .eq('event_id', args.eventId)
    .eq('vendor_id', booking.vendor_id);
  let ledger: { count: number; paidCentavos: number; recordedFirstCentavos: number | null } | null = null;
  let firstPaymentRowId: string | null = null;
  if (payErr) {
    console.error('[readBookedMoney] ledger read refused', payErr.message, { event_id: args.eventId });
  } else {
    const pays = (payRows ?? []) as {
      payment_id: string;
      amount_php: number | string | null;
      is_deposit_record: boolean | null;
      vendor_confirmed_at: string | null;
    }[];
    const c = (v: number | string | null) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    };
    const first = pays.filter((p) => p.is_deposit_record === true);
    firstPaymentRowId = first.find((p) => !p.vendor_confirmed_at)?.payment_id ?? null;
    ledger = {
      count: pays.length,
      paidCentavos: pays.reduce((sum, p) => sum + c(p.amount_php), 0),
      recordedFirstCentavos: first.length > 0 ? first.reduce((s, p) => s + c(p.amount_php), 0) : null,
    };
  }

  return {
    step: moneyStep({
      terms,
      booked: CONFIRMED.has(booking.status ?? ''),
      deposit: {
        recordedAt: booking.deposit_recorded_at,
        acknowledgedAt: booking.deposit_acknowledged_at,
        declinedAt: booking.deposit_declined_at,
      },
      ledger,
    }),
    terms,
    termsUnreadable,
    eventVendorId: booking.vendor_id,
    deposit: {
      recordedAt: booking.deposit_recorded_at,
      acknowledgedAt: booking.deposit_acknowledged_at,
      declinedAt: booking.deposit_declined_at,
      declineReason: booking.deposit_decline_reason,
      proofUrl: await depositProofDisplayUrl(booking.deposit_proof_url, args.eventId).catch(
        () => null,
      ),
    },
    firstPaymentRowId,
  };
}
