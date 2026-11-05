import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification, type EmitNotificationArgs } from '@/lib/notification-emit';
import {
  computePlanInstances,
  defaultPaymentScheduleRows,
  type PaymentScheduleItemRow,
} from '@/lib/vendor-service-payment-schedules';
import {
  agreedTotalNow,
  CHANGE_LINES_EMBED,
  type ChangeLineRow,
} from '@/lib/agreed-total-and-its-changes';
import { lockMayOverwritePlan, redateOnLockInstalments } from '@/lib/self-added-payment-plan';
import { manilaTodayIso } from '@/lib/vendor-cashflow';

/**
 * lib/booking-payment-plan.server.ts — THE PAYMENT PLAN OF A BOOKING IS FROZEN
 * THE MOMENT THE BOOKING EXISTS, WHICHEVER PRESS MADE IT EXIST.
 *
 * 🔴 WHY THIS IS A FILE (2026-10-10). The plan snapshot and its "your payment
 * info is ready" notice lived INSIDE `finalizeVendor`, below the line where the
 * lock handshake returns. With the handshake on, the couple's press only ASKS
 * and returns; the booking is made later, by the supplier's yes
 * (`vendorAgreeToLock`) — and nothing there froze a plan. A comment said these
 * effects "run from vendorAgreeToLock". They did not. So a marketplace booking
 * made the normal way had NO row in `event_vendor_payment_plan` and
 * `payment_info_sent` never fired: the couple asked, the supplier said yes,
 * and the money step that connects them was missing.
 *
 * 🔑 ONE FUNCTION, TWO CALLERS, NOT ONE NEW NUMBER. `freezePaymentPlanAtBooking`
 * is the block that was in `finalizeVendor`, moved here whole: the same reads,
 * the same `computePlanInstances`, the same 50/50 estimate when the service has
 * no schedule, the same "the couple's own plan survives" rule, the same upsert,
 * the same notice. `finalizeVendor` calls it on the direct path;
 * `freezePaymentPlanAfterSupplierAgreed` calls it at the yes.
 *
 * WHAT THE YES PATH READS OFF THE ROW, because the direct path had it in hand:
 *   · the booking  → `event_vendors` (vendor_name, marketplace_vendor_id,
 *                    service_id) — the same row `finalizeVendor` loaded;
 *   · the lock day → today, the day of the yes. The plan anchors on the
 *                    AGREEMENT, never the request: a supplier answering two
 *                    days later must not inherit a downpayment dated before
 *                    they said yes;
 *   · who to tell  → `lock_requested_by_user_id`, the host who pressed the ask —
 *                    the same person the direct path tells (its acting user).
 *
 * ⛔ TWO THINGS IT DELIBERATELY DOES NOT DO, both reported rather than guessed:
 *   · A PACKAGE booking (`event_vendor_package_id` set) gets no plan here,
 *     because the package's own direct path (`lockPackage`) writes none either.
 *     Its covered rows carry ₱0, and a 50/50 estimate of ₱0 would be an
 *     invented plan.
 *   · A booking whose asker was NOT recorded gets its plan and NO notice. The
 *     chat door (`bookVendorAtChatLock`) writes the ask without
 *     `lock_requested_by_user_id`, and an erased account leaves it NULL. The
 *     notice is never addressed to a guess; the couple is still told the yes
 *     (`lock_request_agreed`).
 *
 * Best-effort, like the block it came from: a snapshot failure never rolls the
 * booking back. Every refused read is logged.
 */

type Emit = (args: EmitNotificationArgs) => Promise<void>;

export type FreezePlanResult =
  | {
      status: 'written' | 'kept_couple_plan';
      instances: number;
      seededDefault: boolean;
      /** TRUE when "your payment info is ready" was sent to somebody. */
      told: boolean;
    }
  | { status: 'failed'; reason: string };

export type BookingForPlan = {
  vendor_name: string | null;
  marketplace_vendor_id: string | null;
  service_id: string | null;
};

