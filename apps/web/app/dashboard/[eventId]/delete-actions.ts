'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  collectEventMediaRefs,
  sweepEventMedia,
} from '@/lib/event-media-sweep';
import {
  BOOKED_VENDOR_STATUSES,
  SETTLED_ORDER_STATUSES,
  confirmationMatches,
  deletionIsBlocked,
  supplierIsReleased,
  supplierWasPaid,
} from '@/lib/event-deletion-gate';
import { manilaTodayISO } from '@/lib/event-board';
import {
  blockCanBeAsked,
  blockKind,
  isDeletionReasonCode,
  reasonIsComplete,
  type BlockKind,
} from '@/lib/event-deletion-reasons';
import { emitNotification } from '@/lib/notification-emit';

/**
 * delete-actions.ts — removing a celebration for good.
 *
 * ─── WHY THIS EXISTS, AND WHY IT IS NOT A NEW MECHANISM ────────────────────
 * The database has ALWAYS permitted this. `couple_can_delete_event` (DELETE,
 * `authenticated`, `event_id IN current_couple_event_ids() OR is_admin()`) is
 * live in production, and migration `20271138150255` already moved the
 * address-hold into a BEFORE DELETE trigger precisely so that "no path present
 * or future can miss it, including one nobody has written yet".
 *
 * This is that path. Nothing here re-implements the hold, the cascade, or the
 * permission model — all three already ship. What was missing was a door.
 *
 * ─── THE GENTLE OPTION IS THE SIBLING, NOT THE ALTERNATIVE ─────────────────
 * `archive-actions.ts` calls put-away "the gentle option that delete is
 * measured against". That is a real design constraint, not a turn of phrase:
 * wherever this action is offered, PUT AWAY MUST BE OFFERED BESIDE IT AND
 * FIRST. Somebody tidying nine test events and somebody ending a wedding press
 * the same button, and only one of them can be given their answer back.
 *
 * ─── WHO ───────────────────────────────────────────────────────────────────
 * COUPLE MEMBERS ONLY — deliberately NARROWER than put-away, which admits
 * coordinators and accepted moderators. A co-host may tidy the list; a co-host
 * may not destroy somebody else's wedding. This also matches the RLS floor
 * exactly (`current_couple_event_ids()` is `member_type = 'couple'` ONLY, read
 * out of production by the object), so the app rule and the database rule say
 * the same thing rather than one silently over-promising.
 *
 * ⚠ RLS IS A FLOOR, NOT A SCOPE. `couple_can_delete_event` carries an
 * `OR is_admin()` disjunct so the admin console can share the policy, and
 * production already has a vendor who is also an admin. Leaning on RLS alone
 * would let an admin's ORDINARY session delete a stranger's wedding through a
 * couple-facing action. The explicit membership check below is the real gate.
 */


export type DeletionImpact = {
  eventName: string;
  /**
   * THREE STATES, and the third is the whole point:
   *   number → we counted it
   *   null   → we ASKED and the read FAILED
   *
   * A failed count must never reach the screen as `0`. This whole dialog is a
   * list of what a person is about to lose; a zero printed over a refused read
   * is the most expensive lie this product could tell, because it is read
   * immediately before an irreversible press. Same rule the home board learned
   * ("an empty state that lies is worse than a missing tile") and the Alaala
   * wall learned ("no photos yet" printed over a failed read).
   */
  guests: number | null;
  photos: number | null;
  bookedVendors: number | null;
  /**
   * Suppliers who have been paid and have not released the deletion — the ones
   * the couple can ASK. Distinct from `blocked`: an event can be blocked by
   * money paid to Setnayan, or by an unreadable check, with no supplier to ask.
   * The ask button keys on THIS, so it is never a door to nothing.
   */
  unsettledPaidSuppliers: number | null;
  /** TRUE when money has moved and this event may not be self-deleted. */
  blocked: boolean;
  /** Why it is blocked, in the couple's words. Null when it is not. */
  blockedReason: string | null;
  /**
   * WHICH of four things is holding it.
   *
   * 🔴 Until 2026-08-28 all four wore one sentence and the owner's verdict on
   * it was ***"still failed to identify"***. This is what lets the panel say
   * something different for each, and what lets it offer a door for exactly the
   * two that have one.
   */
  blockKind: BlockKind | null;
  /** TRUE when "Ask us to remove it" should be on screen. */
  canAsk: boolean;
  /**
   * What was actually bought, so a refusal about money can NAME the money.
   * Empty when nothing was, or when the read failed — never a guess.
   */
  paidItems: { description: string; amountPhp: number | null }[];
  /** The couple's own open request, when they have already asked. */
  pendingRequest: {
    id: string;
    reasonCode: string;
    reason: string | null;
    createdAt: string;
  } | null;
};

