'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { deliverPendingAppStoreTransactions, onAppStoreTransaction } from '@/lib/iap/native-store';

/**
 * 🍎 The net under every Apple purchase, on the phone side: on mount, and
 * whenever StoreKit reports a transaction (Ask to Buy approved, a purchase that
 * finished while the app was closed), hand every unfinished one to our server
 * and refresh what this screen shows. Renders nothing.
 *
 * Mounted by the event layout ONLY when `getIapGate().iap` is true — so the web,
 * the desktop app and an old phone build never run it.
 */
export function AppStoreTransactions() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    const deliver = () => {
      void deliverPendingAppStoreTransactions().then((on) => {
        if (alive && on > 0) router.refresh();
      });
    };
    deliver();
    const off = onAppStoreTransaction(deliver);
    return () => {
      alive = false;
      off();
    };
  }, [router]);
  return null;
}
