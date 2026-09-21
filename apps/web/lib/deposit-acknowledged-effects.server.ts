import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { collectBookingFeeAtLock, resolveFeeAnchorRowId } from '@/lib/booking-fee-lock.server';
import { acquireSchedulePoolsForBooking } from '@/lib/schedule-pools';
import {
  judgeDepositEffects,
  type DepositEffectsDoor,
  type DepositEffectsOutcome,
} from '@/lib/deposit-acknowledged-effects';

/**
 * THE ONE PLACE THE DEPOSIT-ACKNOWLEDGED EFFECTS RUN.
 *
 * Owner 2026-07-27, ruling 5 of 5: *"when vendor accepts the payment, the
 * schedule is now locked"* and the vendor *"will be billed for the syncing fee
 * alongside accepting it."* One moment, two effects — the booking fee
 * (`collectBookingFeeAtLock`) and the schedule reservation
 * (`acquireSchedulePoolsForBooking`).
 *
 * ─── Why this is its own module, and not a block inside an action ────────
 * There are TWO doors to that one moment, and until 2026-09-18 only one of
 * them ran the effects:
 *
 *   1. the customer card's "Deposit received" → `vendorAcknowledgeDeposit`
 *      → RPC `acknowledge_vendor_deposit`. This door carried the fee + pool.
 *   2. the payment card's "Confirm" (thread page AND clients page) →
 *      `confirmVendorPayment` → RPC `confirm_vendor_payment`, which since H4
 *      calls `acknowledge_vendor_deposit` INSIDE SQL for the deposit's row.
 *      This door stamped the acknowledgement and ran NOTHING else.
 *
 * The platform's first real booking (rosa-ben × Saysay Host and Band) was
 * acknowledged through door 2 at 13:51:44Z. `deposit_acknowledged_at` landed,
 * the couple got their "confirmed your payment" email, and `booking_fee_ledger`
 * stayed at 0 rows — with no log line anywhere, because the code that would
 * have logged was in the other door. Same disease as the chat-lock path the
 * fee guard's docblock already describes: *this site bills from a card, not a
 * lock screen, so a sweep walks straight past it.*
 *
 * 🔑 So the effects live HERE, keyed on the booking row alone, and every door
 * calls this. `lib/deposit-acknowledge-fires-from-every-door.test.ts` fails if
 * a TypeScript caller of either acknowledging RPC does not also call this, and
 * `lib/booking-fee-single-trigger.test.ts` keeps the fee collector to this one
 * call site.
 *
 * ─── Every outcome is recorded ──────────────────────────────────────────
 * The collector fails open by design (a transient error must never trap an
 * already-committed acknowledge), so it RETURNS `{status:'skipped', reason}`
 * rather than throwing — and the old block read only `not_contracted` off it
 * and discarded every other reason. Here the whole outcome goes through
 * `judgeDepositEffects` and is written to the log on every call, and to Sentry
 * whenever it is not the expected shape. A waived first-of-five booking is OK
 * and says so; a skip says why.
 *
 * ─── Contract ────────────────────────────────────────────────────────────
 * • NEVER throws. The acknowledge already committed; nothing here may undo it.
 * • Idempotent: the fee RPC reuses its one live charge per (vendor × event),
 *   the order is keyed on that charge, and re-acquiring the same pool id is a
 *   no-op — so calling this twice for one booking is safe, which is what lets
 *   the render-time catch-up below exist.
 * • Reads `event_id` OFF THE ROW, never from a form. The old block took it from
 *   FormData and aimed an admin-client write at it (a confused deputy its own
 *   neighbour warned about).
 * • `admin` must be the service-role client: `event_vendors` has no supplier
 *   SELECT policy, and the pool acquire writes for the couple's event.
 */
export async function runDepositAcknowledgedEffects(
  admin: SupabaseClient,
  args: { eventVendorId: string; door: DepositEffectsDoor },
): Promise<DepositEffectsOutcome> {
  const { eventVendorId, door } = args;
  const outcome: DepositEffectsOutcome = {
    door,
    eventVendorId,
    eventId: null,
    acknowledged: false,
    anchorId: null,
    anchorUnreadable: null,
    feeEnabled: isBookingFeeEnabled(),
    fee: null,
    pool: null,
    thrown: null,
  };

  try {
    const { data: row, error } = await admin
      .from('event_vendors')
      .select('event_id, deposit_acknowledged_at')
      .eq('vendor_id', eventVendorId)
      .maybeSingle();
    const r = (row ?? null) as { event_id: string | null; deposit_acknowledged_at: string | null } | null;
    if (error) outcome.thrown = `booking read failed: ${error.message}`;
    outcome.eventId = r?.event_id ?? null;
    outcome.acknowledged = !!r?.deposit_acknowledged_at;

    if (outcome.eventId && outcome.acknowledged) {
      // Resolve the MONEY ROW first. A package's cascade rows can reach this
      // path (nothing in the DB stops a covered row carrying deposit markers),
      // and billing one would freeze a ledger ordinal on a row that must never
      // carry money. NULL ⇒ bill nothing, acquire nothing.
      outcome.anchorId = await resolveFeeAnchorRowId(admin, eventVendorId, (why) => {
        outcome.anchorUnreadable = why;
      });

      if (outcome.anchorId && outcome.feeEnabled) {
        // ONE KEY, NOT TWO — see collectBookingFeeAtLock's own note. The manual
        // QR rail is always live; `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` gates a
        // different, dormant path and is not consulted here.
        outcome.fee = await collectBookingFeeAtLock(createMoneyWriterClient(), {
          eventVendorId: outcome.anchorId,
        });
      }

      if (outcome.anchorId) {
        // Acquiring on the ANCHOR (not the row we were handed) is what stops a
        // package double-consuming the vendor's daily capacity: occupancy
        // counts every `event_vendor_id <> ours`, so an anchor-scoped acquire
        // plus an earlier covered-row acquire would eat two slots for one
        // booking and tell a real second couple the date is "fully booked".
        outcome.pool = await acquireSchedulePoolsForBooking(admin, outcome.eventId, outcome.anchorId);
      }
    }
  } catch (e) {
    outcome.thrown = e instanceof Error ? e.message : String(e);
  }

  recordDepositEffects(outcome);
  return outcome;
}

