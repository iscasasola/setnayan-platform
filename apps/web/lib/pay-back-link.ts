/**
 * lib/pay-back-link.ts — the way out of /pay/<reference>, derived from WHO is
 * paying and WHAT the order is for.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 WHY THIS IS ITS OWN MODULE. Owner, 2026-09-20, paying a real ₱837.50
 * booking fee as the SUPPLIER Saysay: the back control read *"Back to your
 * celebration"* and pointed at `/dashboard/cc47d373-…` — Ana & Miguel's event
 * dashboard. *"what is this? it is not working properly."*
 *
 * 🔑 THE CAUSE, MEASURED: the old rule asked the order for an `event_id` FIRST
 * and treated its presence as "the payer owns this celebration". It does not
 * mean that. On a booking fee `event_id` means *the fee is FOR this event* —
 * the order also carries `vendor_profile_id`, and its `user_id` is the
 * SUPPLIER. Verified on the live row: `user_id` 9f1d8c74… (Saysay),
 * `event_id` cc47d373… (the couple's), `vendor_profile_id` d266c234….
 *
 * ⚠ AND THE LINK WAS A DEAD END, NOT A LEAK — worth saying plainly because the
 * two look identical from the payment page. `/dashboard/[eventId]/layout.tsx`
 * requires an `event_members` row of `member_type = 'couple'`, or an accepted
 * `event_moderators` row, and `notFound()`s otherwise. The supplier holds
 * neither on that event (measured: 1 member row, and it is the couple's; 0
 * moderator rows). So they were sent to a 404 with somebody else's celebration
 * in the URL. Nothing of the couple's was shown.
 *
 * ⚖ THE RULE: a shop's own bill NEVER offers the couple's dashboard. A
 * `vendor_profile_id` on an order is the fact that says "a shop is the payer
 * here", and it is the fact the old rule ignored.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ THIS MODULE IS PURE ON PURPOSE — no `server-only`, no database. Its one
 * import is the fee lane's own `service_key` parser, which is pure for the
 * same reason. A rule a guard can only GREP is a rule that can ship inert;
 * everything here is executed by `the-way-out-follows-the-payer.test.ts` and
 * `app/admin/payments/the-notice-follows-the-payer.test.ts`.
 */
import { chargeIdFromBookingFeeLockServiceKey } from './booking-fee-lock';

export type PayBackInput = {
  orderId: string;
  /** True when this is the Setnayan booking fee lane (owner 2026-08-06). */
  isBookingFee: boolean;
  /** The celebration this order is FOR — not a claim about who owns it. */
  eventId: string | null;
  /** Set when a shop is the party being billed. */
  vendorProfileId: string | null;
  /** Who minted the order. */
  ownerUserId: string | null;
  /** Who is looking at the page right now. */
  viewerUserId: string | null;
};

export type PayBackLink = { label: string; href: string };

/**
 * Where "back" goes, and what it is called.
 *
 * Order of questions, and each one is about a different party:
 *
 *  1. **Is the viewer the shop being billed?** Then the way out is the shop's
 *     own lane — the fee's page for a booking fee, the shop dashboard
 *     otherwise. This is the arm the owner hit, and it must come FIRST because
 *     these orders also carry an `event_id`.
 *  2. **Is there a celebration?** Then the viewer reached this order through
 *     it (RLS admits an order to its event's members), so their dashboard is
 *     both correct and reachable.
 *  3. **A shop's eventless bill** → the shop dashboard.
 *  4. Otherwise the signed-in home, which exists for everybody.
 */
