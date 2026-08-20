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
  /** TRUE when money has moved and this event may not be self-deleted. */
  blocked: boolean;
  /** Why it is blocked, in the couple's words. Null when it is not. */
  blockedReason: string | null;
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
    .select('order_id')
    .eq('event_id', trimmed);

  let paymentRows: number | null = null;
  let receiptRows: number | null = null;
  if (orderErr) {
    // Unreadable order list ⇒ both money signals stay null ⇒ blocked.
  } else {
    const orderIds = (orderRows ?? []).map((r) => r.order_id as string);
    if (orderIds.length === 0) {
      // No orders at all — nothing could have been paid against this event.
      paymentRows = 0;
      receiptRows = 0;
    } else {
      [paymentRows, receiptRows] = await Promise.all([
        readCount(
          admin.from('payments').select('*', HEAD).in('order_id', orderIds),
        ),
        readCount(
          admin.from('receipts').select('*', HEAD).in('order_id', orderIds),
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
          'vendor_id, status, completion_status, deposit_paid_php, deposit_recorded_at',
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
        });
        if (!paid) return false;
        return !supplierIsReleased({
          eventHasPassed,
          completionStatus: (v.completion_status as string | null) ?? null,
          vendorStatus: (v.status as string | null) ?? null,
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
  const blockedReason = blocked
    ? unreadable
      ? 'We couldn’t check what’s been paid for on this celebration, so we haven’t removed it. Please try again in a moment, or message us and we’ll sort it out.'
      : (unsettledPaidSuppliers ?? 0) > 0
        ? `You’ve paid ${unsettledPaidSuppliers === 1 ? 'a supplier' : `${unsettledPaidSuppliers} suppliers`} for this celebration, so it can’t be removed yet — they’d lose the booking they were paid for. Put it away instead, or message us and we’ll help sort it out with them.`
        : 'Something on this celebration has already been paid for, so it can’t be removed here. Put it away instead, or message us and we’ll help.'
    : null;

  return {
    ok: true,
    impact: {
      eventName: eventRow.display_name ?? 'this celebration',
      guests,
      photos,
      bookedVendors,
      blocked,
      blockedReason,
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
