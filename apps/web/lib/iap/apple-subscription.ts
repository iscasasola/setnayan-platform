/**
 * 🍎 READ AN APPLE SUBSCRIPTION — the supplier plans' half of lib/iap/apple-transaction.ts. Pure.
 *
 * Runs only on a payload `verifyAppleJws` already proved Apple signed. Verified is not the same as OURS: a genuine
 * transaction can be for another app, for a product that is not a supplier plan, not a subscription at all, or SHARED
 * through Family Sharing — and a family member's copy of a shop's plan is refused here (owner-locked 22 Nov: one
 * subscription = one shop; `inAppOwnershipType = FAMILY_SHARED` never grants).
 *
 * `decideSupplierPlanNotification` turns one App Store Server Notification (v2) into the ONE thing the server does
 * with it. Each type the spec names (item D) has its branch, and each branch has its test
 * (lib/iap/apple-subscription.test.ts).
 */

import { APP_BUNDLE_ID } from './apple-transaction';
import { supplierPlanProductById, type SupplierPlanProduct } from './supplier-plans';

export type AppleSubscriptionTransaction = {
  transactionId: string;
  originalTransactionId: string;
  product: SupplierPlanProduct;
  /** The shop the FIRST purchase named (lowercased UUID), or null — Apple drops it on some restores. */
  appAccountToken: string | null;
  environment: 'Production' | 'Sandbox';
  purchaseDate: Date | null;
  expiresDate: Date;
  revocationDate: Date | null;
  priceMilliunits: number | null;
  currency: string | null;
};

export type SubscriptionRefusal =
  | 'bad_shape'
  | 'wrong_app'
  | 'not_a_supplier_plan'
  | 'not_subscription'
  | 'family_shared'
  | 'no_expiry'
  | 'unknown_environment';

export const AUTO_RENEWABLE = 'Auto-Renewable Subscription';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function date(v: unknown): Date | null {
  const n = num(v);
  return n === null ? null : new Date(n);
}

/** Is this decoded transaction a supplier plan at all? (So a consumable's REFUND keeps its own path.) */
export function isSupplierPlanPayload(payload: Record<string, unknown>): boolean {
  return supplierPlanProductById(str(payload.productId)) !== null;
}

/** Shape-check a VERIFIED transaction payload against the supplier plans we sell. */
export function readAppleSubscriptionTransaction(
  payload: Record<string, unknown>,
): { ok: true; tx: AppleSubscriptionTransaction } | { ok: false; reason: SubscriptionRefusal } {
  const transactionId = str(payload.transactionId);
  const bundleId = str(payload.bundleId);
  if (!transactionId || !bundleId) return { ok: false, reason: 'bad_shape' };
  if (bundleId !== APP_BUNDLE_ID) return { ok: false, reason: 'wrong_app' };
  const product = supplierPlanProductById(str(payload.productId));
  if (!product) return { ok: false, reason: 'not_a_supplier_plan' };
  if (payload.type !== AUTO_RENEWABLE) return { ok: false, reason: 'not_subscription' };
  // 👪 One subscription = one shop. A family member's shared copy is never a plan for THEIR shop.
  if (payload.inAppOwnershipType === 'FAMILY_SHARED') return { ok: false, reason: 'family_shared' };
  const expiresDate = date(payload.expiresDate);
  if (!expiresDate) return { ok: false, reason: 'no_expiry' };
  const environment = payload.environment;
  if (environment !== 'Production' && environment !== 'Sandbox') return { ok: false, reason: 'unknown_environment' };
  const token = str(payload.appAccountToken);
  const currency = str(payload.currency);
  return {
    ok: true,
    tx: {
      transactionId,
      originalTransactionId: str(payload.originalTransactionId) ?? transactionId,
      product,
      appAccountToken: token && UUID_RE.test(token) ? token.toLowerCase() : null,
      environment,
      purchaseDate: date(payload.purchaseDate),
      expiresDate,
      revocationDate: date(payload.revocationDate),
      priceMilliunits: num(payload.price),
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    },
  };
}

/** The fields of Apple's JWSRenewalInfoDecodedPayload this build reads. */
export type AppleRenewalInfo = {
  autoRenew: boolean | null;
  autoRenewProductId: string | null;
  gracePeriodExpiresDate: Date | null;
  inBillingRetry: boolean | null;
};

export function readAppleRenewalInfo(payload: Record<string, unknown> | null): AppleRenewalInfo {
  if (!payload) return { autoRenew: null, autoRenewProductId: null, gracePeriodExpiresDate: null, inBillingRetry: null };
  const status = num(payload.autoRenewStatus);
  const retry = payload.isInBillingRetryPeriod;
  return {
    autoRenew: status === null ? null : status === 1,
    autoRenewProductId: supplierPlanProductById(str(payload.autoRenewProductId))?.productId ?? null,
    gracePeriodExpiresDate: date(payload.gracePeriodExpiresDate),
    inBillingRetry: typeof retry === 'boolean' ? retry : null,
  };
}