/**
 * Freeze the booked service's payment schedule into `event_vendor_payment_plan`
 * and tell the host their payment info is ready.
 *
 * Resolution (`computePlanInstances`, pure):
 *   • amount: percent → agreed total × percent_bps / 10000; fixed →
 *     amount_centavos / 100. A percent instalment with NO total keeps
 *     amount_php:null + its percent_bps so it resolves later.
 *   • due_date: on_lock → lock date + offset; before_event → event_date −
 *     offset (null when the event has no date).
 * A service with NO schedule still gets a plan row (empty instances) so the
 * couple sees "pay them directly".
 */
export async function freezePaymentPlanAtBooking(
  planAdmin: SupabaseClient,
  args: {
    eventId: string;
    vendorId: string;
    booking: BookingForPlan;
    /** Who is told. `null` = nobody is recorded; the plan is still written. */
    tellUserId: string | null;
    /** The caller's name, for the log lines. */
    tag: string;
  },
  deps: { emit: Emit } = { emit: emitNotification },
): Promise<FreezePlanResult> {
  const { eventId, vendorId, booking, tag } = args;

  // Pull the booking total + event date for the resolution inputs.
  const [{ data: evRow, error: evRowErr }, { data: eventRow, error: eventRowErr }] =
    await Promise.all([
      planAdmin
        .from('event_vendors')
        // Plan amounts are shares of the agreed total NOW (changes included).
        .select(`total_cost_php, ${CHANGE_LINES_EMBED}`)
        .eq('event_id', eventId)
        .eq('vendor_id', vendorId)
        .maybeSingle(),
      planAdmin.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
    ]);
  if (evRowErr) {
    console.error(`[${tag}] payment-plan booking total read failed:`, evRowErr.message);
  }
  if (eventRowErr) {
    console.error(`[${tag}] payment-plan event date read failed:`, eventRowErr.message);
  }
  const planRow = evRow as
    | { total_cost_php: number | null; change_lines?: ChangeLineRow[] | null }
    | null;
  const totalCostPhp = agreedTotalNow(planRow?.total_cost_php ?? null, planRow?.change_lines);
  const eventDateIso = (eventRow as { event_date: string | null } | null)?.event_date ?? null;
  // A self-added supplier's lock day is the day the couple clicked, in
  // Manila — a 7am lock is not "yesterday". The marketplace path keeps its
  // existing UTC day; changing it is a separate decision.
  const lockDateIso = booking.marketplace_vendor_id
    ? new Date().toISOString().slice(0, 10)
    : manilaTodayIso();

  // Read the booked service's schedule template (seq-ordered). Off-platform /
  // serviceless bookings → no rows → empty plan (direct-pay fallback).
  let scheduleRows: PaymentScheduleItemRow[] = [];
  if (booking.service_id) {
    const { data: rows, error: rowsErr } = await planAdmin
      .from('vendor_service_payment_schedules')
      .select('*')
      .eq('vendor_service_id', booking.service_id)
      .order('seq', { ascending: true });
    if (rowsErr) {
      console.error(`[${tag}] payment-plan schedule read failed:`, rowsErr.message);
    }
    scheduleRows = (rows ?? []) as PaymentScheduleItemRow[];
  }

  // Default-seed: a marketplace vendor with a known total but NO configured
  // schedule would otherwise hand the couple an empty plan / silent "pay
  // directly". Seed a 50/50 ESTIMATED plan instead (flagged below) so the
  // couple always sees a downpayment + balance they can confirm. Skipped when
  // there's no total to estimate against — an empty plan is the honest state.
  const seededDefault = scheduleRows.length === 0 && totalCostPhp != null;
  if (seededDefault) {
    scheduleRows = defaultPaymentScheduleRows();
  }

  const instances = computePlanInstances({
    scheduleRows,
    totalCostPhp,
    lockDateIso,
    eventDateIso,
  });

  // ── 🔒 THE COUPLE'S OWN PLAN SURVIVES THE LOCK (2026-09-21) ────────────
  // This snapshot was written when only a marketplace supplier could have a
  // plan, and its upsert below REPLACED whatever was there. Since 2026-09-20
  // a couple can author a plan for a supplier they added — and locking that
  // supplier found no service schedule, seeded a generic 50/50 ESTIMATE, and
  // overwrote the plan the couple had typed. `lockMayOverwritePlan`
  // (lib/self-added-payment-plan.ts, executed by its test) holds the rule.
  //
  // ⚠ AN UNREADABLE PLAN IS NOT AN ABSENT ONE. If this read fails, a
  // self-added supplier's plan is LEFT ALONE rather than overwritten blind —
  // the couple's typed plan is the only copy, and a generic estimate is
  // recoverable while their plan is not. A marketplace booking keeps the
  // existing refresh behaviour, since its truth is the supplier's schedule.
  const onPlatformBooking = Boolean(booking.marketplace_vendor_id);
  const { data: existingPlan, error: existingPlanErr } = await planAdmin
    .from('event_vendor_payment_plan')
    .select('instances_json, is_default_seeded')
    .eq('event_id', eventId)
    .eq('event_vendor_id', vendorId)
    .maybeSingle();
  if (existingPlanErr) {
    // Recorded, not just branched on: `ugat-both-ends.db.test.ts` refuses a
    // money read whose error selects a branch that leaves no trace. The plan
    // is still protected below — this line is so someone can see it happened.
    console.error(
      `[${tag}] could not read the existing payment plan for vendor_id=${vendorId} event_id=${eventId} — ${
        onPlatformBooking ? 'refreshing it from the supplier schedule' : 'leaving the couple’s plan untouched'
      }:`,
      existingPlanErr.message,
    );
  }
  const keepCouplePlan = existingPlanErr
    ? !onPlatformBooking
    : !lockMayOverwritePlan({
        onPlatform: onPlatformBooking,
        existingInstances: Array.isArray(
          (existingPlan as { instances_json?: unknown } | null)?.instances_json,
        )
          ? (existingPlan as { instances_json: unknown[] }).instances_json
          : null,
        existingIsDefaultSeeded:
          (existingPlan as { is_default_seeded?: boolean } | null)?.is_default_seeded === true,
      });

  // Upsert one plan row per (event, event_vendor) — re-locking refreshes it.
  // Skipped entirely when the couple's own plan must survive (see above); the
  // "your payment info is ready" notice below still fires, because it is.
  //
  // 📅 THE LOCK DAY (owner 2026-09-21: "on the date you clicked on lock").
  // For a supplier the couple added themselves, TODAY is the day their
  // "N days after lock" instalments count from. It is stamped on the plan
  // (`on_lock_anchor_date`) so later edits read it back instead of sliding,
  // and the couple's kept plan is re-dated to it — until now those rows were
  // anchored on the day the supplier was added. Only "after lock" dates move
  // (`redateOnLockInstalments`, executed by its test).
  const stampLockDay = !onPlatformBooking;
  const { error: planErr } = keepCouplePlan
    ? await planAdmin
        .from('event_vendor_payment_plan')
        .update(
          existingPlanErr
            ? // Unreadable plan: record the day, touch nothing else.
              { on_lock_anchor_date: lockDateIso }
            : {
                on_lock_anchor_date: lockDateIso,
                instances_json: redateOnLockInstalments(
                  (existingPlan as { instances_json?: unknown } | null)?.instances_json,
                  lockDateIso,
                ),
                updated_at: new Date().toISOString(),
              },
        )
        .eq('event_id', eventId)
        .eq('event_vendor_id', vendorId)
    : await planAdmin.from('event_vendor_payment_plan').upsert(
        {
          event_id: eventId,
          event_vendor_id: vendorId,
          instances_json: instances,
          // Flag an estimated 50/50 fallback so the couple's workspace can label
          // it "estimated — confirm with your vendor". Always written, so a
          // re-lock after the vendor sets a real schedule flips this back false.
          is_default_seeded: seededDefault,
          // #15 (money bug-hunt): a re-lock re-snapshots the instances, so the
          // plan must start UNCLEARED — otherwise a previously-cleared plan keeps
          // cleared_at and a freshly-recomputed (possibly larger) balance shows
          // as fully settled. planAdmin is service_role, so this bypasses the
          // cleared_at write-guard. The couple re-confirms via the gated path.
          cleared_at: null,
          cleared_by: null,
          ...(stampLockDay ? { on_lock_anchor_date: lockDateIso } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,event_vendor_id' },
      );
  if (planErr) {
    console.error(
      `[${tag}] payment-plan snapshot upsert failed for vendor_id=${vendorId} event_id=${eventId}:`,
      planErr.message,
    );
    return { status: 'failed', reason: planErr.message };
  }

  // Tell the host their payment info is ready. Deep-link to the per-vendor
  // workspace Payments section. On the direct path that is the person who
  // pressed Book; at the supplier's yes it is the person who pressed the ask.
  const vendorName = booking.vendor_name ?? 'your supplier';
  let told = false;
  if (args.tellUserId) {
    await deps.emit({
      userId: args.tellUserId,
      type: 'payment_info_sent',
      title: 'Your payment info is ready',
      body: seededDefault
        ? `Your booking with ${vendorName} is confirmed. We've prepared an estimated payment plan — open the workspace to review it and confirm the terms with your supplier.`
        : instances.length > 0
          ? `Your booking is confirmed. We've prepared the payment plan for ${vendorName} — open the workspace to see each payment and how to pay.`
          : `Your booking with ${vendorName} is confirmed. Open the workspace to see how to pay them directly.`,
      relatedUrl: `/dashboard/${eventId}/vendors/${vendorId}/workspace#payments`,
    });
    told = true;
  } else {
    console.error(
      `[${tag}] the payment plan for vendor_id=${vendorId} event_id=${eventId} was written, but nobody is recorded as having asked — no "payment info is ready" notice was sent`,
    );
  }
  return {
    status: keepCouplePlan ? 'kept_couple_plan' : 'written',
    instances: instances.length,
    seededDefault,
    told,
  };
}

export type AfterYesResult =
  | FreezePlanResult
  | { status: 'skipped'; reason: 'booking_unreadable' | 'not_on_setnayan' | 'package_booking' };

/**
 * The supplier said yes: freeze the plan for the booking that yes just made.
 *
 * Called by `vendorAgreeToLock` ONLY when `vendor_agree_to_lock` answered `ok` —
 * the one call that flips the row to booked. A second press answers `already`
 * and the expiry sweep never books anything, so neither reaches this; and if it
 * were ever called twice the table's UNIQUE (event_id, event_vendor_id) still
 * holds it to one row.
 */
export async function freezePaymentPlanAfterSupplierAgreed(
  admin: SupabaseClient,
  args: { eventId: string; eventVendorId: string },
  deps: { emit: Emit } = { emit: emitNotification },
): Promise<AfterYesResult> {
  const { data, error } = await admin
    .from('event_vendors')
    .select(
      'vendor_name, marketplace_vendor_id, service_id, event_vendor_package_id, lock_requested_by_user_id',
    )
    .eq('event_id', args.eventId)
    .eq('vendor_id', args.eventVendorId)
    .maybeSingle();
  if (error || !data) {
    console.error(
      `[vendorAgreeToLock] could not read the booking to freeze its payment plan, vendor_id=${args.eventVendorId}:`,
      error?.message ?? 'not found',
    );
    return { status: 'skipped', reason: 'booking_unreadable' };
  }
  const row = data as BookingForPlan & {
    event_vendor_package_id: string | null;
    lock_requested_by_user_id: string | null;
  };
  // The handshake exists only for a supplier on Setnayan; anything else here is
  // a row this function was never meant for.
  if (!row.marketplace_vendor_id) return { status: 'skipped', reason: 'not_on_setnayan' };
  // A package's own direct path writes no plan; see the file header.
  if (row.event_vendor_package_id) return { status: 'skipped', reason: 'package_booking' };
  return freezePaymentPlanAtBooking(
    admin,
    {
      eventId: args.eventId,
      vendorId: args.eventVendorId,
      booking: {
        vendor_name: row.vendor_name,
        marketplace_vendor_id: row.marketplace_vendor_id,
        service_id: row.service_id,
      },
      tellUserId: row.lock_requested_by_user_id,
      tag: 'vendorAgreeToLock',
    },
    deps,
  );
}
