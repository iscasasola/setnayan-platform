'use client';

/**
 * 🍎 THE WEB HALF OF APPLE IN-APP PURCHASE — talks to the `SetnayanStore`
 * StoreKit 2 plugin (apps/mobile/ios/App/App/SetnayanStorePlugin.swift) and to
 * our server (lib/iap/iap-actions.ts), in that order and no other:
 *
 *   1 · our server writes the intent and returns its token  (start…)
 *   2 · Apple's sheet, with that token signed in            (plugin.purchase)
 *   3 · our server verifies Apple's signed transaction and
 *       switches the item on                                (confirm…)
 *   4 · ONLY THEN the phone finishes the transaction          (plugin.finish)
 *
 * Step 4 last is the safety net: an unfinished transaction is re-delivered by
 * Apple at every launch (`deliverPendingAppStoreTransactions`), so a phone that
 * dies between 2 and 3 still lands the purchase. App Store Server
 * Notifications land it too, server-side.
 *
 * Outside the iPhone app every function here answers "unavailable" and touches
 * nothing — `window.Capacitor` does not exist on the web.
 */

import { startAppStorePurchase, confirmAppStorePurchase, restoreAppStorePurchases } from './iap-actions';
import { screenFor, type IapConfirmResult, type IapScreen, type IapSheetResult, type IapRestoreResult } from './iap-outcome';
import { priceMatchesStorefront } from './storefront-price';

export const NATIVE_STORE_PLUGIN = 'SetnayanStore';

type ListenerHandle = { remove: () => void };
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>;
  Plugins?: Record<string, { addListener?: (e: string, cb: (d: unknown) => void) => ListenerHandle | Promise<ListenerHandle> } | undefined>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() && cap.getPlatform?.() === 'ios' && typeof cap.nativePromise === 'function'
    ? cap
    : null;
}

/** Is the StoreKit bridge here at all? (The iPhone app, a build with the plugin.) */
export function nativeStoreAvailable(): boolean {
  return capacitor() !== null;
}

function call<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const cap = capacitor();
  if (!cap?.nativePromise) return Promise.reject(new Error('unavailable'));
  return cap.nativePromise(NATIVE_STORE_PLUGIN, method, options) as Promise<T>;
}

export type AppStoreProduct = {
  id: string;
  displayName: string;
  /** StoreKit's own localized price string (`Product.displayPrice`) — the ONLY price the app shows. */
  displayPrice: string;
  /** The price's ISO 4217 code (`priceFormatStyle.currencyCode`) — builds after 1.0 (6) send it. */
  currencyCode?: string;
  /** StoreKit's current storefront, ISO 3166-1 alpha-3 (`Storefront.current.countryCode`) — the same builds. */
  storefront?: string;
};

/**
 * Apple's name and price for each product id — the ONLY price the app shows.
 * Null when StoreKit did not answer: the caller says so, it never falls back
 * to a figure of ours. A product whose price is not in its storefront's money
 * (`priceMatchesStorefront`) is left out: its button shows no price and waits.
 */
export async function loadAppStoreProducts(ids: readonly string[]): Promise<Map<string, AppStoreProduct> | null> {
  try {
    const r = await call<{ products?: AppStoreProduct[] }>('getProducts', { productIds: [...ids] });
    const map = new Map<string, AppStoreProduct>();
    for (const p of r?.products ?? []) {
      if (p && typeof p.id === 'string' && typeof p.displayPrice === 'string' && p.displayPrice.length > 0 && priceMatchesStorefront(p)) {
        map.set(p.id, p);
      }
    }
    return map;
  } catch {
    return null;
  }
}

type PurchaseAnswer = { result?: string; jws?: string; transactionId?: string };

/** Finish ONLY what our server has settled (on, or already refunded by Apple). */
function settled(server: IapConfirmResult): boolean {
  return server.status === 'on' || server.status === 'refunded';
}

