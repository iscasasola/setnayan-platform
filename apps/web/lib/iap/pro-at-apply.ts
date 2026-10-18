'use client';

/**
 * 🍎 EVENT HUB PRO AT ✓ APPLY, THROUGH APPLE — the kit the Maker's draft bar
 * loads LAZILY, only when the iPhone app may sell Pro and the Apply sheet opens
 * with Pro effects in it (owner 2026-10-18, ruling 2). The Maker's first load
 * never carries StoreKit code (scripts/check-maker-js-budget.mjs).
 */
import { iapProductForServiceKey } from './products';
import { loadAppStoreProducts, buyWithApple } from './native-store';
import { IAP_COPY, pendingLine, type IapScreen } from './iap-outcome';

const PRO = iapProductForServiceKey('COUPLE_WEBSITE_PRO');

/** The Apply sheet's fixed words for the Apple path (`ApplePro.copy`). */
export const APPLE_PRO_COPY = {
  cancelled: IAP_COPY.cancelled,
  failedLead: IAP_COPY.failedLead,
  failedNext: IAP_COPY.failedNext,
  pendingTitle: IAP_COPY.pendingTitle,
  pendingBody: pendingLine('Event Hub Pro', false),
  pendingRestore: IAP_COPY.pendingRestore,
  askToBuy: IAP_COPY.askToBuy,
  billedByApple: IAP_COPY.billedByApple,
  receipt: IAP_COPY.receipt,
  storeSilent: IAP_COPY.storeSilent,
} as const;

/** StoreKit's price for Event Hub Pro — never a figure of ours. */
export async function loadProPrice(): Promise<{ state: 'ready' | 'silent'; price: string | null }> {
  if (!PRO) return { state: 'silent', price: null };
  const map = await loadAppStoreProducts([PRO.productId]);
  const price = map?.get(PRO.productId)?.displayPrice ?? null;
  return price ? { state: 'ready', price } : { state: 'silent', price: null };
}

export async function buyProWithApple(eventId: string): Promise<IapScreen> {
  if (!PRO) return { kind: 'refused', message: 'This is not available in the app right now.' };
  return buyWithApple({ eventId, productId: PRO.productId });
}