export type ImpactResult =
  | { ok: true; impact: DeletionImpact }
  | { ok: false; code: 'unauthorized' | 'not_found'; message: string };

export type DeleteResult =
  | { ok: true }
  | {
      ok: false;
      code: 'unauthorized' | 'not_found' | 'mismatch' | 'blocked' | 'failed';
      message: string;
    };

/**
 * Confirm the caller is a COUPLE member of this event and hand back the row.
 * Returns null for "not a couple member of an event that exists" — the caller
 * turns that into one message, because telling a stranger which of the two it
 * was is itself a disclosure.
 */
async function requireCoupleMember(
  eventId: string,
): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  /*
    🪤 SUPABASE DOES NOT THROW. An RLS refusal and "no such row" are the same
    shape here — `{ data: null, error: null }` — and a genuine transport error
    resolves with `{ error }` rather than raising. Treating an ERROR as "not a
    member" is the correct direction for a delete gate: unreadable means no.
  */
  if (error || !data) return null;
  return { userId: user.id };
}

/**
 * What disappears if this event is deleted — counted, never guessed.
 *
 * Fetched ON DEMAND when the dialog opens rather than on every board render:
 * three extra counts per card would be paid by every visit to My Events to
 * serve a dialog almost nobody opens.
 */
export async function getEventDeletionImpact(
  eventId: string,
): Promise<ImpactResult> {
  const trimmed = eventId.trim();
  if (!trimmed) {
    return { ok: false, code: 'not_found', message: 'Which celebration?' };
  }

  const member = await requireCoupleMember(trimmed);
  if (!member) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only the people organising this celebration can remove it.',
    };
  }

  const admin = createAdminClient();

  const { data: eventRow, error: eventErr } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', trimmed)
    .maybeSingle();
  if (eventErr || !eventRow) {
    return {
      ok: false,
      code: 'not_found',
      message: 'We couldn’t find that celebration.',
    };
  }

  /*
    A count that FAILED comes back null, never 0 — see DeletionImpact. Written
    as four plain reads rather than one clever helper: each names its own table
    and filter, so what is being counted is readable at the call site.
  */
  const readCount = async (
    q: PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number | null> => {
    try {
      const { count, error } = await q;
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  };

  const HEAD = { count: 'exact' as const, head: true };
  const [guests, photos, bookedVendors, settledOrders] = await Promise.all([
    /*
      🪤 `.is('deleted_at', null)` IS LOAD-BEARING — guests are SOFT-deleted.
      Removing a guest writes `deleted_at`; the row stays. Every guest-facing
      read in the app filters it out, and so does the RLS SELECT policy itself
      (`event_member_can_read_guest … AND deleted_at IS NULL`). This read uses
      the ADMIN client, so RLS applies no filter — the service role is exactly
      what makes those rows visible again.

      Measured in prod: "Cale & Ice" holds 6 guest rows of which the couple has
      only ever seen 2. Without this clause the confirmation said "6 guests go
      with it" — and because ImpactLines hides zeros, that wrong number was the
      ONLY figure on the screen, read immediately before an irreversible press.
    */
    readCount(
      admin
        .from('guests')
        .select('*', HEAD)
        .eq('event_id', trimmed)
        .is('deleted_at', null),
    ),
    readCount(
      admin.from('papic_photos').select('*', HEAD).eq('event_id', trimmed),
    ),
    readCount(
      admin
        .from('event_vendors')
        .select('*', HEAD)
        .eq('event_id', trimmed)
        .in('status', BOOKED_VENDOR_STATUSES),
    ),
    readCount(
      admin
        .from('orders')
        .select('*', HEAD)
        .eq('event_id', trimmed)
        .in('status', SETTLED_ORDER_STATUSES),
    ),
  ]);

  /*
    🚨 AND NOW THE PART THE STATUS CANNOT TELL US.

    `cancelOrder` writes `status='cancelled'` with no check on the status it is
    leaving, and the RLS guard behind it only constrains the NEW value — so a
    couple holding a PAID order can cancel it and walk the event past a gate
    that reads only the current status. The first cut of this file had exactly
    that hole.

    Payment and receipt rows are the evidence a couple cannot rewrite: a
    `payments` row means a transfer was logged or a screenshot uploaded, and a
    `receipts` row is a BIR official receipt carrying a sequential serial. Both
    outlive the cancellation.

    Read in two steps because PostgREST cannot express "a payment whose order
    belongs to this event" in one filter — get the event's order ids, then ask
    about those. An order-id read that FAILS yields null and fails closed, the
    same as every other money signal here.
  */
  const { data: orderRows, error: orderErr } = await admin
    .from('orders')
    .select('order_id, status, description, requested_total_php, confirmed_total_php')
    .eq('event_id', trimmed);

  let paymentRows: number | null = null;
  let receiptRows: number | null = null;
  /*
    🔑 SPLIT BY STATUS, BECAUSE "WE HAVE YOUR MONEY" AND "NOBODY HAS OPENED
    YOUR SCREENSHOT" ARE DIFFERENT FACTS AND ONLY ONE OF THEM IS TRUE HERE.

    `payment_status` is pending / matched / rejected — there is no 'paid'
    (a query filtering for one comes back rejected, not thrown, which is how a
    duplicate-reference guard once ran inert for a month). `matched` is an admin
    having confirmed the transfer; `pending` is a screenshot nobody has looked
    at. A `rejected` payment is deliberately NEITHER: it is money we have looked
    at and said did not arrive, so it must not hold somebody's celebration
    hostage.

    Both still count toward `paymentRows`, which is what BLOCKS — a payment we
    have not checked is exactly the case where refusing is right. What changes
    is what the person is TOLD.
  */
  let matchedPayments: number | null = null;
  let pendingPayments: number | null = null;
  const paidItems: { description: string; amountPhp: number | null }[] = [];

  if (orderErr) {
    // Unreadable order list ⇒ every money signal stays null ⇒ blocked.
  } else {
    const orders = (orderRows ?? []) as {
      order_id: string;
      status: string | null;
      description: string | null;
      requested_total_php: number | string | null;
      confirmed_total_php: number | string | null;
    }[];
    const orderIds = orders.map((r) => r.order_id);

    /*
      What was bought, for the sentence that names it. The CONFIRMED total wins
      where there is one — that is the figure a receipt would carry — and the
      requested total is what a bill still waiting on us says. A missing or
      unparseable amount stays null and the panel prints the line without a
      number rather than inventing a zero.
    */
    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'draft') continue;
      const raw = o.confirmed_total_php ?? o.requested_total_php;
      const n = raw === null || raw === undefined ? NaN : Number(raw);
      paidItems.push({
        description: o.description?.trim() || 'A Setnayan service',
        amountPhp: Number.isFinite(n) ? n : null,
      });
    }

    if (orderIds.length === 0) {
      // No orders at all — nothing could have been paid against this event.
      paymentRows = 0;
      receiptRows = 0;
      matchedPayments = 0;
      pendingPayments = 0;
    } else {
      [paymentRows, receiptRows, matchedPayments, pendingPayments] =
        await Promise.all([
          readCount(
            admin.from('payments').select('*', HEAD).in('order_id', orderIds),
          ),
          readCount(
            admin.from('receipts').select('*', HEAD).in('order_id', orderIds),
          ),
          readCount(
            admin
              .from('payments')
              .select('*', HEAD)
              .in('order_id', orderIds)
              .eq('status', 'matched'),
          ),
          readCount(
            admin
              .from('payments')
              .select('*', HEAD)
              .in('order_id', orderIds)
              .eq('status', 'pending'),
          ),
        ]);
    }
  }

  /*
    🔒 THE MONEY GATE FAILS CLOSED, AND THAT ASYMMETRY IS THE POINT.
    `settledOrders === null` means we could not check whether this couple has
    paid for anything. Every other count on this screen degrades to "we couldn't
    check" and lets the person decide; this one refuses. A paid service is the
    one thing on the list that is not theirs alone to destroy — it is a receipt,
    a BIR record and a support case — so an unmeasured answer takes the safe
    side. Same rule the admin work list learned: an UNMEASURED queue is not a
    clear one.
  */
  /*
    ── SUPPLIERS THE COUPLE HAS PAID DIRECTLY ────────────────────────────────
    Owner 2026-08-21: a paid supplier must ACCEPT the deletion, unless the event
    is over and they finished the job.

    🔑 NONE OF THE THREE SIGNALS ABOVE CAN SEE THIS MONEY. The couple pays the
    supplier off-platform; Setnayan never holds it. Prod today carries a wedding
    with twelve booked suppliers, three of them paid a deposit — and every
    Setnayan-side money signal reads zero for it.

    A supplier counts as unsettled while EITHER half of the release is unmet.
    `paid` is read two ways because the couple records it two ways: the booking
    sitting at `deposit_paid`, or a payment they logged against that supplier.

    ⚠ THE DAY IS PH-LOCAL. `manilaTodayISO` — never the server's clock, which is
    UTC on Vercel. An event that has "passed" by one measure and not the other
    decides whether a supplier is asked at all.
  */
  let unsettledPaidSuppliers: number | null = null;
  {
    const [vendorsRes, vendorPaymentsRes, eventDateRes] = await Promise.all([
      admin
        .from('event_vendors')
        .select(
          'vendor_id, status, completion_status, deposit_paid_php, deposit_recorded_at, deposit_declined_at, delete_request_state',
        )
        .eq('event_id', trimmed),
      admin
        .from('event_vendor_payments')
        .select('vendor_id')
        .eq('event_id', trimmed),
      admin
        .from('events')
        .select('event_date, event_end_date')
        .eq('event_id', trimmed)
        .maybeSingle(),
    ]);

    if (!vendorsRes.error && !vendorPaymentsRes.error && !eventDateRes.error) {
      const paidVendorIds = new Set(
        (vendorPaymentsRes.data ?? []).map((r) => r.vendor_id as string),
      );
      // The LAST day releases it — a celebration spanning several days is not
      // over on its first morning.
      const lastDay =
        (eventDateRes.data?.event_end_date as string | null) ??
        (eventDateRes.data?.event_date as string | null);
      const eventHasPassed =
        typeof lastDay === 'string' && lastDay.slice(0, 10) < manilaTodayISO();

      unsettledPaidSuppliers = (vendorsRes.data ?? []).filter((v) => {
        const paid = supplierWasPaid({
          vendorStatus: (v.status as string | null) ?? null,
          depositPaidPhp: (v.deposit_paid_php as number | null) ?? null,
          depositRecordedAt: (v.deposit_recorded_at as string | null) ?? null,
          hasLoggedPayment: paidVendorIds.has(v.vendor_id as string),
          // A supplier who has DECLARED they were never paid does not hold the
          // couple's delete on the strength of that claim. Before 2026-08-27 the
          // refusal deleted the claim and the ledger row outright, so this read
          // reached the same answer by finding nothing; the record is kept now,
          // so the answer has to be asked for.
          depositDeclinedAt: (v.deposit_declined_at as string | null) ?? null,
        });
        if (!paid) return false;
        return !supplierIsReleased({
          eventHasPassed,
          completionStatus: (v.completion_status as string | null) ?? null,
          vendorStatus: (v.status as string | null) ?? null,
          deleteRequestState: (v.delete_request_state as string | null) ?? null,
        });
      }).length;
    }
    // Any read error leaves it null ⇒ blocked. We cannot ask suppliers we
    // could not count.
  }

  const evidence = {
    settledOrders,
    paymentRows,
    receiptRows,
    unsettledPaidSuppliers,
  };
  const blocked = deletionIsBlocked(evidence);
  const unreadable =
    settledOrders === null ||
    paymentRows === null ||
    receiptRows === null ||
    unsettledPaidSuppliers === null;
  /*
    The supplier reason is checked BEFORE the Setnayan-money reason because it is
    the one a couple can actually do something about, and it names WHO is holding
    it. "Something has been paid for" would be true and useless here.
  */
  const kind = blocked
    ? blockKind({
        unreadable,
        unsettledPaidSuppliers,
        settledOrders,
        receiptRows,
        matchedPayments,
        pendingPayments,
      })
    : null;

  /*
    ⚠ `blocked` AND `kind` ARE COMPUTED SEPARATELY AND MUST NOT DISAGREE.
    `deletionIsBlocked` is the gate and stays the authority; `blockKind` only
    describes it. If the gate says no and the describer finds nothing to name,
    the honest answer is the unreadable one — never silence, which would render
    a refusal with no sentence at all.
  */
  const describedKind: BlockKind | null = blocked ? (kind ?? 'unreadable') : null;

  const blockedReason =
    describedKind === 'unreadable'
      ? 'We couldn’t check what’s been paid for on this celebration, so we haven’t removed it. Please try again in a moment, or message us and we’ll sort it out.'
      : describedKind === 'suppliers'
        ? `You’ve paid ${unsettledPaidSuppliers === 1 ? 'a supplier' : `${unsettledPaidSuppliers} suppliers`} for this celebration, so it can’t be removed yet — they’d lose the booking they were paid for. Put it away instead, or message us and we’ll help sort it out with them.`
        : describedKind === 'awaiting_check'
          ? 'We’re still checking a payment on this celebration, so it can’t be removed yet. Tell us why you want it removed and a person will answer you.'
          : describedKind === 'settled'
            ? 'Removing this ends what you’ve paid for on it. It stops working and doesn’t move to another celebration, and we can’t put the money back automatically — so tell us why and a person will answer you.'
            : null;

  /*
    THE COUPLE'S OWN OPEN REQUEST. Read even when nothing is blocking: a request
    can outlive the thing that caused it (a payment gets rejected, a supplier
    agrees), and a person who asked and then sees no trace of it will ask again.
    A failed read leaves it null, which shows the ask button again — the safe
    direction, because the one-pending-per-celebration index refuses the
    duplicate rather than queueing it twice.
  */
  let pendingRequest: DeletionImpact['pendingRequest'] = null;
  {
    const { data: reqRow } = await admin
      .from('event_deletion_requests')
      .select('id, reason_code, reason, created_at')
      .eq('event_id', trimmed)
      .eq('status', 'pending')
      .maybeSingle();
    if (reqRow) {
      pendingRequest = {
        id: reqRow.id as string,
        reasonCode: reqRow.reason_code as string,
        reason: (reqRow.reason as string | null) ?? null,
        createdAt: reqRow.created_at as string,
      };
    }
  }

  return {
    ok: true,
    impact: {
      eventName: eventRow.display_name ?? 'this celebration',
      unsettledPaidSuppliers,
      guests,
      photos,
      bookedVendors,
      blocked,
      blockedReason,
      blockKind: describedKind,
      canAsk: blockCanBeAsked(describedKind) && pendingRequest === null,
      paidItems,
      pendingRequest,
    },
  };
}

