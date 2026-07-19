'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_LOADER_CONFIG, type LoaderConfig } from '@/lib/loader-config';

/**
 * Supplies the admin-configured loader appearance to every <SDLoader> with ZERO
 * call-site churn (owner 2026-07-05).
 *
 * The root layout reads the loader settings once (server, cached) and passes the
 * resolved config into this provider via <Providers>. <SDLoader> reads
 * `variant` + `stepIntervalMs` + `popEnabled` through `useLoaderConfig()` when a
 * caller doesn't pass explicit props, falling back to DEFAULT_LOADER_CONFIG when
 * no provider is mounted (e.g. an isolated preview). Because the value is
 * threaded as a serialized prop from the server, SSR and hydration agree.
 *
 * The veil solidity is applied separately — as the `--sd-veil` CSS var on
 * <html> in layout.tsx — so it's already in the cascade before any JS runs.
 */
const LoaderConfigContext = createContext<LoaderConfig>(DEFAULT_LOADER_CONFIG);

export function LoaderConfigProvider({
  config,
  children,
}: {
  config: LoaderConfig;
  children: React.ReactNode;
}) {
  return (
    <LoaderConfigContext.Provider value={config}>
      {children}
    </LoaderConfigContext.Provider>
  );
}

/** The current admin-configured loader appearance (or the shipped default). */
export function useLoaderConfig(): LoaderConfig {
  return useContext(LoaderConfigContext);
}
