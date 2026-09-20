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
 */

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
  const viewerIsBuyer =
    input.viewerUserId != null &&
    input.ownerUserId != null &&
    input.viewerUserId === input.ownerUserId;

  if (input.vendorProfileId && viewerIsBuyer) {
    return input.isBookingFee
      ? {
          label: 'Back to this booking fee',
          href: `/vendor-dashboard/booking-fees/${input.orderId}`,
        }
      : { label: 'Back to your shop', href: '/vendor-dashboard' };
  }

  if (input.eventId) {
    return { label: 'Back to your celebration', href: `/dashboard/${input.eventId}` };
  }

  if (input.vendorProfileId) {
    return { label: 'Back to your shop', href: '/vendor-dashboard' };
  }

  return { label: 'Back to Setnayan', href: '/dashboard' };
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