/**
 * The whole purchase, start to finish. Resolves to the ONE screen the sheet
 * shows next — never throws, never shows Apple's raw error text.
 */
export async function buyWithApple(input: { eventId: string; productId: string }): Promise<IapScreen> {
  if (!nativeStoreAvailable()) return { kind: 'refused', message: 'This is not available in the app right now.' };

  let started: Awaited<ReturnType<typeof startAppStorePurchase>>;
  try {
    started = await startAppStorePurchase(input);
  } catch {
    return { kind: 'refused', message: 'We couldn’t start that. Nothing was charged — please try again.' };
  }
  if (!started.ok) return { kind: 'refused', message: started.message };

  let answer: PurchaseAnswer;
  try {
    answer = await call<PurchaseAnswer>('purchase', { productId: started.productId, appAccountToken: started.token });
  } catch {
    return screenFor('failed', null);
  }
  const r = answer?.result;
  const sheet: IapSheetResult = r === 'purchased' || r === 'cancelled' || r === 'pending' ? r : 'failed';
  if (sheet !== 'purchased') return screenFor(sheet, null);
  // Apple charged but handed us nothing to verify: it stays unfinished and
  // Apple re-delivers it — "switching it on", never "failed".
  const jws = answer?.jws;
  const transactionId = answer?.transactionId;
  if (typeof jws !== 'string') return screenFor('purchased', null);

  let server: IapConfirmResult | null = null;
  try {
    server = await confirmAppStorePurchase({ jws });
  } catch {
    server = null; // network: Apple re-delivers; the screen says "switching it on"
  }
  if (server && settled(server) && transactionId) {
    await call('finish', { transactionId }).catch(() => undefined);
  }
  return screenFor('purchased', server);
}

/**
 * Hand every transaction Apple completed but we have not finished to our
 * server — on launch, and whenever StoreKit reports one. Resolves to how many
 * were switched on now.
 */
export async function deliverPendingAppStoreTransactions(): Promise<number> {
  if (!nativeStoreAvailable()) return 0;
  let list: Array<{ jws?: string; transactionId?: string }> = [];
  try {
    list = (await call<{ transactions?: typeof list }>('pendingTransactions')).transactions ?? [];
  } catch {
    return 0;
  }
  let on = 0;
  for (const t of list) {
    if (typeof t.jws !== 'string') continue;
    try {
      const server = await confirmAppStorePurchase({ jws: t.jws });
      if (server.status === 'on') on += 1;
      if (settled(server) && t.transactionId) await call('finish', { transactionId: t.transactionId }).catch(() => undefined);
    } catch {
      // keep it unfinished — Apple re-delivers it next launch
    }
  }
  return on;
}

/** Profile › Restore purchases. */
export async function restoreWithApple(): Promise<IapRestoreResult> {
  if (!nativeStoreAvailable()) return { ok: false };
  let jwsList: string[] = [];
  try {
    jwsList = ((await call<{ transactions?: unknown[] }>('restore')).transactions ?? []).filter(
      (j): j is string => typeof j === 'string',
    );
  } catch {
    return { ok: false };
  }
  try {
    const result = await restoreAppStorePurchases({ jwsList });
    // Anything restored is settled server-side; finish what the phone still holds.
    await deliverPendingAppStoreTransactions();
    return result;
  } catch {
    return { ok: false };
  }
}

/** Listen for StoreKit's Transaction.updates (Ask to Buy approved, a purchase on another device). */
export function onAppStoreTransaction(cb: () => void): () => void {
  const plugin = capacitor()?.Plugins?.[NATIVE_STORE_PLUGIN];
  if (!plugin?.addListener) return () => undefined;
  let handle: ListenerHandle | undefined;
  let removed = false;
  Promise.resolve(plugin.addListener('transaction', () => cb()))
    .then((h) => {
      if (removed) h?.remove();
      else handle = h;
    })
    .catch(() => undefined);
  return () => {
    removed = true;
    handle?.remove();
  };
}
