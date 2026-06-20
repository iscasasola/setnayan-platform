'use client';

// Root client-side providers for the web app.
//
// Wires TanStack Query with an IndexedDB-backed persister so warm data
// (vendor profiles, mood board, guest list, etc.) survives reloads and
// rehydrates in <100 ms on return visits — see spec § 3.1 and § 9.2.
//
// - `key: 'setnayan-query-cache'` — IndexedDB key for the serialised
//   query cache blob.
// - `maxAge: 7 days` — hard ceiling for persisted entries. Anything older
//   is dropped on rehydrate (spec § 3.1).
// - `buster: NEXT_PUBLIC_CACHE_BUSTER` — CI bumps this whenever a query
//   response shape changes, so stale schemas don't survive a deploy
//   (spec § 9.4).

import { Suspense, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { getQueryClient } from '@/lib/query-client';
import { LoaderOverlayProvider } from '@/components/sd-loader';
import { BrandProvider } from './_components/brand-provider';
import { DeferredObservability } from './_components/deferred-observability';
import { GlobalHaptics } from './_components/global-haptics';
import { PostHogProvider } from './_components/posthog-provider';
import { ThemeProvider, type ThemeMode } from './_components/theme-provider';
import { ToastProvider } from './_components/toast/toast-provider';
import { ToastFromParams } from './_components/toast/toast-from-params';

const PERSIST_KEY = 'setnayan-query-cache';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — spec § 3.1

// `idb-keyval` exposes an async get/set/del; `createSyncStoragePersister`
// expects a synchronous `Storage`-like interface. We wrap the async calls
// behind a fire-and-forget setter and a cached getter — the persister
// already tolerates a sync API backed by an async store because writes
// are debounced and reads only happen at boot (during rehydrate).
function createIdbStorage(): Storage {
  // Hold the last-known serialised cache in memory so the synchronous
  // `getItem` contract can be honoured between async hops. On boot the
  // persister calls `getItem(key)` exactly once during rehydrate, so we
  // populate this synchronously the first time the module loads via a
  // top-level promise initiated below.
  let memory: Record<string, string> = {};
  let primed: Promise<void> | null = null;
  // Once IndexedDB proves unusable, stop touching it entirely.
  let idbUsable = true;

  // Run an idb-keyval call so that NEITHER a synchronous throw NOR an async
  // rejection can ever escape. This matters because `idb-keyval`'s `get/set/del`
  // lazily call `indexedDB.open()` the first time they run — and a remote-URL
  // WKWebView (the Capacitor native shell) and Safari Private Browsing both
  // partition/block IndexedDB and throw a SecurityError *synchronously* on that
  // access. Since `createIdbStorage()` runs inside a `useState` initializer
  // during render (see <Providers> below), a synchronous throw here would
  // bubble straight into React render and trip the root error boundary — which
  // is exactly the "Something on our end didn't work" crash on first launch in
  // the iOS/Android shells. A `.catch()` alone does NOT cover the sync throw,
  // because the promise it would attach to is never created.
  function safe<T>(op: () => Promise<T>): Promise<T | undefined> {
    if (!idbUsable) return Promise.resolve(undefined);
    try {
      return op().catch(() => {
        idbUsable = false;
        return undefined;
      });
    } catch {
      // Synchronous throw — IndexedDB is blocked/partitioned. Fall back to
      // in-memory only; the app still works, the cache just doesn't persist.
      idbUsable = false;
      return Promise.resolve(undefined);
    }
  }

  function prime(key: string): Promise<void> {
    if (primed) return primed;
    primed = safe(() => get<string>(key)).then((value) => {
      if (typeof value === 'string') memory[key] = value;
    });
    return primed;
  }

  // Best-effort eager prime so the persister's first sync read succeeds.
  if (typeof window !== 'undefined') {
    void prime(PERSIST_KEY);
  }

  return {
    get length() {
      return Object.keys(memory).length;
    },
    clear: () => {
      memory = {};
      void safe(() => del(PERSIST_KEY));
    },
    key: (index: number) => Object.keys(memory)[index] ?? null,
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => {
      memory[key] = value;
      void safe(() => set(key, value));
    },
    removeItem: (key: string) => {
      delete memory[key];
      void safe(() => del(key));
    },
  };
}

export function Providers({
  children,
  initialThemeMode = 'auto',
  brandMarkUrl = null,
}: {
  children: React.ReactNode;
  /**
   * SSR-resolved theme mode from `users.theme_preference` (or 'auto' for
   * anonymous visitors). Wraps everything so client components can call
   * `useTheme()` to read/write the current mode.
   * 2026-05-22 brand pivot — see CLAUDE.md decision-log.
   */
  initialThemeMode?: ThemeMode;
  /**
   * SSR-resolved admin brand mark URL (already version-busted), or null for the
   * built-in gold default. Supplies <Logo>/<LogoMark> via BrandProvider with
   * zero call-site churn. Owner 2026-06-10.
   */
  brandMarkUrl?: string | null;
}) {
  const [queryClient] = useState(() => getQueryClient());
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: createIdbStorage(),
      key: PERSIST_KEY,
    }),
  );

  return (
    <ThemeProvider initialMode={initialThemeMode}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: MAX_AGE_MS,
          buster: process.env.NEXT_PUBLIC_CACHE_BUSTER ?? 'v1',
        }}
      >
        {/*
          TODO: pass `userId` from a server component once we have a clean
          place to read it (e.g., a SignedInProviders wrapper). For now the
          PostHogProvider resolves the Supabase user_id itself via the
          browser client + onAuthStateChange — keeps providers.tsx free of
          server-only imports and avoids plumbing the id through every
          layout.
        */}
        <PostHogProvider>
          {/*
            App-wide blocking loader overlay (Organic loaders handoff
            2026-06-07). Provides useLoader() to any client component for
            screen-covering "thinking" moments (sign-in, heavy submits) with a
            "Ready ✓" completion. Route-level loading still uses skeletons.
          */}
          <LoaderOverlayProvider>
            <BrandProvider markUrl={brandMarkUrl}>
              <ToastProvider>
                {children}
                <Suspense fallback={null}>
                  <ToastFromParams />
                </Suspense>
              </ToastProvider>
            </BrandProvider>
          </LoaderOverlayProvider>
        </PostHogProvider>
        {/*
          Sentry browser SDK is lazy-loaded post-hydration via a deferred
          client component so the ~105 kB `@sentry/nextjs` chunk stays
          out of the shared First Load JS bundle. Server-side Sentry
          (instrumentation.ts + sentry.{server,edge}.config.ts) is
          untouched and continues to capture server errors eagerly.
        */}
        <DeferredObservability />
        {/*
          App-wide tap haptics — one passive pointerdown listener fires a
          light `tick` on any interactive control. Owner directive 2026-06-03.
          Renders nothing; no-ops on engines without haptic support.
        */}
        <GlobalHaptics />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
