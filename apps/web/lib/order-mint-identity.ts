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
  | 'no-verified-order'
  | 'no-guest-event'
  | 'no-guest-owner';

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
type PaymentIdentityColumn = 'user_id' | 'order_id' | 'status';

/**
 * SEC-4b · F1 — THE STATUS ALLOW-LIST THAT REPLACES `orders_insert_status_guard`.
 *
 * `orders_insert_status_guard` (20270920010000) is RESTRICTIVE `TO authenticated`
 * and reads
 *
 *     auth.role() = 'service_role' OR public.is_admin()
 *       OR status = ANY (ARRAY['draft','submitted','awaiting_payment','cancelled'])
 *
 * Its FIRST branch is a blanket `service_role` exemption, so the moment a call
 * site moved to `createAdminClient()` the policy stopped constraining it. The
 * status ladder is the difference between "queued for the admin to reconcile"
 * and "activated, no money required": a path that can write `'paid'` can hand
 * itself a SKU. That constraint has to come back somewhere, and under
 * service_role the only place left is the type system.
 *
 * These are EXACTLY the four the dropped policy permitted — not one more. New
 * values do not get added here to make a call site compile; see
 * `compOrderRowFor` for the separate, deliberately narrower comp path.
 */
export type OrderMintStatus = 'draft' | 'submitted' | 'awaiting_payment' | 'cancelled';

/**
 * Constrains `status` WITHOUT requiring it, mirroring the policy: the guard
 * checked the VALUE, never the presence. Omitting it lets `orders.status`
 * default to `'submitted'` (20260513150000:55), which is itself on the list.
 */
type OrderStatusField = { status?: OrderMintStatus };

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
 * `status`, when supplied, is constrained to {@link OrderMintStatus} — the four
 * values `orders_insert_status_guard` allowed a non-admin session to write.
 * `'paid'` / `'refunded'` are therefore a COMPILE ERROR here; a ₱0 comp grant
 * uses {@link compOrderRowFor}, which cannot express a non-zero amount.
 *
 * @throws {MintIdentityRefused} when no server user could be resolved.
 */