/**
 * Delete one event, for good.
 *
 * The typed confirmation is not decoration. This destroys the guest list, every
 * photograph, the schedule and the page guests hold a link to, and there is no
 * undo anywhere in the product. A dialog you can dismiss with one tap is the
 * wrong shape for that; typing the name is a second, deliberate act.
 */
export async function deleteOwnEvent(formData: FormData): Promise<DeleteResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const typed = String(formData.get('confirm_name') ?? '').trim();
  if (!eventId) {
    return { ok: false, code: 'not_found', message: 'Which celebration?' };
  }

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only the people organising this celebration can remove it.',
    };
  }

  /*
    🔒 RE-CHECKED SERVER-SIDE, NOT TRUSTED FROM THE DIALOG. The impact read that
    populated the screen ran in a different request; a client that never opened
    it, or opened it an hour ago, must still meet the same gate. A guard that
    only runs where the UI chooses to call it is not a guard.
  */
  const impact = await getEventDeletionImpact(eventId);
  if (!impact.ok) return impact;
  if (impact.impact.blocked) {
    return {
      ok: false,
      code: 'blocked',
      message:
        impact.impact.blockedReason ??
        'This celebration can’t be removed here just now.',
    };
  }

  if (!confirmationMatches(typed, impact.impact.eventName)) {
    return {
      ok: false,
      code: 'mismatch',
      message: `Type ${impact.impact.eventName} exactly to remove it.`,
    };
  }

  /*
    🔒 THE ADDRESS IS HELD BY THE DATABASE, NOT HERE — and this action must NOT
    write that hold itself. `20271138150255` put it in a BEFORE DELETE trigger
    so every path holds the word; a second copy here would be a driftable
    duplicate of a rule that is already enforced where it cannot be missed.
    The admin action carries the same note for the same reason.

    The delete uses the admin client with the membership check above as the
    authorization — the house pattern named in `archive-actions.ts`.
  */
  /*
    🪤 COLLECT THE FILES BEFORE THE DELETE — afterwards there is no row left to
    tell us which objects were theirs. `lib/erasure/purge.ts` states the same
    rule for the same reason. The keys live on `papic_photos` and on the event
    itself, and both are gone the moment the DELETE lands.

    A collection FAILURE returns null, and null is not an empty list: it means
    we could not read what to remove. The delete still proceeds — the couple
    asked for it, and refusing at this point would leave them unable to remove
    anything because of a storage read — but nothing is reported as swept.
  */
  /*
    ── WHY THEY LEFT, WRITTEN BEFORE THE CELEBRATION IS ──────────────────────
    Owner 2026-08-28: *"they can pick a reason for deleting. or they state
    their reason."*

    🔑 THE ORDER IS THE WHOLE THING. This row must exist BEFORE the DELETE, and
    `event_deletion_requests.event_id` deliberately carries NO foreign key — a
    cascade would take the answer with the celebration it is about, so the one
    moment anybody tells us why they left is the one moment we could not keep.
    `event_name` is snapshotted for the same reason: afterwards there is nothing
    to resolve it from.

    Written with the SERVICE ROLE, and the membership check above is the
    authorization — the house pattern, and the same client the delete uses two
    calls below.

    ⚖ NON-FATAL BY CHOICE. If the reason cannot be written, the person still
    gets their celebration removed. Refusing a removal because a survey row
    failed would be the tail wagging the dog. Logged so the gap is visible.
  */
  const reasonCode = String(formData.get('reason_code') ?? '').trim();
  const reasonText = String(formData.get('reason') ?? '').trim();
  if (isDeletionReasonCode(reasonCode)) {
    const { error: reasonErr } = await createAdminClient()
      .from('event_deletion_requests')
      .insert({
        event_id: eventId,
        event_name: impact.impact.eventName,
        user_id: member.userId,
        reason_code: reasonCode,
        reason: reasonText.slice(0, 1000) || null,
        status: 'self_removed',
      });
    if (reasonErr) {
      console.error('[delete-event] could not record the reason', reasonErr);
    }
  }

  const mediaRefs = await collectEventMediaRefs(eventId);

  /*
    🚨 CANCEL THE UNPAID ORDERS FIRST, OR THEY OUTLIVE THE EVENT INVISIBLY.

    `orders.event_id` is ON DELETE SET NULL, so deleting an event does not take
    its orders with it — it DETACHES them. The order stays alive, still
    "submitted", still owing money, with its event link wiped. And a buyer's
    only route to an order is `/dashboard/<eventId>/orders/<orderId>`; there is
    no account-level orders page (`/dashboard/orders` is a 404 even signed in).
    So the customer keeps the debt and loses the one screen naming the amount,
    the reference and where to send it, while the order sits in the admin queue
    attached to nothing.

    Not hypothetical: this happened in production on 2026-08-20 to a real ₱499
    order, found by walking the product with a signed-in account.

    ⚖ WHY CANCEL RATHER THAN BLOCK THE DELETE. The money gate above deliberately
    admits an unpaid order — blocking would trap somebody who just wants a test
    celebration gone. And nothing is lost by cancelling: an unpaid order has
    unlocked nothing (only 'paid'/'fulfilled' ever activate a service), so this
    ends a commitment that could never have completed rather than destroying a
    live one. A PAID order still blocks the delete outright, untouched.

    Idempotent + race-safe through the status filter.
  */
  const { data: strandedOrders, error: strandErr } = await createAdminClient()
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('status', ['submitted', 'awaiting_payment'])
    .select('order_id, public_id, user_id');

  if (strandErr) {
    // Non-fatal by choice: refusing to delete because a tidy-up failed would
    // strand the PERSON instead of the order. Logged so the drift is visible.
    console.error('[delete-event] could not cancel unpaid orders', strandErr);
  } else {
    for (const row of (strandedOrders ?? []) as {
      public_id: string | null;
      user_id: string | null;
    }[]) {
      if (!row.user_id) continue;
      await emitNotification({
        userId: row.user_id,
        type: 'order_cancelled',
        title: `Order ${row.public_id ?? ''} was cancelled with the celebration`.trim(),
        body:
          'You removed the celebration this order belonged to, so the order has been ' +
          'cancelled. Nothing has been charged. If you have already sent payment, tell ' +
          'us and we will sort it out.',
        relatedUrl: null,
      });
    }
  }

  const { data, error } = await createAdminClient()
    .from('events')
    .delete()
    .eq('event_id', eventId)
    .select('event_id');

  if (error) {
    console.error('[delete-event] delete failed', error);
    return {
      ok: false,
      code: 'failed',
      message: 'We couldn’t remove that just now. Please try again.',
    };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      code: 'not_found',
      message: 'We couldn’t find that celebration.',
    };
  }

  /*
    THE FILES GO LAST, and only once the row is really gone.
    Owner 2026-08-20, asked directly: when a couple deletes their own
    celebration, the photographs go with it.

    🔑 THIS EXTENDS THE PHOTO LOCK RATHER THAN REVERSING IT. "not delete, just
    compress" and "we keep it for life" govern RETENTION — what time may do to
    photographs nobody asked us to remove. This is the one case they never
    covered: the couple themselves asking. The retention sweep is untouched.

    Best-effort by contract. The celebration IS deleted by this point; a failed
    file delete leaves an orphaned object, never lost data, and must not turn a
    successful removal into an error message.
  */
  if (mediaRefs && mediaRefs.length > 0) {
    const swept = await sweepEventMedia(mediaRefs);
    if (swept.failed > 0) {
      console.error(
        `[delete-event] ${swept.failed} of ${mediaRefs.length} files could not be removed`,
      );
    }
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

export type AskResult =
  | { ok: true; asked: number }
  | { ok: false; message: string };

/**
 * Ask the paid suppliers to agree to this celebration being removed.
 *
 * Owner 2026-08-21: *"they can only delete it if the vendors with paid purchase
 * accepts that this deletion."* Until this shipped, a paid supplier BLOCKED the
 * delete outright and the couple had no way through — a refusal with no door.
 *
 * The RPC decides who is asked: paid, and not already released. The couple does
 * not choose, and cannot ask a supplier who is not holding anything.
 */
export async function askSuppliersToAgree(
  formData: FormData,
): Promise<AskResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) return { ok: false, message: 'Which celebration?' };

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      message: 'Only the people organising this celebration can ask.',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_event_deletion', {
    p_event_id: eventId,
  });
  if (error) {
    console.error('[delete-event] ask failed', error);
    return {
      ok: false,
      message: 'We couldn’t send that just now. Please try again.',
    };
  }

  const asked = Number((data as { asked?: number })?.asked ?? 0);

  /*
    🔑 TELL THE SUPPLIERS. The RPC marks rows; it does not speak to anybody, and
    a supplier who is never told cannot answer — which would leave the couple
    blocked forever by a question nobody knows was asked.

    Best-effort by contract: the asks are already recorded, and a notification
    hiccup must not roll them back or fail the couple's press.
  */
  if (asked > 0) {
    try {
      const admin = createAdminClient();
      const { data: rows } = await admin
        .from('event_vendors')
        .select('marketplace_vendor_id')
        .eq('event_id', eventId)
        .eq('delete_request_state', 'pending')
        .not('marketplace_vendor_id', 'is', null);
      const shopIds = [
        ...new Set((rows ?? []).map((r) => r.marketplace_vendor_id as string)),
      ];
      if (shopIds.length > 0) {
        const { data: seats } = await admin
          .from('vendor_team_members')
          .select('user_id, vendor_profile_id')
          .in('vendor_profile_id', shopIds);
        for (const seat of seats ?? []) {
          await emitNotification({
            userId: seat.user_id as string,
            type: 'deletion_request_received',
            title: 'A celebration you were paid for is being removed',
            body: 'The couple has asked whether you agree. Nothing is removed until you answer.',
            relatedUrl: '/vendor-dashboard',
          });
        }
      }
    } catch (err) {
      console.error('[delete-event] could not tell the suppliers', err);
    }
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/${eventId}`);
  return { ok: true, asked };
}

/**
 * Withdraw the ask.
 *
 * 🔑 SHIPS BESIDE THE ASK, AND IS NOW ACTUALLY CALLED.
 *
 * ⚠ THIS DOCBLOCK WAS FALSE FOR A DAY. It claimed "AND IS CALLED" while citing
 * `cancel_vendor_lock_request` — granted, commented, db-tested, ZERO CALLERS for
 * its whole life — as the cautionary tale, and then had zero callers itself.
 * Written in the same breath as the warning, which is exactly how the original
 * one happened. The Withdraw button in the event-card menu is the caller.
 *
 * Only PENDING asks are withdrawn. An answer already given is the supplier's
 * record of what they were asked and what they said.
 */
export async function withdrawSupplierAsk(
  formData: FormData,
): Promise<AskResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) return { ok: false, message: 'Which celebration?' };

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      message: 'Only the people organising this celebration can withdraw it.',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_event_deletion_request', {
    p_event_id: eventId,
  });
  if (error) {
    console.error('[delete-event] withdraw failed', error);
    return {
      ok: false,
      message: 'We couldn’t withdraw that just now. Please try again.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/${eventId}`);
  return { ok: true, asked: Number((data as { cancelled?: number })?.cancelled ?? 0) };
}

