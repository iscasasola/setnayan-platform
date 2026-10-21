import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { PROMOTABLE_ORDER_STATUSES } from '@/lib/order-promotion-rule';
import { appendLedger } from '@/lib/ledger';
import { activateOrderSku, deactivateOrderSku } from '@/lib/sku-activation';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { formatPhp } from '@/lib/php';
import { APP_STORE_CHANNEL_KEY, appStorePriceFloorPhp, type IapProduct } from './products';
import { chargedPhp, type AppleTransaction } from './apple-transaction';

/**
 * 🍎 APPLE SAID YES → THE SAME ORDER, THE SAME ACTIVATION.
 *
 * Owner, 2026-10-18: an App Store purchase becomes an `orders` row (platform
 * 'ios') and is switched on by the SAME activation path as a web payment
 * (prototype `in_app_purchase_screens_2026-10-17_fable.html`, "Under the
 * sheet"). Nothing here grants a feature on its own; it writes the rows the
 * web's admin approval writes, in the same order, through the same helpers:
 *
 *   1 · `orderRowFor` — status 'submitted', identity stamped from the INTENT
 *       row (user + event that passed the membership check before Apple's sheet
 *       opened), never from the transaction or the request;
 *   2 · `paymentRowFor` — channel 'app_store', reference = Apple's transaction
 *       id, amount = what Apple charged;
 *   3 · the payment pending → matched, and the order → paid under
 *       `PROMOTABLE_ORDER_STATUSES` with `.select()` (a zero-row UPDATE is
 *       success-shaped) — the two transitions `approvePaymentCore` makes;
 *   4 · `activateOrderSku`, ONLY by the call whose promote changed the row —
 *       "promoting a settled order would re-run activation and re-grant what it
 *       already gave" (lib/order-promotion-rule.ts).
 *
 * ⚖ WHY NOT `approvePaymentCore` ITSELF. It is the admin's door: it needs an
 * admin session (`sessionClient`, `reviewed_by_user_id`), issues OUR receipt,
 * reconciles a bank transfer against a shortfall, and schedules supplier
 * payouts. Apple is the merchant of record for an In-App Purchase — Apple sends
 * the receipt ("Your receipt comes from Apple", prototype frame 6), Apple
 * charged exactly the product's price, and no supplier is paid. So this takes
 * the two state transitions and the activation, and leaves the rest.
 *
 * IDEMPOTENT ON APPLE'S TRANSACTION ID, three ways: the intent row's
 * `transaction_id` is UNIQUE; the order's `reference_code` is `IOS-<id>` and
 * UNIQUE; the payment carries `client_idempotency_key = 'app_store'`, UNIQUE per
 * order. The app and App Store Server Notifications may deliver the same
 * transaction at once, and Restore delivers it again: every repeat finds the
 * same order and reports what is true.
 */

export type FulfilOutcome =
  | { status: 'on'; orderId: string; eventId: string; serviceKey: string; activatedNow: boolean }
  | { status: 'refunded' }
  | {
      status: 'refused';
      reason: 'unknown_token' | 'not_yours' | 'token_reused' | 'product_mismatch' | 'no_event';
    }
  /** A read or write failed — nothing is lost: Apple re-delivers, and Restore re-asks. */
  | { status: 'error'; where: string };

type IntentRow = {
  app_account_token: string;
  user_id: string;
  event_id: string | null;
  product_id: string;
  service_key: string;
  transaction_id: string | null;
  order_id: string | null;
};

const INTENT_COLS =
  'app_account_token, user_id, event_id, product_id, service_key, transaction_id, order_id';

/** The order's unique reference — one Apple transaction, one order. */
export function appStoreReferenceCode(transactionId: string): string {
  return `IOS-${transactionId}`;
}

/** The payment's `channel` and the order's `payment_method_key`. */
export const APP_STORE_CHANNEL = APP_STORE_CHANNEL_KEY;

