import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  agreedTotalNow,
  CHANGE_LINES_EMBED,
  type ChangeLineRow,
} from '@/lib/agreed-total-and-its-changes';
import type { GuestCountFact, PaymentFact } from '@/lib/thread-decisions';
import type { PaxSurchargeProposal } from '@/lib/pax';

/**
 * thread-decision-sources.server.ts — the two Decisions sources that are NOT
 * messages, read once and shaped for `buildThreadDecisions`.
 *
 * The conversation's Decisions view merges three sources. Four card kinds ride
 * on `chat_messages` and resolve themselves in the stream; the couple's logged
 * payments and the guest-count change are PAGE SECTIONS rendered around that
 * stream, so they can only reach it from the server. This module is where both
 * sides get them, so the couple's answer to "where are we with this supplier?"
 * and the supplier's answer are read from the same rows.
 *
 * ── ⚠ WHY THIS DOES NOT CALL `fetchPendingVendorPayments` ───────────────────
 * That helper exists for the supplier's "confirm this payment" section and
 * filters `.is('vendor_confirmed_at', null)` — it returns ONLY the unconfirmed
 * ones. Decisions is a record of what was decided, so a payment the supplier
 * already confirmed must still be listed, saying "Confirmed received · 8 Sep".
 * Feeding this view from that helper would delete the settled money from the
 * record of what was settled — silently, and in the direction that matters.
 *
 * So this reads the same table with the same booking scoping and NO status
 * filter, and lets the `now` line say which state each row is in.
 */

type PaymentRow = {
  payment_id: string;
  vendor_id: string;
  amount_php: number;
  paid_at: string | null;
  method: string | null;
  notes: string | null;
  vendor_confirmed_at: string | null;
};

/**
 * Every payment the couple logged against this supplier's bookings on this
 * event, confirmed or not.
 *
 * `adminClient` because `event_vendor_payments` is couple-RLS'd: the supplier
 * is a party to the money but not to the row's owning policy, which is the same
 * reason the pending-payments helper takes one. Scoping is by the supplier's
 * OWN bookings (`marketplace_vendor_id`), so this never widens what either side
 * can see beyond the thread they are already in.
 *
 * Graceful: a refused or thrown read yields `[]` and the Decisions list simply
 * has no payment rows — it never blocks the thread from rendering.
 */
export async function fetchThreadPayments(opts: {
  adminClient: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
}): Promise<PaymentFact[]> {
  const { adminClient, eventId, vendorProfileId } = opts;

  const { data: bookings, error: bookingErr } = await adminClient
    .from('event_vendors')
    // The change lines ride in the same query: "₱50,000 of ₱X" is a part of the
    // agreed total NOW (owner 2026-09-11, "Show the total now"), not of the
    // price the lock wrote. A refused embed lands in the `bookingErr` branch.
    .select(`vendor_id, total_cost_php, ${CHANGE_LINES_EMBED}`)
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId);

  if (bookingErr) {
    logQueryError('[decisions] bookings for payments', bookingErr);
    return [];
  }

  const rows = (bookings ?? []) as Array<{
    vendor_id: string;
    total_cost_php: number | null;
    change_lines?: ChangeLineRow[] | null;
  }>;
  const ids = rows.map((b) => b.vendor_id).filter(Boolean);
  if (ids.length === 0) return [];

  // The booking's committed cost — what "₱50,000 of ₱187,500" is a part of —
  // as the agreed total NOW, through the one rule the budget uses.
  const totalByBooking = new Map<string, number | null>(
    rows.map((b) => [b.vendor_id, agreedTotalNow(b.total_cost_php, b.change_lines)]),
  );

  const { data, error } = await adminClient
    .from('event_vendor_payments')
    .select('payment_id, vendor_id, amount_php, paid_at, method, notes, vendor_confirmed_at')
    .in('vendor_id', ids);

  if (error) {
    logQueryError('[decisions] thread payments', error);
    return [];
  }

  return ((data ?? []) as PaymentRow[])
    .map((p): PaymentFact | null => {
      const loggedAtMs = p.paid_at ? Date.parse(p.paid_at) : NaN;
      // A row with no readable date cannot be placed on a timeline, and putting
      // it at the epoch would park it above everything. Drop it rather than lie
      // about when it happened.
      if (!Number.isFinite(loggedAtMs)) return null;
      const confirmed = p.vendor_confirmed_at ? Date.parse(p.vendor_confirmed_at) : NaN;
      return {
        paymentId: p.payment_id,
        loggedAtMs,
        amountPhp: p.amount_php,
        method: p.method,
        label: p.notes,
        confirmedAtMs: Number.isFinite(confirmed) ? confirmed : null,
        ofTotalPhp: totalByBooking.get(p.vendor_id) ?? null,
      };
    })
    .filter((x): x is PaymentFact => x != null);
}

/**
 * The guest-count change, as Decisions sees it.
 *
 * Takes the proposals the page already fetched rather than re-reading them:
 * `fetchVendorPaxProposals` is not a cheap call (it reads the event's pricing
 * mode, the bookings and their frozen plans) and the supplier's thread page
 * runs it already. One read, two renderings.
 *
 * ⚠ `changedAtMs` is the CURRENT time, not a stored one. There is no
 * "guest count changed at" column anywhere — a surcharge proposal is DERIVED
 * live from the gap between `cost_basis_pax` and the live headcount, and exists
 * only while that gap does. So the honest timestamp for "this is outstanding"
 * is now, which places it at the end of the timeline where an outstanding
 * decision belongs. Inventing an earlier date from `events.updated_at` would be
 * a fabricated fact about when the couple changed their mind.
 */
export function paxProposalsToGuestCounts(
  proposals: readonly PaxSurchargeProposal[],
  nowMs: number,
): GuestCountFact[] {
  return proposals.map((p) => ({
    id: p.eventVendorId,
    changedAtMs: nowMs,
    livePax: p.livePax,
    quotedPax: p.quoteBasePax,
    surchargePhp: p.delta,
  }));
}

/**
 * The live quote total for this supplier on this event, IN PESOS.
 *
 * The standing sentence prints it on exactly one rung — "Quoted ₱187,500 ·
 * waiting on you" — and prints nothing anywhere else (see `STAGE_VOICE` in
 * `supplier-standing.ts`). Read under the CALLER's own RLS: the supplier sees
 * their own proposals, the couple sees the ones sent to their event, so neither
 * side learns anything here it could not already read.
 *
 * ⚠ Only `sent` / `viewed` / `accepted` count. A draft is not a quote, and a
 * declined or expired one is not a live number — printing either beside the
 * word "Quoted" would put a price on a card that nobody is standing behind.
 * Highest total wins when several are live, matching the bench's own choice.
 */
export async function fetchLiveQuoteTotalPhp(opts: {
  supabase: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
}): Promise<number | null> {
  const { supabase, eventId, vendorProfileId } = opts;
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select('total_centavos, status')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .in('status', ['sent', 'viewed', 'accepted']);

  if (error) {
    logQueryError('[decisions] live quote total', error);
    return null;
  }
  const totals = ((data ?? []) as Array<{ total_centavos: number | null }>)
    .map((p) => p.total_centavos)
    .filter((c): c is number => typeof c === 'number');
  if (totals.length === 0) return null;
  return Math.round(Math.max(...totals) / 100);
}
