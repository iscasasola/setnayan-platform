'use client';

import { useEffect } from 'react';
import { deliverPendingAppStoreTransactions, onAppStoreTransaction } from '@/lib/iap/native-store';

/**
 * 🍎 The net under every Apple purchase, on the phone side: on mount, and
 * whenever StoreKit reports a transaction (Ask to Buy approved, a purchase that
 * finished while the app was closed), hand every unfinished one to our server
 * — whose answer redraws what this screen shows. Renders nothing.
 *
 * Mounted by Home ONLY when the page's `getIapGate().iap` is true — so the web,
 * the desktop app and an old phone build never run it. Never in the event
 * layout: that is the Maker's first load (scripts/check-maker-js-budget.mjs).
 * A static import on purpose — every async chunk adds a line to the webpack
 * runtime every route loads, the Maker's included.
 */
export function AppStoreTransactions() {
  useEffect(() => {
    /* ⚡ A purchase switched on is redrawn by its own answer: `confirmAppStorePurchase` revalidates when it turns
       something on, and that answer carries the page's render — a `router.refresh()` here drew it a second time. */
    const deliver = () => void deliverPendingAppStoreTransactions();
    deliver();
    return onAppStoreTransaction(deliver);
  }, []);
  return null;
}