export function orderRowFor<T extends Record<string, unknown> & OrderStatusField>(
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
 * Mint a ₱0 COMP order — already `status='paid'`, no money ever expected.
 *
 * # Why this is a second door and not a fifth allow-list entry
 *
 * Three vendor self-serve paths hand out a free cycle and mint the order
 * already settled:
 *
 *   • `subscription/ai-addon-actions.ts`      — Vendor AI, first cycle free
 *   • `subscription/booth-addon-actions.ts`   — 3D Booth, first cycle / first 5
 *   • `subscription/photo-challenge-actions.ts`      — Papic Challenges, first 5
 *
 * All three were ALREADY on `createAdminClient()` before SEC-4b, so they were
 * always taking `orders_insert_status_guard`'s `service_role` branch and never
 * lost a check — they are not among the converted paths F1 is restoring. Adding
 * `'paid'` to {@link OrderMintStatus} to make them compile would hand the
 * *converted* paths the one status that skips reconciliation entirely, which is
 * the opposite of the fix.
 *
 * So they get their own narrower door. This helper STAMPS `status`,
 * `requested_total_php` and `confirmed_total_php` and forbids all three, so a
 * comp mint is structurally incapable of being a non-zero charge — strictly
 * tighter than the hand-written literals it replaces, where a later edit could
 * quietly turn `requested_total_php: 0` into `5000` beside `status: 'paid'`.
 *
 * ⚠ This is NOT a general escape hatch from {@link OrderMintStatus}. It mints
 * one shape and one shape only: a free grant. A path that needs to charge money
 * uses `orderRowFor`.
 *
 * @throws {MintIdentityRefused} when no server user could be resolved.
 */
export function compOrderRowFor<T extends Record<string, unknown>>(
  identity: MintIdentity,
  fields: T & Forbid<OrderIdentityColumn | 'status' | 'requested_total_php' | 'confirmed_total_php'>,
): T & {
  user_id: string;
  event_id: string | null;
  vendor_profile_id: string | null;
  status: 'paid';
  requested_total_php: 0;
  confirmed_total_php: 0;
} {
  const userId = requireNonBlank(identity.userId, 'no-server-user');
  return {
    ...(fields as T),
    user_id: userId,
    event_id: identity.eventId ?? null,
    vendor_profile_id: identity.vendorProfileId ?? null,
    status: 'paid',
    requested_total_php: 0,
    confirmed_total_php: 0,
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
 * # SEC-4b · F1 — the restored `payments_insert_status_guard`
 *
 * `status` is STAMPED `'pending'` and is a forbidden field, restoring
 * `payments_insert_status_guard` (20270920010000), which was RESTRICTIVE
 * `TO authenticated` and read
 *
 *     auth.role() = 'service_role' OR public.is_admin() OR status = 'pending'
 *
 * — and therefore stopped constraining anything the moment these sites moved to
 * service_role. `'pending'` is the value every converted site was already
 * getting from the column default (20260513150000:96), so this changes no
 * behaviour; it makes the value unforgeable rather than merely unforged.
 *
 * This matters more than the orders half: promotion to `'paid'` is the
 * admin-only /admin/payments approve path (approvePaymentCore →
 * activateOrderSku). A payer who could write their own `status` would settle
 * their own order.
 *
 * @throws {MintIdentityRefused} when no server user or no verified order id.
 */
export function paymentRowFor<T extends Record<string, unknown>>(
  identity: { userId: string; verifiedOrderId: string },
  fields: T & Forbid<PaymentIdentityColumn>,
): T & { user_id: string; order_id: string; status: 'pending' } {
  const userId = requireNonBlank(identity.userId, 'no-server-user');
  const orderId = requireNonBlank(identity.verifiedOrderId, 'no-verified-order');
  return { ...(fields as T), user_id: userId, order_id: orderId, status: 'pending' };
}

// ===========================================================================
// THE GUEST DOOR (owner-locked 2026-07-29) — an order with no account behind it
// ===========================================================================
//
// # Why a third door and not `userId: string | null`
//
// Relaxing `MintIdentity.userId` to nullable would make EVERY existing call
// site able to mint an owner-less order by passing a value that happened to be
// null — and `orderRowFor`'s entire job is that a missing identity is a REFUSAL,
// not a default. Nine of the eleven roster entries have a real buyer and must
// keep failing closed when they cannot find one. So the account-less case gets
// its own narrower door, exactly as `compOrderRowFor` did for the ₱0 comp
// shape.
//
// # What replaces `user_id = auth.uid()` here
//
// Nothing, and that is deliberate: there is no account to bind to. What binds
// the row instead is the OWNER AXIS — the camera seat the buyer holds, or the
// guest-QR identity they arrived with. Both are resolved server-side from a
// credential the browser already had (a claimed `paparazzi_seats.claim_qr_token`
// or the signed `setnayan_guest_session` cookie), never read off the form; the
// call site names the gate it relies on in a comment above its call, same rule
// as every other door.
//
// The axis is REQUIRED. An order with neither a seat nor a guest is an order
// nobody can be shown to have placed, which is the state the removed
// `user_id NOT NULL` used to make impossible, so it is refused here as well as
// CHECKed in the database (migration 20271019639608).
//
// `userId` stays OPTIONAL and is stamped when present, so a signed-in host who
// happens to tap the guest surface keeps their order in their own dashboard —
// "attach the account when there is one, never require it".

/**
 * Who a GUEST order belongs to when there is no account. Exactly the fields the
 * server resolved:
 *
 *  • `eventId` — the event the credential resolved to. NEVER a form value: it
 *                comes off the seat row or the signed guest cookie, which is
 *                what stops an order being attached to a stranger's event.
 *  • `seatId`  — the claimed camera seat, or null on the guest-QR surface.
 *  • `guestId` — the guest-QR identity, or null on the seat surface.
 *  • `userId`  — a real signed-in account IF one happened to be present.
 *                Anonymous auth sessions must be passed as null: an anonymous
 *                claimer is not "an account the buyer has", and stamping it
 *                would put the order in a dashboard nobody can sign back into.
 */
export type GuestMintIdentity = {
  eventId: string;
  seatId: string | null;
  guestId: string | null;
  userId: string | null;
};

/**
 * Build an `orders` INSERT payload for a purchase with no account behind it.
 *
 * @throws {MintIdentityRefused} when no event resolved, or when neither owner
 *         axis is present.
 */
export function guestOrderRowFor<T extends Record<string, unknown> & OrderStatusField>(
  identity: GuestMintIdentity,
  fields: T & Forbid<OrderIdentityColumn>,
): T & { user_id: string | null; event_id: string; vendor_profile_id: null } {
  const eventId = requireNonBlank(identity.eventId, 'no-guest-event');
  const hasSeat = typeof identity.seatId === 'string' && identity.seatId.trim().length > 0;
  const hasGuest = typeof identity.guestId === 'string' && identity.guestId.trim().length > 0;
  if (!hasSeat && !hasGuest) throw new MintIdentityRefused('no-guest-owner');
  const userId =
    typeof identity.userId === 'string' && identity.userId.trim().length > 0
      ? identity.userId
      : null;
  return {
    ...(fields as T),
    user_id: userId,
    event_id: eventId,
    vendor_profile_id: null,
  };
}

/**
 * Build a `payments` INSERT payload for a guest order.
 *
 * `verifiedOrderId` must be an order the caller PROVED is theirs. For a guest
 * that proof is the bearer `papic_guest_orders.access_token` they presented —
 * the account-less equivalent of the RLS-scoped `orders` read the signed-in
 * path uses, and the same guarantee: `payments_owner_insert` never checked that
 * `order_id` belonged to the payer, so the binding has to be made here.
 *
 * `status` is STAMPED `'pending'` and forbidden, identically to
 * {@link paymentRowFor}. This is the load-bearing half of the activation gate:
 * a payer who could write their own status would settle their own order, and
 * points are granted ONLY when an admin approves.
 *
 * @throws {MintIdentityRefused} when no verified order id.
 */
export function guestPaymentRowFor<T extends Record<string, unknown>>(
  identity: { verifiedOrderId: string; userId: string | null },
  fields: T & Forbid<PaymentIdentityColumn>,
): T & { user_id: string | null; order_id: string; status: 'pending' } {
  const orderId = requireNonBlank(identity.verifiedOrderId, 'no-verified-order');
  const userId =
    typeof identity.userId === 'string' && identity.userId.trim().length > 0
      ? identity.userId
      : null;
  return { ...(fields as T), user_id: userId, order_id: orderId, status: 'pending' };
}
