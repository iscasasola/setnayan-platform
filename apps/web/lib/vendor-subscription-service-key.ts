/**
 * lib/vendor-subscription-service-key.ts — the service_key that ties a plan
 * purchase to the ONE payment page.
 *
 * # Why a vendor plan purchase needs an `orders` row at all
 *
 * Every other vendor purchase (extra seat, branch, deep search, booking fee,
 * Custom plan) already mints an `orders` row and hangs its proof off
 * `payments`. A SUBSCRIPTION did not: `create_vendor_subscription` wrote a
 * `vendor_subscriptions` row and nothing else, and `payments.order_id` is NOT
 * NULL — so a shop that paid for a plan had NOWHERE to put the screenshot or
 * the reference number. The screen matched: a static QR, no amount, no upload.
 * That is the defect the owner reported on 2026-08-21.
 *
 * So the plan purchase now mints the same shape everything else does, and the
 * shared /pay/[reference] page works for it with no special case.
 *
 * # Why the purchase id rides in the key
 *
 * `activateOrderSku` dispatches on `service_key`, and the PREFIX_HOOKS family
 * (`vendor_additional_branch__<id>`, `vendor_extra_seat__<id>`, …) is how a
 * dynamic target is named. Approving the PAYMENT must therefore be able to
 * find the exact purchase to approve — otherwise the admin has to confirm the
 * same money twice, in two places, and the second one is the one that actually
 * switches the plan on.
 *
 * Pure and side-effect free (no `server-only`, no SDK) so it is unit-testable
 * and can be imported from both the mint path and the activation dispatcher —
 * the same reason `lib/vendor-target-ownership.ts` is split out.
 */

const PREFIX = 'vendor_subscription__';

/** A UUID, lowercased — the only shape a purchase id can take. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The `service_key` for a plan purchase. */
export function vendorSubscriptionServiceKey(purchaseId: string): string {
  return PREFIX + purchaseId;
}

/**
 * The purchase this key names, or null when the key is not one of ours.
 *
 * Deliberately strict about the id's SHAPE: the activation hook feeds this
 * straight into `approve_vendor_subscription`, and a key like
 * `vendor_subscription__` (empty suffix) or one carrying anything other than a
 * uuid must miss the hook entirely rather than reach the RPC with rubbish.
 */
export function purchaseIdFromVendorSubscriptionServiceKey(
  serviceKey: string | null | undefined,
): string | null {
  if (typeof serviceKey !== 'string' || !serviceKey.startsWith(PREFIX)) return null;
  const id = serviceKey.slice(PREFIX.length).toLowerCase();
  return UUID.test(id) ? id : null;
}
