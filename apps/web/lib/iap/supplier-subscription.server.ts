import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAppleJws } from './apple-jws';
import { PRODUCTION_TRUSTED_ROOTS, chargedPhp } from './apple-transaction';
import {
  decideSupplierPlanNotification,
  isSupplierPlanPayload,
  readAppleRenewalInfo,
  readAppleSubscriptionTransaction,
  readSubscriptionNotificationParts,
  SUBSCRIPTION_NOTIFICATION_TYPES,
  type AppleSubscriptionTransaction,
} from './apple-subscription';
import { supplierPlanSkuCode } from './supplier-plans';
import type { IapConfirmResult } from './iap-outcome';
import { insertFaultLog } from '@/lib/telemetry/fault-log';

/**
 * 🏪 A SHOP'S PLAN, BILLED BY APPLE — the server half (spec item D, owner-locked 22 Nov 2026).
 *
 * Two doors reach it, both with Apple's signature checked first:
 *   · App Store Server Notifications v2 (`handleSupplierPlanNotification`, from lib/iap/notifications.server.ts) — the
 *     truth: every subscribe, renewal, plan change, failed renewal, expiry, refund and revoke;
 *   · the app's own confirm right after Apple's sheet (`confirmSupplierPlanJws`, folded into `confirmAppStorePurchase`
 *     — the server-action budget is at its ceiling) — the fast path, so the plan is on before the sheet closes.
 *
 * Neither grants anything itself. The database does, through the SAME applier and sweep the web plan uses
 * (migration 20271359936839: `app_store_supplier_plan_apply` · `_note` · `_end`). This module decides WHICH call a
 * notification is, and WHICH shop: the shop the subscription was first bought for (`originalTransactionId` → shop),
 * never the shop of whoever restores it.
 *
 * THE HTTP ANSWER IS APPLE'S RETRY CONTRACT (as in notifications.server.ts): 200 handled or deliberately ignored ·
 * 400 not Apple's / not ours · 500 our write failed, please retry.
 */

type Handled = { http: 200 | 400 | 500; what: string };

/** Apple's signature check. Injected only by the unit test (lib/iap/supplier-subscription.test.ts); production verifies. */
export type VerifyJws = (jws: string) => { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string };

const verifyWith =
  (trustedRoots: readonly string[]): VerifyJws =>
  (jws) =>
    verifyAppleJws<Record<string, unknown>>(jws, { trustedRootSha256: trustedRoots });

export type SupplierPlanFault = (message: string, snapshot: Record<string, unknown>) => Promise<unknown>;

const recordFault: SupplierPlanFault = (message, snapshot) =>
  insertFaultLog({
    event_type: 'OTHER',
    element_name: 'App Store supplier plan — needs a person',
    file_path: 'lib/iap/supplier-subscription.server.ts',
    error_message: message,
    payload_snapshot: snapshot,
  });

