import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAppleJws } from './apple-jws';
import {
  APP_BUNDLE_ID,
  PRODUCTION_TRUSTED_ROOTS,
  readAppleNotification,
  verifyAppleTransaction,
} from './apple-transaction';
import { fulfilAppleTransaction, revokeAppleTransaction } from './fulfil.server';
import { insertFaultLog } from '@/lib/telemetry/fault-log';

/**
 * 🍎 APP STORE SERVER NOTIFICATIONS v2 — Apple telling us, with no session.
 *
 * The app's own confirm is the fast path; this is the net under it. If the app
 * closed between Apple's sheet and our confirm, `ONE_TIME_CHARGE` still lands
 * the purchase on the event (the intent's token names it). `REFUND` takes it
 * back. Both run the same code the app's confirm runs (lib/iap/fulfil.server.ts).
 *
 * THE HTTP ANSWER IS THE RETRY CONTRACT. Apple re-sends a notification that did
 * not get a 2xx (up to five times over days). So:
 *   200 — handled, or deliberately ignored (a type we do not act on, TEST);
 *   400 — not Apple's signature / not our app: retrying cannot help;
 *   500 — a read or write failed on OUR side: retry, please.
 *
 * Ignored on purpose, and named: `REFUND_REVERSED` is recorded for an admin to
 * re-approve by hand (re-running activation automatically on a reversal is the
 * re-grant the promotion rule forbids); `CONSUMPTION_REQUEST` (Apple asking how
 * much of a consumable was used before deciding a refund) is not answered —
 * answering needs the App Store Server API key, which this build does not use.
 */
export async function handleAppStoreNotification(
  admin: SupabaseClient,
  signedPayload: unknown,
  trustedRoots: readonly string[] = PRODUCTION_TRUSTED_ROOTS,
): Promise<{ http: 200 | 400 | 500; what: string }> {
  if (typeof signedPayload !== 'string') return { http: 400, what: 'no signedPayload' };
  const outer = verifyAppleJws<Record<string, unknown>>(signedPayload, { trustedRootSha256: trustedRoots });
  if (!outer.ok) return { http: 400, what: `refused: ${outer.reason}` };
  const n = readAppleNotification(outer.payload);
  if (!n) return { http: 400, what: 'not a notification' };
  if (n.bundleId && n.bundleId !== APP_BUNDLE_ID) return { http: 400, what: 'another app' };

  if (n.notificationType === 'TEST') return { http: 200, what: 'TEST' };
  if (n.notificationType !== 'ONE_TIME_CHARGE' && n.notificationType !== 'REFUND' && n.notificationType !== 'REFUND_REVERSED') {
    return { http: 200, what: `ignored ${n.notificationType}` };
  }
  if (!n.signedTransactionInfo) return { http: 400, what: 'no transaction' };
  const inner = verifyAppleTransaction(n.signedTransactionInfo, trustedRoots);
  if (!inner.ok) {
    // A product we do not sell (e.g. a future product before this build knows
    // it) is not a fault worth a retry storm.
    return { http: inner.reason === 'unknown_product' ? 200 : 400, what: `transaction refused: ${inner.reason}` };
  }

  if (n.notificationType === 'ONE_TIME_CHARGE') {
    const o = await fulfilAppleTransaction(admin, inner.tx);
    if (o.status === 'error') return { http: 500, what: `fulfil error at ${o.where}` };
    return { http: 200, what: `fulfil ${o.status}` };
  }

  if (n.notificationType === 'REFUND') {
    const r = await revokeAppleTransaction(admin, inner.tx, 'REFUND');
    if (r.status === 'error') return { http: 500, what: `revoke error at ${r.where}` };
    return { http: 200, what: `revoke ${r.status}` };
  }

  // REFUND_REVERSED — recorded for a person; never re-granted automatically.
  await insertFaultLog({
    event_type: 'OTHER',
    element_name: 'App Store refund reversed — re-approve by hand',
    file_path: 'lib/iap/notifications.server.ts',
    error_message: `Apple reversed the refund of ${inner.tx.transactionId} (${inner.tx.product.productId}). The order stays refunded until an admin re-approves it.`,
    payload_snapshot: { transactionId: inner.tx.transactionId, productId: inner.tx.product.productId },
  });
  return { http: 200, what: 'REFUND_REVERSED recorded' };
}
