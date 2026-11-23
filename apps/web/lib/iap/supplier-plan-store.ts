'use client';

/**
 * 🏪 BUY A SUPPLIER PLAN WITH APPLE — the web half, in the iPhone app only (owner-locked 22 Nov 2026).
 *
 * Same order as every Apple purchase (lib/iap/native-store.ts), minus the intent step:
 *   1 · Apple's sheet, with the SHOP as the appAccountToken    (plugin.purchase)
 *   2 · our server verifies Apple's signed transaction and
 *       switches the plan on for that shop                     (confirmAppStorePurchase → supplier plan path)
 *   3 · ONLY THEN the phone finishes the transaction            (plugin.finish)
 *
 * No intent row: the token IS the shop (one subscription = one shop), the server reads the caller's own shop from the
 * session and refuses any other, and App Store Server Notifications grant the same period if the phone dies at 2.
 * Every check the web makes before a plan purchase was made when the door was drawn (manager · verified · one channel).
 */

import { callNativeStore, nativeStoreAvailable } from './native-store';
import { confirmAppStorePurchase } from './iap-actions';
import type { IapConfirmResult, IapScreen } from './iap-outcome';
import { supplierPlanRefusedLine } from './supplier-plans';

type PurchaseAnswer = { result?: string; jws?: string; transactionId?: string };

export async function buySupplierPlanWithApple(input: { productId: string; shopToken: string }): Promise<IapScreen> {
  if (!nativeStoreAvailable()) return { kind: 'refused', message: 'This is not available in the app right now.' };

  let answer: PurchaseAnswer;
  try {
    answer = await callNativeStore<PurchaseAnswer>('purchase', { productId: input.productId, appAccountToken: input.shopToken });
  } catch {
    return { kind: 'failed' };
  }
  const r = answer?.result;
  if (r === 'cancelled') return { kind: 'cancelled' };
  if (r === 'pending') return { kind: 'pending', askToBuy: true };
  if (r !== 'purchased') return { kind: 'failed' };
  // Apple charged but handed us nothing to verify: it stays unfinished and Apple re-delivers it.
  if (typeof answer.jws !== 'string') return { kind: 'pending', askToBuy: false };

  let server: IapConfirmResult | null = null;
  try {
    server = await confirmAppStorePurchase({ jws: answer.jws });
  } catch {
    server = null;
  }
  if (server && (server.status === 'on' || server.status === 'refunded') && answer.transactionId) {
    await callNativeStore('finish', { transactionId: answer.transactionId }).catch(() => undefined);
  }
  if (!server || server.status === 'pending' || server.status === 'invalid') return { kind: 'pending', askToBuy: false };
  if (server.status === 'on') return { kind: 'on' };
  if (server.status === 'refunded') return { kind: 'refused', message: 'Apple has refunded this plan, so it is not on your shop.' };
  return { kind: 'refused', message: supplierPlanRefusedLine(server.reason) };
}
