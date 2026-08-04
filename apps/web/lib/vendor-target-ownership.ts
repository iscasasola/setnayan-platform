/**
 * SEC-4b · may THIS order provision THAT vendor-owned target?
 *
 * The decision half of `assertOrderOwnsVendorTarget` (lib/sku-activation.ts),
 * split out so it can be unit-tested under the Node test runner — the same house
 * pattern as `lib/r2-client-ref.ts` and `lib/self-comp-authority.ts`.
 *
 * WHY THE SPLIT EXISTS: `sku-activation.ts` cannot be imported by a test. It
 * pulls `@/app/dashboard/(account)/profile/concierge/actions` →
 * `lib/notification-emit` → `server-only`, which throws under `tsx --test`. So
 * the gate's wiring is provable only by source scan, and its *rule* was provable
 * not at all. Everything below is pure — no I/O, no SDK, no `server-only` — so
 * the rule itself is now exercised directly.
 *
 * THE RULE, and why every branch of it is a refusal:
 *
 *   • Both ids present and equal → ALLOW. The paying order belongs to the vendor
 *     that owns the branch / charge / profile being provisioned.
 *   • Order has no vendor (`null`) → REFUSE. Couple-side checkout pins
 *     `orders.vendor_profile_id` to NULL, so this is exactly the couple-minted
 *     row that must never provision a vendor's object — including one minted by
 *     a comp grant or by hand.
 *   • Target unknown (`null`) → REFUSE. The resolver returns null when the
 *     branch or charge does not exist. "I could not find the owner" is not
 *     permission; treating it as one would make a typo'd id a skeleton key.
 *   • Ids differ → REFUSE. The cross-tenant case.
 *
 * Fails CLOSED in every direction: only a positive, matching pair passes.
 */

/** A blank-ish id is as good as absent — never a match. */
function normalizeId(id: string | null | undefined): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * May an order owned by `orderVendorProfileId` provision a target owned by
 * `targetVendorProfileId`?
 *
 * Comparison is exact and case-sensitive: these are UUIDs minted by the
 * database, not user-entered strings, so a case-insensitive compare would only
 * ever widen the gate.
 */
export function orderMayProvisionVendorTarget(
  orderVendorProfileId: string | null | undefined,
  targetVendorProfileId: string | null | undefined,
): boolean {
  const order = normalizeId(orderVendorProfileId);
  const target = normalizeId(targetVendorProfileId);
  if (order === null || target === null) return false;
  return order === target;
}

/**
 * The refusal message. Deliberately names both ids: this lands in a server log
 * and in Sentry, where the whole point is being able to tell a misconfiguration
 * from an attack. It is never shown to a user.
 */
export function vendorTargetRefusalMessage(args: {
  orderId: string;
  serviceKey: string;
  orderVendorProfileId: string | null | undefined;
  targetVendorProfileId: string | null | undefined;
}): string {
  const order = normalizeId(args.orderVendorProfileId) ?? 'null';
  const target = normalizeId(args.targetVendorProfileId) ?? 'unknown';
  return (
    `SEC-4b: order ${args.orderId} (vendor_profile_id=${order}) may not ` +
    `provision ${args.serviceKey}, which belongs to vendor ${target}. Refusing to activate.`
  );
}
