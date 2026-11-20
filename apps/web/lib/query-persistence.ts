/**
 * lib/query-persistence.ts — THE QUERY CACHE'S INDEXEDDB COPY, STARTED AFTER THE PAGE HAS SETTLED.
 *
 * Moved out of `app/providers.tsx` (speed pass 2026-11-18). The root providers used to wrap every page in
 * `PersistQueryClientProvider`, which put TanStack Query, its persister and idb-keyval in EVERY page's first load
 * and restored the IndexedDB blob during boot. Measured on da4a079: NOTHING reads the query cache through React (no
 * `useQuery`, no `useQueryClient`, no `getQueryData`); three event-day components only WRITE to it
 * (`getQueryClient().setQueryData`, the offline prep bundle). So the React context was unused, and only the
 * persistence matters.
 *
 * What is kept, byte for byte: the same key (`setnayan-query-cache`), the same 7-day max age, the same buster, the same
 * restore-then-subscribe (`persistQueryClient`), the same never-throw IndexedDB wrapper. What changed: it starts once
 * the page has loaded and gone idle (`app/_components/query-persistence.tsx`), and the restore waits for the IndexedDB
 * read to finish (before, the persister's first synchronous read could run before the eager prime had answered).
 */
import { get, set, del } from 'idb-keyval';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { getQueryClient } from '@/lib/query-client';

export const PERSIST_KEY = 'setnayan-query-cache';
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — spec § 3.1

// `idb-keyval` exposes an async get/set/del; `createSyncStoragePersister`
// expects a synchronous `Storage`-like interface. We wrap the async calls
// behind a fire-and-forget setter and a cached getter — the persister
// already tolerates a sync API backed by an async store because writes
// are debounced and reads only happen at boot (during rehydrate).
function createIdbStorage(): { storage: Storage; primed: Promise<void> } {
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
  // access. When `createIdbStorage()` ran inside a `useState` initializer
  // during render (the old <Providers>), a synchronous throw here bubbled
  // straight into React render and tripped the root error boundary — the
  // "Something on our end didn't work" crash on first launch in the
  // iOS/Android shells. It now runs after the page settles, and must still
  // never throw. A `.catch()` alone does NOT cover the sync throw,
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

  // Prime before the restore reads it (startQueryPersistence awaits this).
  const primedRead = typeof window !== 'undefined' ? prime(PERSIST_KEY) : Promise.resolve();

  const storage: Storage = {
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
  return { storage, primed: primedRead };
}

/** Restore the persisted cache into the app's one QueryClient, then keep saving it. Returns the stop function. */
export async function startQueryPersistence(): Promise<() => void> {
  const { storage, primed } = createIdbStorage();
  await primed;
  const [unsubscribe, restored] = persistQueryClient({
    queryClient: getQueryClient(),
    persister: createSyncStoragePersister({ storage, key: PERSIST_KEY }),
    maxAge: MAX_AGE_MS,
    buster: process.env.NEXT_PUBLIC_CACHE_BUSTER ?? 'v1',
  });
  // A restore that throws has already discarded the blob (the library does that); the app works without it.
  await restored.catch(() => {});
  return unsubscribe;
}