export type RequestResult =
  | { ok: true; alreadyOpen: boolean }
  | { ok: false; message: string };

/**
 * Ask US to remove a celebration that money is holding.
 *
 * ─── THE REFUSAL THIS REPLACES ─────────────────────────────────────────────
 * A celebration held by money paid to Setnayan had ONE sentence and a Cancel
 * button. "Message us and we'll help" was written down and was not a control —
 * a dead end dressed as an offer. Owner 2026-08-28, looking at it:
 * ***"still failed to identify"***.
 *
 * ─── WHY IT IS A REQUEST AND NOT A "REMOVE IT ANYWAY" ──────────────────────
 * ⚖ The alternative on the table was to let the couple press on and lose what
 * they paid for. That is a promise about money printed next to services that
 * carry a BIR official receipt, and it can be made at 1 a.m. with nobody in the
 * loop. A person answering each one costs nothing today — production has held
 * exactly one bill, ever — and keeps the money decision with a human until
 * there is enough of it to write a rule from. The screen therefore says "we
 * can't put the money back automatically", which stays true whichever way that
 * rule eventually goes.
 *
 * 🔑 THE GATE IS RE-CHECKED HERE, NOT TRUSTED FROM THE PANEL. A caller can post
 * this for a celebration nothing is holding; that is not harmful, but it puts a
 * row in a queue for a person to read about a removal they could have done
 * themselves. Refused, with the reason said out loud.
 */
