import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { UNBILLED_FEE_REPAIR_GAP_MS } from '@/lib/periodic-job-registry';
import { runDepositAcknowledgedEffects } from '@/lib/deposit-acknowledged-effects.server';
import {
  repairUnbilledCharges,
  unbilledFeeServiceKey,
  UNBILLED_SCAN_LIMIT,
  type PendingCharge,
  type RepairSummary,
  type UnbilledFacts,
} from '@/lib/unbilled-fee-repair';

/**
 * THE BILL THAT WAS NEVER RAISED — the I/O half. Every rule lives in the pure
 * sibling `lib/unbilled-fee-repair.ts`; this file only fetches and writes.
 *
 * ─── Where it runs, and why there ────────────────────────────────────────
 * This repo has NO scheduler, deliberately ([[this-repo-has-no-scheduler-deliberately]]):
 * `cron.job` is empty and `vercel.json` has `"crons": []`. Every periodic job
 * rides request traffic through Next `after()` with a DB compare-and-swap
 * (`claim_periodic_job`) picking one winner per window. This one is registered
 * in `PERIODIC_JOBS` as `booking-fee-unbilled-repair` and is mounted on BOTH the
 * vendor-dashboard layout and the admin layout — the same dual mount, for the
 * same reason, as `maybeRunLockRequestExpiry`:
 *
 * 🔑 IT IS FLEET-WIDE, NOT PER-VISITOR, AND THAT IS THE POINT. The existing
 * per-visitor catch-up (`maybeCatchUpAcknowledgedDeposits`) only ever repairs
 * the shop that is looking at its dashboard. A supplier who was never billed
 * has been told nothing is owed — they have no reason to open the page at all.
 * A per-visitor sweep would therefore reach every supplier EXCEPT the ones it
 * exists for. Any supplier's or admin's page view repairs the whole estate.
 */