/** The shop a subscription belongs to — null when Apple has never told us of it, 'error' when the read failed. */
async function mappedShop(admin: SupabaseClient, originalTransactionId: string): Promise<string | null | 'error'> {
  const { data, error } = await admin
    .from('vendor_app_store_subscriptions')
    .select('vendor_profile_id')
    .eq('original_transaction_id', originalTransactionId)
    .maybeSingle();
  if (error) return 'error';
  return (data as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
}

export type ApplyOutcome =
  | { status: 'on' | 'already' | 'stale'; vendorId: string }
  | { status: 'refused'; reason: string; vendorId: string | null }
  | { status: 'error'; where: string };

/**
 * A paid period → the plan. `callerShops` = the shops the signed-in person manages (the app's confirm); null = Apple
 * is the caller (a notification). With a caller, a subscription already mapped to ANOTHER shop is refused — a restore
 * on a second shop never grants it — and an unmapped one must name one of the caller's own shops.
 */
export async function applySupplierPlanPeriod(
  admin: SupabaseClient,
  tx: AppleSubscriptionTransaction,
  notification: string,
  callerShops: readonly string[] | null,
  fault: SupplierPlanFault = recordFault,
): Promise<ApplyOutcome> {
  const mapped = await mappedShop(admin, tx.originalTransactionId);
  if (mapped === 'error') return { status: 'error', where: 'map_read' };
  if (callerShops) {
    if (mapped && !callerShops.includes(mapped)) return { status: 'refused', reason: 'other_shop', vendorId: mapped };
    if (!mapped && (!tx.appAccountToken || !callerShops.includes(tx.appAccountToken))) {
      return { status: 'refused', reason: 'not_yours', vendorId: null };
    }
  }
  const vendorId = mapped ?? tx.appAccountToken;
  if (!vendorId) return { status: 'refused', reason: 'no_token', vendorId: null };
  if (mapped && tx.appAccountToken && tx.appAccountToken !== mapped) {
    // The same Apple ID changed plans from another shop's door: Apple bills ONE subscription, so the plan follows it.
    await fault(`An App Store plan change for ${tx.originalTransactionId} came from another shop's door; it stays on its own shop.`, {
      originalTransactionId: tx.originalTransactionId,
      transactionId: tx.transactionId,
      mappedShop: mapped,
    });
  }

  const { data, error } = await admin.rpc('app_store_supplier_plan_apply', {
    p_vendor_id: vendorId,
    p_original_tx: tx.originalTransactionId,
    p_tx_id: tx.transactionId,
    p_product_id: tx.product.productId,
    p_tier: tx.product.tier,
    p_sku_code: supplierPlanSkuCode(tx.product.tier),
    p_purchase_at: tx.purchaseDate?.toISOString() ?? null,
    p_expires_at: tx.expiresDate.toISOString(),
    p_amount_php: chargedPhp(tx),
    p_environment: tx.environment,
    p_notification: notification,
  });
  if (error) return { status: 'error', where: 'apply' };
  const out = (data ?? {}) as { on?: boolean; already?: boolean; stale?: boolean; refused?: string; vendor_id?: string };
  if (out.refused) {
    // Apple has charged and we granted nothing: a person must see it (refund, or move the shop's billing).
    if (!callerShops || out.refused !== 'other_shop') {
      await fault(`App Store charged for ${tx.product.name} (${tx.transactionId}) but no plan was granted: ${out.refused}.`, {
        originalTransactionId: tx.originalTransactionId,
        transactionId: tx.transactionId,
        vendorId,
        refused: out.refused,
      });
    }
    return { status: 'refused', reason: out.refused, vendorId: out.vendor_id ?? null };
  }
  if (out.on) return { status: 'on', vendorId };
  if (out.already) return { status: 'already', vendorId };
  if (out.stale) return { status: 'stale', vendorId };
  return { status: 'error', where: 'apply_answer' };
}

function verifyRenewal(jws: string | null, verify: VerifyJws) {
  if (!jws) return readAppleRenewalInfo(null);
  const v = verify(jws);
  return readAppleRenewalInfo(v.ok ? v.payload : null);
}

/**
 * One App Store Server Notification → the supplier plan it concerns. Answers null when it is not about a supplier
 * plan (a consumable's REFUND keeps its own path in notifications.server.ts).
 */
export async function handleSupplierPlanNotification(
  admin: SupabaseClient,
  outerPayload: Record<string, unknown>,
  trustedRoots: readonly string[] = PRODUCTION_TRUSTED_ROOTS,
  fault: SupplierPlanFault = recordFault,
  verify: VerifyJws = verifyWith(trustedRoots),
): Promise<Handled | null> {
  const n = readSubscriptionNotificationParts(outerPayload);
  if (!n) return null;
  const onlySubscriptions = SUBSCRIPTION_NOTIFICATION_TYPES.has(n.notificationType);
  const shared = n.notificationType === 'REFUND' || n.notificationType === 'REFUND_REVERSED';
  if (!onlySubscriptions && !shared) return null;

  if (!n.signedTransactionInfo) return onlySubscriptions ? { http: 400, what: 'no transaction' } : null;
  const inner = verify(n.signedTransactionInfo);
  if (!inner.ok) return onlySubscriptions ? { http: 400, what: `transaction refused: ${inner.reason}` } : null;
  if (!isSupplierPlanPayload(inner.payload)) {
    return onlySubscriptions ? { http: 200, what: `ignored ${n.notificationType}: not a supplier plan` } : null;
  }
  const read = readAppleSubscriptionTransaction(inner.payload);
  // FAMILY_SHARED, another app, a malformed copy: never a plan, and nothing a retry could change.
  if (!read.ok) return { http: 200, what: `supplier plan refused: ${read.reason}` };
  const tx = read.tx;

  const decision = decideSupplierPlanNotification(n, tx, verifyRenewal(n.signedRenewalInfo, verify));
  switch (decision.kind) {
    case 'apply': {
      const o = await applySupplierPlanPeriod(admin, tx, n.notificationType, null, fault);
      if (o.status === 'error') return { http: 500, what: `supplier plan error at ${o.where}` };
      return { http: 200, what: o.status === 'refused' ? `supplier plan refused: ${o.reason}` : `supplier plan ${o.status}` };
    }
    case 'note': {
      const { data, error } = await admin.rpc('app_store_supplier_plan_note', {
        p_original_tx: tx.originalTransactionId,
        p_status: decision.status,
        p_billing_failed_at: decision.failedAt?.toISOString() ?? null,
        p_grace_expires_at: decision.graceExpiresAt?.toISOString() ?? null,
        p_auto_renew: decision.autoRenew,
        p_auto_renew_product_id: decision.autoRenewProductId,
        p_notification: n.subtype ? `${n.notificationType}/${n.subtype}` : n.notificationType,
      });
      if (error) return { http: 500, what: 'supplier plan note failed' };
      // Apple told us of a subscription we never saw begin (its SUBSCRIBED was lost): ask Apple to send it again.
      if ((data as { unknown?: boolean } | null)?.unknown) return { http: 500, what: 'supplier plan not yet known' };
      return { http: 200, what: `supplier plan noted ${n.notificationType}` };
    }
    case 'end': {
      const { data, error } = await admin.rpc('app_store_supplier_plan_end', {
        p_original_tx: tx.originalTransactionId,
        p_status: decision.status,
        p_tx_id: decision.transactionId,
        p_notification: n.subtype ? `${n.notificationType}/${n.subtype}` : n.notificationType,
      });
      if (error) return { http: 500, what: 'supplier plan end failed' };
      const out = (data ?? {}) as { unknown?: boolean; dropped?: boolean };
      if (out.unknown) return { http: 200, what: `supplier plan ${decision.status}: never granted` };
      return { http: 200, what: `supplier plan ${decision.status}${out.dropped ? ', dropped' : ''}` };
    }
    case 'record':
      await fault(`Apple reversed the refund of supplier plan ${tx.transactionId} (${tx.product.name}). The plan stays off until an admin restores it.`, {
        originalTransactionId: tx.originalTransactionId,
        transactionId: tx.transactionId,
      });
      return { http: 200, what: 'supplier plan REFUND_REVERSED recorded' };
    default:
      return { http: 200, what: `ignored ${decision.what}` };
  }
}

/**
 * The app's confirm for a supplier plan (folded into `confirmAppStorePurchase`). Null = the JWS is not a supplier plan
 * (the consumable path takes it). `callerShops` are the shops the signed-in person manages.
 */
export async function confirmSupplierPlanJws(
  admin: SupabaseClient,
  jws: string,
  /** Read only once the JWS is proved a supplier plan, so a consumable's confirm never pays for it. */
  callerShops: () => Promise<readonly string[]>,
  trustedRoots: readonly string[] = PRODUCTION_TRUSTED_ROOTS,
  fault: SupplierPlanFault = recordFault,
  verify: VerifyJws = verifyWith(trustedRoots),
): Promise<{ result: IapConfirmResult; vendorId: string | null } | null> {
  const v = verify(jws);
  if (!v.ok || !isSupplierPlanPayload(v.payload)) return null;
  const read = readAppleSubscriptionTransaction(v.payload);
  if (!read.ok) return { result: { status: 'refused', reason: read.reason }, vendorId: null };
  const o = await applySupplierPlanPeriod(admin, read.tx, 'APP_CONFIRM', await callerShops(), fault);
  switch (o.status) {
    case 'on':
    case 'already':
      // No event: a plan is the SHOP's (the same shape as a shop's gift, `vendorProfileId`).
      return {
        result: { status: 'on', eventId: null, vendorProfileId: o.vendorId, serviceKey: supplierPlanSkuCode(read.tx.product.tier) },
        vendorId: o.vendorId,
      };
    case 'stale':
      return { result: { status: 'refused', reason: 'plan_ended' }, vendorId: o.vendorId };
    case 'refused':
      return { result: { status: 'refused', reason: o.reason }, vendorId: o.vendorId };
    default:
      return { result: { status: 'pending' }, vendorId: null };
  }
}

/** What the app's plan door shows about a shop's Apple subscription — or that it could not be read. */
export type AppleShopPlanRead =
  | {
      status: 'ok';
      /** Who bills the live plan: one channel at a time. */
      channel: 'app_store' | 'web' | null;
      apple: {
        productId: string;
        status: 'active' | 'billing_retry' | 'expired' | 'refunded' | 'revoked';
        expiresAt: string | null;
        autoRenew: boolean | null;
        autoRenewProductId: string | null;
        /** THE GRACE HOOK — the first failed renewal, for the earned-grace rule (another PR) to read. */
        billingFailedAt: string | null;
      } | null;
    }
  | { status: 'unread' };

/** Service role, for a shop the caller already proved they manage. Never a guess: a failed read is `unread`. */
export async function readAppleShopPlan(admin: SupabaseClient, vendorId: string): Promise<AppleShopPlanRead> {
  try {
    const [channel, sub] = await Promise.all([
      admin.rpc('vendor_plan_billing_channel', { p_vendor_id: vendorId }),
      admin
        .from('vendor_app_store_subscriptions')
        .select('product_id, status, expires_at, auto_renew, auto_renew_product_id, billing_failed_at')
        .eq('vendor_profile_id', vendorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (channel.error || sub.error) return { status: 'unread' };
    const c = channel.data;
    const row = sub.data as {
      product_id: string;
      status: 'active' | 'billing_retry' | 'expired' | 'refunded' | 'revoked';
      expires_at: string | null;
      auto_renew: boolean | null;
      auto_renew_product_id: string | null;
      billing_failed_at: string | null;
    } | null;
    return {
      status: 'ok',
      channel: c === 'app_store' || c === 'web' ? c : null,
      apple: row
        ? {
            productId: row.product_id,
            status: row.status,
            expiresAt: row.expires_at,
            autoRenew: row.auto_renew,
            autoRenewProductId: row.auto_renew_product_id,
            billingFailedAt: row.billing_failed_at,
          }
        : null,
    };
  } catch {
    return { status: 'unread' };
  }
}
