'use client';

/**
 * 🏪 BUY A SUPPLIER PLAN WITH APPLE — the web half, in the iPhone app only (owner-locked 22 Nov 2026).
 *
 * Same order as every Apple purchase (lib/iap/native-store.ts):
 *   1 · our server issues the purchase's token for the shop the
 *       signed-in person manages, and keeps that pairing             (startAppStorePurchase → plan start)
 *   2 · Apple's sheet, with that token as the appAccountToken       (plugin.purchase)
 *   3 · our server verifies Apple's signed transaction and
 *       switches the plan on for the paired shop                    (confirmAppStorePurchase → supplier plan path)
 *   4 · ONLY THEN the phone finishes the transaction                (plugin.finish)
 *
 * The phone never names the shop: the server reads it from the session and pairs it with the token, and App Store
 * Server Notifications grant the same period, to that pairing only, if the phone dies at 3.
 * Every check the web makes before a plan purchase was made when the door was drawn (manager · verified · one channel).
 */

import { callNativeStore, nativeStoreAvailable } from './native-store';
import { confirmAppStorePurchase, startAppStorePurchase } from './iap-actions';
import { screenFor, settled, type IapConfirmResult, type IapScreen, type IapStartResult } from './iap-outcome';
import { supplierPlanRefusedLine } from './supplier-plans';

type PurchaseAnswer = { result?: string; jws?: string; transactionId?: string };

export async function buySupplierPlanWithApple(input: { productId: string }): Promise<IapScreen> {
  if (!nativeStoreAvailable()) return { kind: 'refused', message: 'This is not available in the app right now.' };

  let started: IapStartResult;
  try {
    started = await startAppStorePurchase({ productId: input.productId });
  } catch {
    return { kind: 'failed' };
  }
  if (!started.ok) return { kind: 'refused', message: started.message };

  let answer: PurchaseAnswer;
  try {
    answer = await callNativeStore<PurchaseAnswer>('purchase', { productId: started.productId, appAccountToken: started.token });
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
  if (server && settled(server) && answer.transactionId) {
    await callNativeStore('finish', { transactionId: answer.transactionId }).catch(() => undefined);
  }
  if (!server || server.status === 'pending' || server.status === 'invalid') return { kind: 'pending', askToBuy: false };
  if (server.status === 'on') return { kind: 'on' };
  if (server.status === 'refunded') return { kind: 'refused', message: 'Apple has refunded this plan, so it is not on your shop.' };
  if (server.status === 'retired') return screenFor('purchased', server);
  return { kind: 'refused', message: supplierPlanRefusedLine(server.reason) };
}