/** Read the open, owed charges. Oldest first — the sweep's deterministic order. */
async function listPendingCharges(admin: SupabaseClient): Promise<PendingCharge[]> {
  const { data, error } = await admin
    .from('booking_fee_charges')
    .select('charge_id, event_vendor_id, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(UNBILLED_SCAN_LIMIT);
  if (error) {
    // 🪤 A REFUSED READ IS NOT AN EMPTY ESTATE. Returning [] here would make the
    // run record `rows_affected = 0` — "it ran and nothing was due" — for a
    // window in which we never found out. Throwing lets runClaimedJob write
    // ok=false with the message, which is the difference the job registry exists
    // for.
    logQueryError('unbilled-fee-repair.listPendingCharges', error);
    throw new Error(`pending charges unreadable: ${error.message}`);
  }
  return ((data ?? []) as Array<{
    charge_id: string;
    event_vendor_id: string | null;
    status: string;
    created_at: string;
  }>).map((r) => ({
    chargeId: r.charge_id,
    eventVendorId: r.event_vendor_id,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** Which of these charges already carry a bill. */
async function listBilledServiceKeys(
  admin: SupabaseClient,
  keys: readonly string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const { data, error } = await admin
    .from('orders')
    .select('service_key')
    .in('service_key', keys as string[]);
  if (error) {
    // ⚠ FAIL-SAFE, AND THE OPPOSITE WAY ROUND FROM THE READ ABOVE. An
    // unanswered "is it billed?" read as "no" would send every charge here
    // back through the collector. The DATABASE would refuse the second bill
    // (23505 → `already_billed`), so nothing double-bills — but provoking a
    // unique index is not how we answer a question we simply failed to ask.
    logQueryError('unbilled-fee-repair.listBilledServiceKeys', error);
    throw new Error(`existing bills unreadable: ${error.message}`);
  }
  return ((data ?? []) as Array<{ service_key: string | null }>)
    .map((r) => r.service_key)
    .filter((k): k is string => typeof k === 'string');
}

/**
 * The facts behind "why is there no bill", read fresh for a set of charges.
 *
 * Shared with `/admin/booking-fees` on purpose: the desk and the sweep must
 * agree about which charges are a person's problem and which are ours, and the
 * only way to guarantee that is one reader feeding one pure judge
 * ([[a-guard-on-the-call-cannot-see-the-argument]]).
 *
 * Best-effort per fact: a refused lookup leaves the charge looking repairable
 * (`bookingFound` true, payer present), which costs at most one wasted
 * collector run and never invents a durable cause for a read that just failed.
 */
export async function gatherUnbilledFacts(
  admin: SupabaseClient,
  charges: readonly PendingCharge[],
  nowMs: number = Date.now(),
): Promise<Map<string, UnbilledFacts>> {
  const out = new Map<string, UnbilledFacts>();
  const eventVendorIds = [...new Set(charges.map((c) => c.eventVendorId).filter((v): v is string => !!v))];

  const bookings = new Map<string, { acknowledged: boolean; archived: boolean; marketplaceVendorId: string | null }>();
  let bookingsReadable = true;
  if (eventVendorIds.length > 0) {
    const { data, error } = await admin
      .from('event_vendors')
      .select('vendor_id, deposit_acknowledged_at, archived_at, marketplace_vendor_id')
      .in('vendor_id', eventVendorIds);
    if (error) {
      logQueryError('unbilled-fee-repair.gatherUnbilledFacts.bookings', error);
      bookingsReadable = false;
    }
    for (const r of (data ?? []) as Array<{
      vendor_id: string;
      deposit_acknowledged_at: string | null;
      archived_at: string | null;
      marketplace_vendor_id: string | null;
    }>) {
      bookings.set(r.vendor_id, {
        acknowledged: !!r.deposit_acknowledged_at,
        archived: !!r.archived_at,
        marketplaceVendorId: r.marketplace_vendor_id,
      });
    }
  }

  const payers = new Map<string, string | null>();
  const profileIds = [...new Set([...bookings.values()].map((b) => b.marketplaceVendorId).filter((v): v is string => !!v))];
  let payersReadable = true;
  if (profileIds.length > 0) {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id')
      .in('vendor_profile_id', profileIds);
    if (error) {
      logQueryError('unbilled-fee-repair.gatherUnbilledFacts.payers', error);
      payersReadable = false;
    }
    for (const r of (data ?? []) as Array<{ vendor_profile_id: string; user_id: string | null }>) {
      payers.set(r.vendor_profile_id, r.user_id);
    }
  }

  for (const c of charges) {
    const booking = c.eventVendorId ? bookings.get(c.eventVendorId) : undefined;
    out.set(c.chargeId, {
      chargeId: c.chargeId,
      eventVendorId: c.eventVendorId,
      // ⚠ AN UNREADABLE LOOKUP IS NEVER A DURABLE VERDICT. "The booking is
      // gone", "it was archived", "nobody owns this shop" are all sentences
      // that send a person hunting; none of them may be produced by a read that
      // simply failed. When the read was refused every fact falls back to the
      // benign side, and the charge stays repairable (FEE-HONEST).
      bookingFound: booking ? true : !bookingsReadable,
      acknowledged: booking ? booking.acknowledged : !bookingsReadable,
      archived: booking ? booking.archived : false,
      payerUserId: booking
        ? resolvePayer(booking.marketplaceVendorId, payers, payersReadable)
        : // No booking row in hand: either it is genuinely gone (`booking_missing`
          // fires first and this value is never read) or the read was refused,
          // in which case the payer is unknown, not absent.
          (bookingsReadable ? null : PAYER_UNKNOWN),
      ageMs: Math.max(0, nowMs - Date.parse(c.createdAt)),
    });
  }
  return out;
}

/**
 * A stand-in payer for "we could not find out". Any non-null value keeps
 * {@link whyNotBilled} off the `no_payer` branch, which is a durable verdict
 * and must never come from a failed read.
 */
const PAYER_UNKNOWN = 'unknown';

function resolvePayer(
  profileId: string | null,
  payers: Map<string, string | null>,
  payersReadable: boolean,
): string | null {
  if (!profileId) return payersReadable ? null : PAYER_UNKNOWN;
  if (payers.has(profileId)) return payers.get(profileId) ?? null;
  return payersReadable ? null : PAYER_UNKNOWN;
}

/**
 * One pass. Returns the summary so the caller can record what it did.
 *
 * ⛔ IT REACHES THE COLLECTOR THROUGH `runDepositAcknowledgedEffects` AND
 * NOTHING ELSE. `lib/booking-fee-single-trigger.test.ts` holds the fee to
 * exactly one non-test call site of `collectBookingFeeAtLock` — a second one
 * here would be a second trigger, and the owner has ruled on WHEN the fee fires
 * five times. This is not a new trigger; it is the same one, finished.
 */
export async function runUnbilledFeeRepairSweep(admin: SupabaseClient): Promise<RepairSummary> {
  return repairUnbilledCharges({
    listPendingCharges: () => listPendingCharges(admin),
    listBilledServiceKeys: (keys) => listBilledServiceKeys(admin, keys),
    gatherFacts: (charges) => gatherUnbilledFacts(admin, charges),
    runEffects: (eventVendorId) =>
      runDepositAcknowledgedEffects(admin, { eventVendorId, door: 'unbilled_repair' }),
    report: (chargeId, reason) => {
      // Loud on purpose, every run. The whole defect is that a missing bill
      // looks exactly like a paid one from every surface we keep.
      console.error(
        `[unbilled-fee-repair] charge ${chargeId} is open and owed with NO bill: ${reason}`,
      );
    },
  });
}

/**
 * Cron-free pass, fired from `after()` on request traffic.
 *
 * Flag-gated: with `NEXT_PUBLIC_BOOKING_FEE_ENABLED` off the collector returns
 * `disabled` and there is nothing to repair, so the claim is not even taken.
 *
 * ⚠ THE FLAG DOES NOT SILENCE THE DESK. `/admin/booking-fees` classifies an
 * unbilled charge with the same pure judge whether or not the sweep can run, so
 * switching the fee off hides the repair, never the evidence.
 */
export async function maybeRunUnbilledFeeRepair(): Promise<void> {
  if (!isBookingFeeEnabled()) return;
  await runClaimedJob('booking-fee-unbilled-repair', UNBILLED_FEE_REPAIR_GAP_MS, async () => {
    const summary = await runUnbilledFeeRepairSweep(createAdminClient());
    // `rows_affected` is the number of bills this run actually RAISED — 0 is a
    // real, healthy answer and is stored as 0.
    return summary.billed;
  });
}
