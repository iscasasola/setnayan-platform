/**
 * Verified-Median Pricing — the server reader (fetch → feed the pure math).
 *
 * PRICE-SOURCE DECISION (flagged — the load-bearing call)
 * -------------------------------------------------------
 * "Which is the couple-confirmed declared price per lock?" There are three
 * candidates in the schema:
 *   • event_vendors.total_cost_php   — the couple's ledger figure for a booking
 *   • accepted vendor_proposals.total_centavos — a vendor-sent, couple-accepted
 *   • the 'contracted' status        — the lock milestone itself
 *
 * We read the MEDIAN over **event_vendors.total_cost_php on CONFIRMED, LINKED,
 * non-excluded rows** — i.e. `linked_vendor_profile_id = <vendor>`,
 * `status IN CONFIRMED_VENDOR_STATUSES` ('contracted' onward = the lock),
 * `total_cost_php > 0`, `excluded_from_market_median = FALSE`.
 *
 * WHY event_vendors and not accepted proposals directly:
 *   1. It is the SINGLE consolidated store of the couple-confirmed price. When a
 *      couple accepts a proposal, respond_vendor_proposal() (PR3,
 *      20270201674389) already writes that amount INTO the couple's
 *      event_vendors row (total_cost_php = proposal.total_centavos/100). The
 *      slot-lock path writes the same row (status→contracted +
 *      linked_vendor_profile_id). So event_vendors is downstream of BOTH lock
 *      paths — reading it captures every lock without double-counting.
 *   2. It is naturally ~one row per (event, vendor). A vendor who sends three
 *      proposals for one wedding would otherwise contribute three prices to
 *      their own median; the event_vendors row collapses that to the one
 *      couple-confirmed number.
 *   3. `contracted` (the status the couple's plan reaches on a real commitment)
 *      IS the lock the idea hinges on — CONFIRMED_VENDOR_STATUSES is exactly
 *      that set, already the platform's canonical "this is a booking" gate.
 *
 * RLS / privacy: the public couple-facing card renders for anon/couple viewers
 * who have NO RLS read on other couples' event_vendors rows. So — exactly like
 * the published-price band reader (price-position.ts) — this reads via the
 * ADMIN client and returns ONLY a de-identified aggregate (median + count +
 * range). No per-row price, event id, or couple identity ever leaves the server.
 *
 * COMPETITION-LAW guard: this reader computes a vendor's OWN median from a
 * vendor's OWN locks. It performs NO cross-vendor comparison and emits no
 * "below/above market" judgement. The couple-facing card shows the vendor's own
 * typical price; it never labels the vendor cheap or expensive.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import {
  computeVerifiedMedian,
  roundToTypicalBand,
  type MedianSample,
  type VerifiedMedianResult,
} from '@/lib/verified-median';

export type VendorVerifiedMedian = {
  /** The raw guarded result (established | not_established). */
  result: VerifiedMedianResult;
  /**
   * The public "typical price" — median rounded to a soft band (privacy), or
   * null when not established. Couple-facing surfaces use ONLY this field.
   */
  typicalPricePhp: number | null;
  /** Category the median was scoped to, or null for all-categories. */
  category: string | null;
};

const NOT_ESTABLISHED: VerifiedMedianResult = { status: 'not_established', sampleN: 0 };

/**
 * Compute a vendor's verified median from their locked bookings.
 *
 * @param vendorProfileId  the marketplace vendor (ownership is the caller's
 *                         concern; this only reads de-identified aggregates).
 * @param opts.category    scope to one `event_vendors.category`. Default: all
 *                         of the vendor's locks across categories. (Per-category
 *                         medians are a sensible refinement — flagged as
 *                         follow-up; most vendors serve one primary category so
 *                         the all-categories median is a faithful V1 signal.)
 */
export async function fetchVendorVerifiedMedian(
  vendorProfileId: string,
  opts?: { category?: string | null },
): Promise<VendorVerifiedMedian> {
  const category = opts?.category ?? null;
  const empty: VendorVerifiedMedian = { result: NOT_ESTABLISHED, typicalPricePhp: null, category };

  if (!vendorProfileId) return empty;

  const admin = createAdminClient();

  let query = admin
    .from('event_vendors')
    .select('total_cost_php, category')
    .eq('linked_vendor_profile_id', vendorProfileId)
    .eq('excluded_from_market_median', false)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
    .not('total_cost_php', 'is', null)
    .gt('total_cost_php', 0);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  // Fail closed to "not established" — never fabricate a price on a read error.
  if (error || !data) return empty;

  const samples: MedianSample[] = (data as { total_cost_php: number | string | null }[]).map(
    (r) => ({ pricePhp: Number(r.total_cost_php) }),
  );

  const result = computeVerifiedMedian(samples);
  const typicalPricePhp =
    result.status === 'established' ? roundToTypicalBand(result.medianPhp) : null;

  return { result, typicalPricePhp, category };
}
