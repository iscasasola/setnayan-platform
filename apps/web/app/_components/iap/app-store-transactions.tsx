'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 🍎 The net under every Apple purchase, on the phone side: on mount, and
 * whenever StoreKit reports a transaction (Ask to Buy approved, a purchase that
 * finished while the app was closed), hand every unfinished one to our server
 * and refresh what this screen shows. Renders nothing.
 *
 * Mounted by the event layout ONLY when `getIapGate().iap` is true — so the web,
 * the desktop app and an old phone build never run it. The StoreKit code is
 * imported LAZILY: this sits in the event layout, which is part of the Maker's
 * first load (scripts/check-maker-js-budget.mjs).
 */
export function AppStoreTransactions() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    let off: () => void = () => undefined;
    void import('@/lib/iap/native-store')
      .then(({ deliverPendingAppStoreTransactions, onAppStoreTransaction }) => {
        if (!alive) return;
        const deliver = () => {
          void deliverPendingAppStoreTransactions().then((on) => {
            if (alive && on > 0) router.refresh();
          });
        };
        deliver();
        off = onAppStoreTransaction(deliver);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      off();
    };
  }, [router]);
  return null;
}