/** Create the intent row whose key Apple signs into the purchase (`appAccountToken`). */
export async function createPurchaseIntent(
  admin: SupabaseClient,
  input: { userId: string; eventId: string; product: IapProduct },
): Promise<{ ok: true; token: string } | { ok: false }> {
  const { data, error } = await admin
    .from('app_store_purchases')
    .insert({
      user_id: input.userId,
      event_id: input.eventId,
      product_id: input.product.productId,
      service_key: input.product.serviceKey,
    })
    .select('app_account_token')
    .maybeSingle();
  const token = (data as { app_account_token?: string } | null)?.app_account_token;
  if (error || !token) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'App Store purchase — create intent',
      file_path: 'lib/iap/fulfil.server.ts',
      error_message: error?.message ?? 'no row returned',
      payload_snapshot: { productId: input.product.productId, eventId: input.eventId },
    });
    return { ok: false };
  }
  return { ok: true, token };
}

async function readIntent(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; row: IntentRow | null } | { ok: false }> {
  const { data, error } = await admin
    .from('app_store_purchases')
    .select(INTENT_COLS)
    .eq('app_account_token', token)
    .maybeSingle();
  if (error) {
    // Apple re-delivers; the caller answers "switching it on" — but the reason is logged.
    console.error('[iap] could not read the purchase intent:', error.message);
    return { ok: false };
  }
  return { ok: true, row: (data as IntentRow | null) ?? null };
}

/** What the order records as charged: Apple's PHP figure, else the catalogue's (non-PHP storefront). */
async function orderAmountPhp(
  admin: SupabaseClient,
  tx: AppleTransaction,
): Promise<{ ok: true; amount: number; note: string | null; catalogPhp: number | null } | { ok: false }> {
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('retail_price_php')
    .eq('service_code', tx.product.serviceKey)
    .maybeSingle();
  if (error) console.error('[iap] could not read the catalogue price (Apple’s PHP figure is used when present):', error.message);
  const raw = (data as { retail_price_php?: number | string | null } | null)?.retail_price_php;
  const catalogPhp = raw === null || raw === undefined || error ? null : Number(raw);
  const php = chargedPhp(tx);
  if (php !== null) return { ok: true, amount: php, note: null, catalogPhp };
  // Not charged in pesos (another storefront): we do not invent an exchange
  // rate. The order records the catalogue's peso figure and says, in words,
  // what Apple actually charged.
  if (catalogPhp === null || !Number.isFinite(catalogPhp)) return { ok: false };
  const charged =
    tx.priceMilliunits !== null && tx.currency ? `${tx.currency} ${(tx.priceMilliunits / 1000).toFixed(2)}` : 'an amount Apple did not state';
  return {
    ok: true,
    amount: catalogPhp,
    note: `Charged by Apple in ${charged}; the peso figure is the catalogue's.`,
    catalogPhp,
  };
}

/**
 * Turn ONE verified Apple transaction into a paid, activated order.
 *
 * @param expectUserId set when a signed-in person handed us the transaction
 *   (confirm / Restore): it must be THEIR intent. Unset for App Store Server
 *   Notifications, which carry no session — the token alone names the buyer.
 */