export async function requestEventDeletion(
  formData: FormData,
): Promise<RequestResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const reasonCode = String(formData.get('reason_code') ?? '').trim();
  const reasonText = String(formData.get('reason') ?? '').trim();

  if (!eventId) return { ok: false, message: 'Which celebration?' };

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      message: 'Only the people organising this celebration can ask.',
    };
  }

  if (!reasonIsComplete(reasonCode, reasonText)) {
    return {
      ok: false,
      message:
        reasonCode === 'other'
          ? 'Tell us in a few words and we’ll sort it out.'
          : 'Pick a reason so we know what to do about it.',
    };
  }

  const impact = await getEventDeletionImpact(eventId);
  if (!impact.ok) return { ok: false, message: impact.message };
  if (!blockCanBeAsked(impact.impact.blockKind)) {
    return {
      ok: false,
      message:
        'There’s nothing for us to sort out on this one — you can remove it yourself.',
    };
  }

  /*
    🔑 WRITTEN THROUGH THE COUPLE'S OWN SESSION, NOT THE SERVICE ROLE. The
    insert policy checks BOTH that the row is theirs and that the celebration is
    one they organise, so a row in this queue is provably self-filed. Using the
    admin client here would be one import away from a signed-in stranger putting
    somebody else's wedding — and its name — into an admin queue.
  */
  const supabase = await createClient();
  const { error } = await supabase.from('event_deletion_requests').insert({
    event_id: eventId,
    event_name: impact.impact.eventName,
    user_id: member.userId,
    reason_code: reasonCode,
    reason: reasonText.slice(0, 1000) || null,
  });

  if (error) {
    /*
      The one-pending-per-celebration index refused a duplicate. That is the
      button being pressed twice, not a failure — report it as the request they
      already have rather than as an error they cannot act on.
    */
    if (
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate') ||
      error.message.includes('one_pending_per_event')
    ) {
      revalidatePath('/dashboard');
      return { ok: true, alreadyOpen: true };
    }
    console.error('[delete-event] request failed', error);
    return {
      ok: false,
      message: 'We couldn’t send that just now. Please try again.',
    };
  }

  /*
    🔔 TELL SOMEBODY. A request nobody knows about is the supplier-ask defect in
    a different costume: the row is marked, nothing speaks, and the couple waits
    on a question that never reached anyone. Admin notices live in the console's
    own queue — this repo does not push or email admins — so the queue count is
    the notification, and `/admin/event-deletions` is where it lands.
  */
  revalidatePath('/dashboard');
  revalidatePath('/admin/event-deletions');
  return { ok: true, alreadyOpen: false };
}

/**
 * Take the question back.
 *
 * 🔑 SHIPS WITH THE ASK, AND IS ACTUALLY CALLED — the panel renders it under
 * "we have your request". This repo has twice shipped a granted, tested,
 * commented inverse with ZERO callers (`cancel_vendor_lock_request`, and then
 * `withdrawSupplierAsk` in this very file), so the button comes with the door.
 *
 * Runs through the couple's own session: the cancel policy admits only their
 * own still-pending row, and only into 'cancelled'.
 */
export async function cancelEventDeletionRequest(
  formData: FormData,
): Promise<RequestResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) return { ok: false, message: 'Which celebration?' };

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      message: 'Only the people organising this celebration can withdraw it.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('event_deletion_requests')
    .update({ status: 'cancelled' })
    .eq('event_id', eventId)
    .eq('user_id', member.userId)
    .eq('status', 'pending');

  if (error) {
    console.error('[delete-event] withdraw request failed', error);
    return {
      ok: false,
      message: 'We couldn’t withdraw that just now. Please try again.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin/event-deletions');
  return { ok: true, alreadyOpen: false };
}
