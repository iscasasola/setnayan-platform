'use client';

import { useEffect, useState } from 'react';
import { loadAppStoreProducts, type AppStoreProduct } from './native-store';

export type AppStorePrices = {
  /** 'silent' = StoreKit did not answer; the caller says so and offers no figure of ours. */
  state: 'loading' | 'ready' | 'silent';
  products: ReadonlyMap<string, AppStoreProduct>;
};

const EMPTY: ReadonlyMap<string, AppStoreProduct> = new Map();

/**
 * Apple's price for each product, read from StoreKit when `enabled` turns true
 * (the sheet opened) — never before, so Home does not wake StoreKit on every
 * view. A product StoreKit does not return is simply absent: its buy button
 * has no price and stays disabled rather than showing one we typed.
 */
export function useAppStorePrices(productIds: readonly string[], enabled: boolean): AppStorePrices {
  const key = productIds.join('|');
  const [state, setState] = useState<AppStorePrices>({ state: 'loading', products: EMPTY });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => (s.state === 'ready' ? s : { state: 'loading', products: EMPTY }));
    void loadAppStoreProducts(key.split('|').filter(Boolean)).then((map) => {
      if (!alive) return;
      setState(map && map.size > 0 ? { state: 'ready', products: map } : { state: 'silent', products: EMPTY });
    });
    return () => {
      alive = false;
    };
  }, [key, enabled]);
  return state;
}