export async function fulfilAppleTransaction(
  admin: SupabaseClient,
  tx: AppleTransaction,
  opts: { expectUserId?: string } = {},
): Promise<FulfilOutcome> {
  // A transaction Apple has already revoked never grants anything.
  if (tx.revocationDate) {
    await revokeAppleTransaction(admin, tx, 'REVOKED_ON_ARRIVAL');
    return { status: 'refunded' };
  }

  const intent = await readIntent(admin, tx.appAccountToken);
  if (!intent.ok) return { status: 'error', where: 'read_intent' };
  const row = intent.row;
  if (!row) {
    // A genuine Apple purchase we have no intent for. Money moved; say so loudly.
    await insertFaultLog({
      event_type: 'OTHER',
      element_name: 'App Store purchase — no intent for this token',
      file_path: 'lib/iap/fulfil.server.ts',
      error_message: `transaction ${tx.transactionId} (${tx.product.productId}, ${tx.environment}) carries a token we never issued`,
      payload_snapshot: { transactionId: tx.transactionId, productId: tx.product.productId },
    });
    return { status: 'refused', reason: 'unknown_token' };
  }
  if (opts.expectUserId && row.user_id !== opts.expectUserId) return { status: 'refused', reason: 'not_yours' };
  if (row.product_id !== tx.product.productId) return { status: 'refused', reason: 'product_mismatch' };
  if (row.transaction_id && row.transaction_id !== tx.transactionId) return { status: 'refused', reason: 'token_reused' };
  if (!row.event_id) {
    await insertFaultLog({
      event_type: 'OTHER',
      element_name: 'App Store purchase — the event is gone',
      file_path: 'lib/iap/fulfil.server.ts',
      error_message: `transaction ${tx.transactionId} was bought for an event that no longer exists`,
      payload_snapshot: { transactionId: tx.transactionId, token: tx.appAccountToken },
    });
    return { status: 'refused', reason: 'no_event' };
  }
  const eventId = row.event_id;

  // 1 · Stamp what Apple said onto the intent (first writer wins; a repeat is a no-op).
  if (!row.transaction_id) {
    const { error } = await admin
      .from('app_store_purchases')
      .update({
        transaction_id: tx.transactionId,
        original_transaction_id: tx.originalTransactionId,
        environment: tx.environment,
        price_milliunits: tx.priceMilliunits,
        currency: tx.currency,
        purchased_at: tx.purchaseDate?.toISOString() ?? null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('app_account_token', row.app_account_token)
      .is('transaction_id', null);
    if (error && error.code !== '23505') return { status: 'error', where: 'stamp_intent' };
    if (error) return { status: 'refused', reason: 'token_reused' };
  }

  // 2 · The order — unique by reference, so a racing second delivery lands on the same row.
  const referenceCode = appStoreReferenceCode(tx.transactionId);
  const amount = await orderAmountPhp(admin, tx);
  if (!amount.ok) return { status: 'error', where: 'price' };

  type OrderRow = { order_id: string; status: string };
  let order: OrderRow | null = null;
  let mintedNow = false;
  {
    const { data, error } = await admin
      .from('orders')
      .insert(
        orderRowFor(
          // Identity from the INTENT row — the user and event the membership
          // check covered before Apple's sheet opened (startAppStorePurchase).
          { userId: row.user_id, eventId, vendorProfileId: null },
          {
            service_key: tx.product.serviceKey,
            description: `${tx.product.appStoreName} · App Store`,
            requested_total_php: amount.amount,
            reference_code: referenceCode,
            platform: 'ios',
            payment_method_key: APP_STORE_CHANNEL,
            status: 'submitted',
          },
        ),
      )
      .select('order_id, status')
      .maybeSingle();
    if (data) {
      order = data as OrderRow;
      mintedNow = true;
    } else if (error && error.code !== '23505') {
      return { status: 'error', where: 'mint_order' };
    }
  }
  if (!order) {
    const { data, error } = await admin
      .from('orders')
      .select('order_id, status')
      .eq('reference_code', referenceCode)
      .maybeSingle();
    if (error || !data) return { status: 'error', where: 'read_order' };
    order = data as OrderRow;
  }

  if (mintedNow) {
    await appendLedger(admin, {
      order_id: order.order_id,
      event_type: 'order_created',
      actor_user_id: row.user_id,
      actor_role: 'system',
      amount_centavos: Math.round(amount.amount * 100),
      metadata: {
        service_key: tx.product.serviceKey,
        channel: APP_STORE_CHANNEL,
        apple_transaction_id: tx.transactionId,
        apple_environment: tx.environment,
      },
    });
  }

  if (order.status === 'refunded' || order.status === 'cancelled' || order.status === 'lapsed') {
    return { status: 'refunded' };
  }

  let activatedNow = false;
  if (order.status !== 'paid' && order.status !== 'fulfilled') {
    // 3a · The payment — one per order (client_idempotency_key UNIQUE per order).
    if (amount.amount > 0) {
      const { error: payErr } = await admin.from('payments').insert({
        ...paymentRowFor(
          { userId: row.user_id, verifiedOrderId: order.order_id },
          {
            amount_php: amount.amount,
            channel: APP_STORE_CHANNEL,
            reference_number: tx.transactionId,
            paid_at: (tx.purchaseDate ?? new Date()).toISOString().slice(0, 10),
          },
        ),
        client_idempotency_key: APP_STORE_CHANNEL,
      });
      if (payErr && payErr.code !== '23505') return { status: 'error', where: 'log_payment' };

      const verifiedNote =
        tx.environment === 'Sandbox'
          ? 'Verified by Apple — App Store SANDBOX: a test purchase, no money moved.'
          : 'Verified by Apple — App Store.';
      const { error: matchErr } = await admin
        .from('payments')
        .update({
          status: 'matched',
          admin_notes: amount.note ? `${verifiedNote} ${amount.note}` : verifiedNote,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', order.order_id)
        .eq('client_idempotency_key', APP_STORE_CHANNEL)
        .eq('status', 'pending');
      if (matchErr) return { status: 'error', where: 'match_payment' };
    }

    // 3b · Promote — the database is the arbiter; only the call that changed the row activates.
    const { data: promoted, error: promoteErr } = await admin
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('order_id', order.order_id)
      .in('status', PROMOTABLE_ORDER_STATUSES)
      .select('order_id');
    if (promoteErr) return { status: 'error', where: 'promote_order' };
    if ((promoted ?? []).length === 1) {
      await appendLedger(admin, {
        order_id: order.order_id,
        event_type: 'payment_approved',
        actor_user_id: row.user_id,
        actor_role: 'system',
        amount_centavos: Math.round(amount.amount * 100),
        metadata: {
          service_key: tx.product.serviceKey,
          channel: APP_STORE_CHANNEL,
          apple_transaction_id: tx.transactionId,
          apple_environment: tx.environment,
        },
      });
      // 4 · The SAME activation path the web's admin approval runs. Non-fatal by contract.
      await activateOrderSku({
        admin,
        orderId: order.order_id,
        eventId,
        serviceKey: tx.product.serviceKey,
        actorUserId: row.user_id,
      });
      activatedNow = true;
    } else {
      // Lost the race to the other delivery, or the status moved: read what is true.
      const { data: now } = await admin.from('orders').select('status').eq('order_id', order.order_id).maybeSingle();
      const s = (now as { status?: string } | null)?.status;
      if (s !== 'paid' && s !== 'fulfilled') return s === 'refunded' ? { status: 'refunded' } : { status: 'error', where: 'promote_lost' };
    }
  }

  // 5 · Link the intent to its order (idempotent).
  if (row.order_id !== order.order_id) {
    const { error: linkErr } = await admin
      .from('app_store_purchases')
      .update({ order_id: order.order_id, updated_at: new Date().toISOString() })
      .eq('app_account_token', row.app_account_token);
    // Not fatal — the order is paid and keyed by `IOS-<transaction>`, which the
    // refund path also falls back to — but never silent.
    if (linkErr) console.error('[iap] could not link the purchase intent to its order:', linkErr.message);
  }

  // 💰 The owner's floor (ruling 4): an App Store price below web ÷ 0.85 is a
  // mis-set price point in App Store Connect. The customer paid — they keep
  // what they bought — and the owner is told.
  if (activatedNow && tx.currency === 'PHP') {
    const floor = appStorePriceFloorPhp(amount.catalogPhp);
    const php = chargedPhp(tx);
    if (floor !== null && php !== null && php < floor) {
      await insertFaultLog({
        event_type: 'OTHER',
        element_name: 'App Store price below the ÷0.85 floor',
        file_path: 'lib/iap/fulfil.server.ts',
        error_message: `${tx.product.productId} sold for ${formatPhp(php)} — the floor is ${formatPhp(floor)} (web ${formatPhp(amount.catalogPhp ?? 0)} ÷ 0.85). Raise its price point in App Store Connect.`,
        payload_snapshot: { productId: tx.product.productId, chargedPhp: php, floorPhp: floor },
      });
    }
  }

  return { status: 'on', orderId: order.order_id, eventId, serviceKey: tx.product.serviceKey, activatedNow };
}

/**
 * Apple refunded (or revoked) a transaction — App Store Server Notifications
 * v2 `REFUND`. The order leaves `paid` (`RELINQUISHED_STATUSES` then stops
 * counting it) and `deactivateOrderSku` takes back what activation granted
 * (Papic credits; Pro and Live Watch read ownership off the order and re-lock
 * by themselves). Idempotent: a second REFUND finds the order already refunded.
 *
 * No `order_refunds` row: that table records a refund an ADMIN sent
 * (`refunded_by_admin_id` NOT NULL). Apple sent this one; the intent row
 * (`revoked_at`, `revocation_reason`) and the ledger are its record.
 */
export async function revokeAppleTransaction(
  admin: SupabaseClient,
  tx: AppleTransaction,
  notificationType: string,
): Promise<{ status: 'revoked' | 'already' | 'unknown' } | { status: 'error'; where: string }> {
  const { data, error } = await admin
    .from('app_store_purchases')
    .select(INTENT_COLS)
    .eq('app_account_token', tx.appAccountToken)
    .maybeSingle();
  if (error) return { status: 'error', where: 'read_intent' };
  const row = data as IntentRow | null;
  if (!row || (row.transaction_id && row.transaction_id !== tx.transactionId)) return { status: 'unknown' };

  const { error: stampErr } = await admin
    .from('app_store_purchases')
    .update({
      transaction_id: tx.transactionId,
      revoked_at: (tx.revocationDate ?? new Date()).toISOString(),
      revocation_reason: tx.revocationReason,
      last_notification_type: notificationType.slice(0, 64),
      updated_at: new Date().toISOString(),
    })
    .eq('app_account_token', row.app_account_token);
  if (stampErr) return { status: 'error', where: 'stamp_revocation' };

  // The order may exist even if the intent was never linked (a crash between steps).
  let orderId = row.order_id;
  if (!orderId) {
    const { data: o } = await admin
      .from('orders')
      .select('order_id')
      .eq('reference_code', appStoreReferenceCode(tx.transactionId))
      .maybeSingle();
    orderId = (o as { order_id?: string } | null)?.order_id ?? null;
  }
  if (!orderId) return { status: 'revoked' };

  const { data: flipped, error: flipErr } = await admin
    .from('orders')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .in('status', ['paid', 'fulfilled'])
    .select('order_id');
  if (flipErr) return { status: 'error', where: 'refund_order' };
  if ((flipped ?? []).length === 0) return { status: 'already' };

  // AFTER the flip, so the re-derive sees the refunded state (same order as applyRefund).
  await deactivateOrderSku({
    admin,
    orderId,
    eventId: row.event_id,
    serviceKey: row.service_key,
    actorUserId: row.user_id,
  });
  await appendLedger(admin, {
    order_id: orderId,
    event_type: 'order_refunded',
    // The buyer whose purchase Apple refunded — the actor is Apple ('system').
    actor_user_id: row.user_id,
    actor_role: 'system',
    amount_centavos: tx.currency === 'PHP' && tx.priceMilliunits !== null ? Math.round(tx.priceMilliunits / 10) : null,
    metadata: {
      service_key: row.service_key,
      channel: APP_STORE_CHANNEL,
      apple_transaction_id: tx.transactionId,
      notification_type: notificationType,
      revocation_reason: tx.revocationReason,
    },
  });
  return { status: 'revoked' };
}