export function payBackLink(input: PayBackInput): PayBackLink {
  switch (orderLane(input).kind) {
    case 'vendor-booking-fee':
      return {
        label: 'Back to this booking fee',
        href: `/vendor-dashboard/booking-fees/${input.orderId}`,
      };
    case 'vendor':
      return { label: 'Back to your shop', href: '/vendor-dashboard' };
    case 'event':
      return { label: 'Back to your celebration', href: `/dashboard/${input.eventId}` };
    default:
      return { label: 'Back to Setnayan', href: '/dashboard' };
  }
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE LANE — the one question, asked once, for every surface that addresses a
 * payer about an order.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🚨 WHY IT WAS HOISTED OUT OF `payBackLink` (2026-09-20, same order, second
 * surface). The `/pay` back control was fixed above; the NOTIFICATIONS were
 * not. Approving that same ₱837.50 fee sent the supplier two notices and two
 * emails, every one of them pointing at
 * `/dashboard/cc47d373-…/orders/7d1a014d-…` — the couple's dashboard again,
 * built by `order?.event_id ? … : null` at SIX separate emit sites in
 * `app/admin/payments/actions.ts`.
 *
 * 🔑 ONE DEFECT, TWO SURFACES, BECAUSE THE RULE LIVED IN ONLY ONE OF THEM.
 * Fixing the page and leaving the notice is how a corrected rule gets
 * re-invented: the second copy is written by whoever reaches the second
 * surface, from the same wrong assumption. The lane is now a single exported
 * decision, and BOTH the back control and the notice link are thin renderings
 * of it — a third surface must ask this function or the guard fails.
 *
 * ⚖ `event_id` is NOT a claim of ownership. On a booking fee it says *the fee
 * is FOR this celebration*; the order's `user_id` is the SUPPLIER and its
 * `vendor_profile_id` is the shop being billed. Asking "is there an event?"
 * first is precisely the bug — the shop question must come first, because
 * these orders answer yes to both.
 */
export type OrderLane =
  | { kind: 'vendor-booking-fee' }
  | { kind: 'vendor' }
  | { kind: 'event' }
  | { kind: 'home' };

export function orderLane(input: PayBackInput): OrderLane {
  const viewerIsBuyer =
    input.viewerUserId != null &&
    input.ownerUserId != null &&
    input.viewerUserId === input.ownerUserId;

  if (input.vendorProfileId && viewerIsBuyer) {
    return input.isBookingFee ? { kind: 'vendor-booking-fee' } : { kind: 'vendor' };
  }
  if (input.eventId) return { kind: 'event' };
  if (input.vendorProfileId) return { kind: 'vendor' };
  return { kind: 'home' };
}

/**
 * Where a NOTIFICATION about this order should land its recipient — the deep
 * link, not the lane's front door, because a notice names one order.
 *
 * ⚠ THE RECIPIENT IS THE VIEWER. A notification is addressed to exactly one
 * person, so "who is looking" is known at emit time and must be passed; a
 * notice built without it falls back to the order's own shape and can point a
 * shop at a celebration, which is the defect this exists to close.
 *
 * Returns `null` when there is nowhere honest to send them. That is today's
 * behaviour for an order with no event and no shop, and it is deliberate: a
 * notice with no link is a notice that tells the truth, while a notice linking
 * to a 404 costs the reader a click to learn nothing.
 *
 * 🔑 `relatedUrl` IS ALSO THE EMAIL'S LINK. `lib/notification-emit.ts` composes
 * the Resend body as `${appUrl}${relatedUrl}`, so a wrong route here is wrong
 * in an inbox too, where it outlives the tray badge.
 */
export function orderNoticeLink(
  input: Omit<PayBackInput, 'viewerUserId'> & {
    /** Who this single notification is addressed to. */
    recipientUserId: string | null;
  },
): string | null {
  const lane = orderLane({ ...input, viewerUserId: input.recipientUserId });
  switch (lane.kind) {
    case 'vendor-booking-fee':
      return `/vendor-dashboard/booking-fees/${input.orderId}`;
    case 'vendor':
      return '/vendor-dashboard';
    case 'event':
      return `/dashboard/${input.eventId}/orders/${input.orderId}`;
    default:
      return null;
  }
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE ROW FORM — what a caller holding an `orders` row actually calls.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔑 IT LIVES HERE BECAUSE A GUARD CAN ONLY GREP `actions.ts`. That file is a
 * server-action module; a test cannot import it. The mapping from an order row
 * to the lane's inputs used to sit inside it, and a sabotage run proved the
 * cost: replacing `vendorProfileId: order?.vendor_profile_id ?? null` with
 * `vendorProfileId: null` — which sends every supplier back to the couple's
 * dashboard, the exact production defect — left the suite GREEN. The guard
 * asserted that the string `vendorProfileId:` appeared, and it still did.
 *
 * ⚠ THAT IS THE "KEEP THE CALL, DISCARD ITS RESULT" SHAPE. A guard that checks
 * a key is present cannot see what the key is assigned. So the mapping moved
 * into this pure module where the test EXECUTES it against a real row shape,
 * and `actions.ts` now holds no mapping at all — it imports this function and
 * hands it the row.
 */
export type NoticeOrderRow =
  | {
      event_id?: string | null;
      vendor_profile_id?: string | null;
      user_id?: string | null;
      service_key?: string | null;
    }
  | null
  | undefined;

/** Where a notice about this order row should land `recipientUserId`. */
export function orderNoticeLinkForRow(
  order: NoticeOrderRow,
  orderId: string,
  recipientUserId: string | null | undefined,
): string | null {
  return orderNoticeLink({
    orderId,
    isBookingFee: isBookingFeeOrder(order?.service_key),
    eventId: order?.event_id ?? null,
    vendorProfileId: order?.vendor_profile_id ?? null,
    ownerUserId: order?.user_id ?? null,
    recipientUserId: recipientUserId ?? null,
  });
}

/** What a settled-order notice about this row may promise `recipientUserId`. */
export function orderPaidBodyForRow(
  order: NoticeOrderRow,
  orderId: string,
  recipientUserId: string | null | undefined,
): string {
  return orderPaidBody({
    orderId,
    isBookingFee: isBookingFeeOrder(order?.service_key),
    eventId: order?.event_id ?? null,
    vendorProfileId: order?.vendor_profile_id ?? null,
    ownerUserId: order?.user_id ?? null,
    recipientUserId: recipientUserId ?? null,
  });
}

/**
 * Is this the booking fee? Derived from the one parser the fee lane itself
 * keys on, never a second spelling of it.
 *
 * Exported from here so the notice path and `lib/payable-by-reference.ts` ask
 * the identical question — the lane above is only as honest as the flag fed
 * into it, and two private copies of "is this a fee" is how they drift.
 */
export function isBookingFeeOrder(serviceKey: string | null | undefined): boolean {
  return chargeIdFromBookingFeeLockServiceKey(serviceKey ?? '') !== null;
}

/**
 * What a notice may PROMISE a payer whose order just settled.
 *
 * 🪤 THE WORDING WAS COUPLE-ONLY AND IT WENT TO A SUPPLIER. `order_paid` read
 * *"Your order is fully paid. We'll start work right away."* — addressed, on a
 * booking fee, to the shop that does the work. Setnayan starts nothing when a
 * supplier settles their fee; the fee is what Setnayan is OWED for a booking
 * the supplier already won. A promise that cannot be kept is not a tone
 * problem, it is a false statement about what happens next.
 *
 * Keyed on the SAME lane as the link above, so a surface cannot route a
 * supplier correctly and still address them as a couple.
 */
export function orderPaidBody(
  input: Omit<PayBackInput, 'viewerUserId'> & { recipientUserId: string | null },
): string {
  const lane = orderLane({ ...input, viewerUserId: input.recipientUserId });
  if (lane.kind === 'vendor-booking-fee') {
    return 'Your booking fee is settled — nothing further is owed on it.';
  }
  if (lane.kind === 'vendor') {
    return 'This order is fully paid. Nothing further is owed on it.';
  }
  return "Your order is fully paid. We'll start work right away.";
}

/**
 * Is this destination one only that event's couple can open?
 *
 * The guard asks this of every link the page offers a supplier. It is a
 * question about the ROUTE, not about wording — a re-labelled
 * `/dashboard/<eventId>` is the same 404.
 *
 * ⚠ IT MATCHES THE EVENT ID'S SHAPE, NOT MERELY THE `/dashboard/` PREFIX. The
 * account pages live under that prefix too (`/dashboard/creator`,
 * `/dashboard/people`) and a supplier can open every one of them, so a
 * prefix test would convict routes that are perfectly reachable.
 */
const EVENT_ID =
  /^\/dashboard\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

export function isCoupleOnlyRoute(href: string): boolean {
  return EVENT_ID.test(href);
}