/**
 * Write the verdict down. The log line is the record; Sentry is the alarm.
 * Telemetry must never break the money path, so this swallows its own errors.
 */
function recordDepositEffects(outcome: DepositEffectsOutcome): void {
  try {
    const verdict = judgeDepositEffects(outcome);
    if (verdict.level === 'ok') {
      console.info(verdict.summary);
      return;
    }
    console.error(verdict.summary, outcome);
    Sentry.captureMessage(verdict.summary, {
      level: 'error',
      tags: { feature: 'deposit-acknowledged-effects', door: outcome.door },
      extra: { ...outcome },
    });
  } catch {
    /* recording must never break the acknowledge */
  }
}

/** How many acknowledged bookings one render may LOOK at (deterministic window). */
const CATCH_UP_SCAN_LIMIT = 200;
/** How many of them one render may actually run the effects for. */
const CATCH_UP_MAX_EFFECT_RUNS = 10;

/**
 * CRON-FREE CATCH-UP — the house pattern (`maybeSweepVendorBookingFeeNotifications`,
 * `runLoginGhostingCheck`): fired post-response via `after()` from the vendor
 * dashboard layout, for the signed-in supplier's OWN bookings only.
 *
 * Finds bookings this supplier has acknowledged that carry NO live fee charge —
 * i.e. the effects never ran for them — and runs them now. The 2026-09-18
 * booking is exactly that shape, and every booking acknowledged through door 2
 * before this shipped is too. Because `runDepositAcknowledgedEffects` is
 * idempotent this is safe to run on every render; because it scopes to
 * `marketplace_vendor_id IN (the caller's own profiles)` it never touches
 * another supplier's money; and because each run is recorded, a booking that
 * can NEVER be billed (`not_contracted`) is reported on every render rather
 * than once and forgotten — loud on purpose.
 *
 * ⚠ A covered cascade row is skipped (its anchor carries the money); an anchor
 * that was acknowledged only through its covered line is not found here and is
 * left to the doors.
 *
 * ─── ITS CONDITION IS "NO CHARGE AT ALL", AND ONLY THAT ──────────────────
 * A charge in `('pending','paid','waived_import','waived_free5')` counts as
 * charged here and is skipped — which is right for THIS sweep and was wrong as
 * a description of the money. A `pending` charge with no `orders` row behind it
 * is open, owed, and invisible: the collector opens the charge through the RPC
 * before it mints the bill, and can fail at five points in between. That second
 * absence is healed by `lib/unbilled-fee-repair.server.ts`, fleet-wide and
 * claimed — NOT here, because a supplier who was never billed has been shown
 * nothing owed and has no reason to open this page.
 *
 * ─── THE CAP IS ON THE WORK, NOT ON THE SCAN (fixed 2026-09-21) ──────────
 * This used to read 25 acknowledged bookings with **no ordering at all** and
 * then subtract the charged ones. Two defects in one line: PostgREST may hand
 * back the same arbitrary page every render, so at scale the sweep re-walks the
 * same few forever; and because the cap was applied BEFORE the subtraction, a
 * supplier whose 25 arbitrary rows were all already charged had a sweep that
 * could never reach the uncharged 26th — it would run, find nothing, and report
 * success. Now: scan a bounded, DETERMINISTIC oldest-acknowledged-first window,
 * subtract, and cap the number of effect runs. Oldest first because the oldest
 * unbilled booking is the one that has been uncollected longest.
 */
export async function maybeCatchUpAcknowledgedDeposits(userId: string): Promise<void> {
  if (!isBookingFeeEnabled()) return;
  try {
    const admin = createAdminClient();

    const { data: profiles } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', userId);
    const profileIds = ((profiles ?? []) as Array<{ vendor_profile_id: string }>).map(
      (p) => p.vendor_profile_id,
    );
    if (profileIds.length === 0) return;

    const { data: rows } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .in('marketplace_vendor_id', profileIds)
      .not('deposit_acknowledged_at', 'is', null)
      .is('archived_at', null)
      .or('package_role.is.null,package_role.neq.covered')
      .order('deposit_acknowledged_at', { ascending: true })
      .limit(CATCH_UP_SCAN_LIMIT);
    const acknowledged = ((rows ?? []) as Array<{ vendor_id: string }>).map((r) => r.vendor_id);
    if (acknowledged.length === 0) return;

    const { data: charges } = await admin
      .from('booking_fee_charges')
      .select('event_vendor_id')
      .in('event_vendor_id', acknowledged)
      .in('status', ['pending', 'paid', 'waived_import', 'waived_free5']);
    const charged = new Set(
      ((charges ?? []) as Array<{ event_vendor_id: string | null }>)
        .map((c) => c.event_vendor_id)
        .filter((id): id is string => typeof id === 'string'),
    );

    let runs = 0;
    for (const eventVendorId of acknowledged) {
      if (charged.has(eventVendorId)) continue;
      if (runs >= CATCH_UP_MAX_EFFECT_RUNS) break;
      runs += 1;
      await runDepositAcknowledgedEffects(admin, { eventVendorId, door: 'catch_up' });
    }
  } catch (e) {
    // Fail-soft: the dashboard already rendered. But not silent.
    console.error('[deposit-acknowledged-effects] catch-up sweep failed:', e);
  }
}