/** The parts of a notification's decoded payload the supplier path reads (the outer JWS, already verified). */
export type SubscriptionNotificationParts = {
  notificationType: string;
  subtype: string | null;
  /** When Apple signed the notification — the date a failed renewal is recorded under. */
  signedDate: Date | null;
  signedTransactionInfo: string | null;
  signedRenewalInfo: string | null;
};

export function readSubscriptionNotificationParts(payload: Record<string, unknown>): SubscriptionNotificationParts | null {
  const notificationType = str(payload.notificationType);
  if (!notificationType) return null;
  const data = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : {};
  const jws = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64_000 ? v : null);
  return {
    notificationType,
    subtype: str(payload.subtype),
    signedDate: date(payload.signedDate),
    signedTransactionInfo: jws(data.signedTransactionInfo),
    signedRenewalInfo: jws(data.signedRenewalInfo),
  };
}

/** The notification types that only ever concern a subscription — routed to the supplier path without asking. */
export const SUBSCRIPTION_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'SUBSCRIBED',
  'DID_RENEW',
  'DID_CHANGE_RENEWAL_PREF',
  'DID_CHANGE_RENEWAL_STATUS',
  'DID_FAIL_TO_RENEW',
  'GRACE_PERIOD_EXPIRED',
  'EXPIRED',
  'REVOKE',
  'OFFER_REDEEMED',
  'PRICE_INCREASE',
  'RENEWAL_EXTENDED',
  'RENEWAL_EXTENSION',
]);

export type SupplierPlanDecision =
  /** A paid period: switch the plan on until Apple's expiresDate (the shared applier). */
  | { kind: 'apply' }
  /** Something changed without a payment: record it, touch no plan. */
  | {
      kind: 'note';
      status: 'active' | 'billing_retry' | null;
      autoRenew: boolean | null;
      autoRenewProductId: string | null;
      graceExpiresAt: Date | null;
      failedAt: Date | null;
    }
  /** The plan ends: a lapse (expired) or the money went back (refunded · revoked — E: at once). */
  | { kind: 'end'; status: 'expired' | 'refunded' | 'revoked'; transactionId: string | null }
  /** For a person, never automatic (a refund reversed is never a silent re-grant). */
  | { kind: 'record'; what: string }
  | { kind: 'ignore'; what: string };

/**
 * One notification → one decision. `tx` is the verified, OURS transaction; `renewal` Apple's renewal info (or nulls).
 *
 *   SUBSCRIBED (INITIAL_BUY · RESUBSCRIBE)        → apply
 *   DID_RENEW (incl. BILLING_RECOVERY)             → apply
 *   DID_CHANGE_RENEWAL_PREF / UPGRADE               → apply — Apple bills the higher plan from today (E: up = now)
 *   DID_CHANGE_RENEWAL_PREF / DOWNGRADE · (none)    → note the plan it renews into — E: down = at the end of the month
 *   DID_CHANGE_RENEWAL_STATUS                       → note auto-renew on/off (a cancel keeps the month already paid)
 *   DID_FAIL_TO_RENEW (GRACE_PERIOD · none)         → note billing_retry + the date (THE GRACE HOOK, not grace itself)
 *   GRACE_PERIOD_EXPIRED · EXPIRED                  → end expired
 *   REFUND                                          → end refunded (that transaction) — E: drops at once
 *   REVOKE                                          → end revoked (the whole subscription) — E: drops at once
 *   REFUND_REVERSED                                 → record for an admin
 *   anything else                                   → ignore (200, named)
 */
export function decideSupplierPlanNotification(
  n: Pick<SubscriptionNotificationParts, 'notificationType' | 'subtype' | 'signedDate'>,
  tx: Pick<AppleSubscriptionTransaction, 'transactionId'>,
  renewal: AppleRenewalInfo,
): SupplierPlanDecision {
  const note = (status: 'active' | 'billing_retry' | null, failedAt: Date | null = null): SupplierPlanDecision => ({
    kind: 'note',
    status,
    autoRenew: renewal.autoRenew,
    autoRenewProductId: renewal.autoRenewProductId,
    graceExpiresAt: renewal.gracePeriodExpiresDate,
    failedAt,
  });
  switch (n.notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
      return { kind: 'apply' };
    case 'DID_CHANGE_RENEWAL_PREF':
      return n.subtype === 'UPGRADE' ? { kind: 'apply' } : note(null);
    case 'DID_CHANGE_RENEWAL_STATUS':
      return note(null);
    case 'DID_FAIL_TO_RENEW':
      return note('billing_retry', n.signedDate ?? null);
    case 'GRACE_PERIOD_EXPIRED':
    case 'EXPIRED':
      return { kind: 'end', status: 'expired', transactionId: tx.transactionId };
    case 'REFUND':
      return { kind: 'end', status: 'refunded', transactionId: tx.transactionId };
    case 'REVOKE':
      return { kind: 'end', status: 'revoked', transactionId: null };
    case 'REFUND_REVERSED':
      return { kind: 'record', what: 'REFUND_REVERSED' };
    default:
      return { kind: 'ignore', what: n.notificationType };
  }
}

