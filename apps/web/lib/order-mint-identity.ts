/**
 * SEC-4b — THE CHECK THAT REPLACES THE RLS `WITH CHECK` WE REVOKED.
 *
 * Pure and client-safe (NO `server-only`, NO SDK, NO I/O) so it can be unit
 * tested under the Node runner, mirroring the `lib/r2-client-ref.ts` house
 * pattern.
 *
 * # Why this exists
 *
 * Migration 20271008178212 revokes INSERT on `public.orders` + `public.payments`
 * from `authenticated` and `anon`, because a session-role INSERT could set
 * `requested_total_php` to ₱1 for any SKU (`orders_owner_write` authenticates
 * the BUYER and says nothing about the AMOUNT; the money-column guard is
 * BEFORE **UPDATE** and never sees an INSERT). The server becomes the only
 * minter.
 *
 * That fix has a sharp edge. `orders_owner_write`'s
 * `WITH CHECK (user_id = auth.uid())` was the ONLY thing binding a minted row
 * to the caller — and `service_role` bypasses every policy on the table. Moving
 * a site to `createAdminClient()` without replacing that check trades a pricing
 * hole for an AUTHORIZATION hole, which is strictly worse.
 *
 * # What this module guarantees, and what it does not
 *
 * It STAMPS the three identity columns from values the SERVER derived, and
 * makes it a TYPE ERROR for a call site to supply them itself:
 *
 *     orderRowFor({ userId: user.id, eventId: null, vendorProfileId },
 *                 { service_key: …, requested_total_php: …, … })
 *
 * `user_id` therefore cannot come from `formData` by construction — not by
 * review, not by convention. That is the property RLS used to provide.
 *
 * It does NOT authorize. Deciding that this caller may buy for this event /
 * this vendor is the CALL SITE's job and must happen BEFORE the stamp — the
 * membership lookup, the coordinator money scope, `fetchOwnVendorProfile` +
 * `resolveVendorRoleForProfile`, the booked-on-this-event read. Each converted
 * site names the gate it relies on in a comment directly above its call.
 *
 * # Fail closed
 *
 * A missing or blank `userId` (or `verifiedOrderId`) means the caller could not
 * establish who it is acting for. That is never a reason to insert anyway, so
 * it throws `MintIdentityRefused` and the row is not written.
 *
 * The message is deliberately GENERIC and identical for every fault — it never
 * echoes an id, a table, or which check failed, so it cannot be used as an
 * existence oracle (same posture as the `lib/r2-client-ref.ts` refusals).
 */

/** The one refusal string. Never varies by cause — see the header. */
export const MINT_IDENTITY_REFUSED =
  'We could not start this order. Please refresh and try again.';

export class MintIdentityRefused extends Error {
  /**
   * Machine-readable cause, for logs and tests ONLY. It must never reach a
   * response body — `message` is what callers surface.
   */
  readonly fault: MintIdentityFault;

  constructor(fault: MintIdentityFault) {
    super(MINT_IDENTITY_REFUSED);
    this.name = 'MintIdentityRefused';
    this.fault = fault;
  }
}

export type MintIdentityFault =
  | 'no-server-user'
  | 'no-verified-order';

/**
 * Who the server decided this row belongs to. Every field must come from a
 * server-side resolve, never from a form field:
 *
 *  • `userId`          — `(await supabase.auth.getUser()).data.user.id`.
 *  • `eventId`         — the event the caller was AUTHORIZED against (the one
 *                        the membership / booked-vendor check ran on), or
 *                        `null` for the eventless vendor + per-user SKUs.
 *                        Passing a client-supplied id that no check covered is
 *                        the mistake this field's name exists to prevent.
 *  • `vendorProfileId` — from `fetchOwnVendorProfile()` / the admin vendor
 *                        context, or `null` on couple-side purchases.
 *
 * Both nullable fields are REQUIRED (`string | null`, not optional) so that
 * "this row has no event" is a decision the author had to write down rather
 * than something they forgot.
 */
export type MintIdentity = {
  userId: string;
  eventId: string | null;
  vendorProfileId: string | null;
};

/** Columns this module owns. A call site may not set them. */
type OrderIdentityColumn = 'user_id' | 'event_id' | 'vendor_profile_id';
type PaymentIdentityColumn = 'user_id' | 'order_id';

/** `Partial<Record<K, never>>` makes supplying any of those keys a type error. */
type Forbid<K extends string> = Partial<Record<K, never>>;

function requireNonBlank(value: string | null | undefined, fault: MintIdentityFault): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MintIdentityRefused(fault);
  }
  return value;
}

/**
 * Build an `orders` INSERT payload with its identity columns stamped from the
 * server-derived identity.
 *
 * ```ts
 * const row = orderRowFor(
 *   { userId: user.id, eventId: null, vendorProfileId },
 *   { service_key: SKU, description: '…', requested_total_php: pricePhp,
 *     status: 'submitted', reference_code: referenceCode },
 * );
 * // …then hand `row` to the service-role insert.
 * ```
 *
 * (The example stops short of the insert call on purpose:
 * `lib/order-price-authority.test.ts` identifies order minters by
 * source-scanning for a PostgREST insert chain on the orders table, and this
 * module builds payloads — it is not itself a minter.)
 *
 * @throws {MintIdentityRefused} when no server user could be resolved.
 */
export function orderRowFor<T extends Record<string, unknown>>(
  identity: MintIdentity,
  fields: T & Forbid<OrderIdentityColumn>,
): T & { user_id: string; event_id: string | null; vendor_profile_id: string | null } {
  const userId = requireNonBlank(identity.userId, 'no-server-user');
  return {
    ...(fields as T),
    user_id: userId,
    event_id: identity.eventId ?? null,
    vendor_profile_id: identity.vendorProfileId ?? null,
  };
}

/**
 * Build a `payments` INSERT payload.
 *
 * `verifiedOrderId` must be an order the caller has PROVEN is theirs — either
 * one just minted in the same request, or one read back through an RLS-scoped
 * `orders` SELECT on the SESSION client. This is the property
 * `payments_owner_insert` never had: it checked the payer and left `order_id`
 * to the FK, which validates existence only, so an authenticated user could pin
 * a payment onto a stranger's order.
 *
 * The AMOUNT is deliberately not checked here. Re-deriving it would need a
 * second pricing source of truth, which is exactly what SEC-4 exists to
 * prevent; `amount_php` is a CLAIM the admin reconciles against the real bank
 * message at /admin/payments.
 *
 * @throws {MintIdentityRefused} when no server user or no verified order id.
 */
export function paymentRowFor<T extends Record<string, unknown>>(
  identity: { userId: string; verifiedOrderId: string },
  fields: T & Forbid<PaymentIdentityColumn>,
): T & { user_id: string; order_id: string } {
  const userId = requireNonBlank(identity.userId, 'no-server-user');
  const orderId = requireNonBlank(identity.verifiedOrderId, 'no-verified-order');
  return { ...(fields as T), user_id: userId, order_id: orderId };
}
