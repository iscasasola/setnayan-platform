// V2 Cutover Phase G — IndexedDB schema setup for the 7 offline queues.
//
// Hand-rolled on the raw `indexedDB` API rather than `idb` or `idb-keyval`
// — both are listed in package.json (idb-keyval ^6.2.1 per CLAUDE.md
// 2026-05-28 second row Installed_Stack), but Phase G doesn't need the
// abstraction. We open one database (`setnayan_offline`) with 7 named
// object stores, each keyed on `item_id` with `event_id` + `queued_at`
// indexes. That's a one-shot upgrade hook + 5 small helper functions —
// pulling in `idb` would buy generic types we don't use here.
//
// All functions are client-side only. They throw on the server (no
// `window` / `indexedDB`) — callers should gate on `typeof window !==
// 'undefined'` or run inside a `'use client'` boundary. The admin
// diagnostic page uses dynamic import + `{ ssr: false }` to enforce
// this at the route layer.
//
// Per CLAUDE.md third 2026-05-28 row: this is scaffolding only. The
// queue read/write paths are real (so the per-service handlers in
// V1.x can wire up actual uploads), but the queues stay empty during
// pilot — no production code paths enqueue items yet.

import {
  SERVICE_CODES,
  type OfflineItem,
  type OfflineQueueStat,
  type ServiceCode,
} from './types';

const DB_NAME = 'setnayan_offline';
const DB_VERSION = 1;

/**
 * Per-service store name. `${service}_queue` keeps each queue's IDB
 * keyspace isolated — easy to drop one without touching the others if
 * a handler ships before the data model stabilizes.
 *
 * `as const` keeps the return type narrow so we can use the result as
 * a `keyof` constraint elsewhere if needed.
 */
export function storeNameForService(service: ServiceCode): string {
  return `${service}_queue` as const;
}

/**
 * Opens (or creates) the `setnayan_offline` database. The first call
 * after a fresh install triggers `onupgradeneeded`, which creates the
 * 7 object stores in one transaction. Subsequent calls resolve to the
 * already-open handle.
 *
 * Returns a thin promise wrapper around `IDBDatabase` — we don't import
 * `IDBPDatabase` from `idb` because we never use it. The return type
 * matches what `indexedDB.open()` gives us.
 *
 * Errors on `request.onerror` reject the promise with the IDB error so
 * the sync daemon can log + retry. Browsers in private mode or with
 * IDB quota exceeded will surface here.
 */
export function openOfflineDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('openOfflineDB is client-only — IndexedDB is not available here'),
    );
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Create one object store per service. Each store keys on
      // `item_id` (UUIDv4 from crypto.randomUUID), with secondary
      // indexes on `event_id` (so we can list items for a specific
      // event) and `queued_at` (so we can drain oldest-first).
      for (const service of SERVICE_CODES) {
        const storeName = storeNameForService(service);
        if (db.objectStoreNames.contains(storeName)) continue;
        const store = db.createObjectStore(storeName, { keyPath: 'item_id' });
        store.createIndex('event_id', 'event_id', { unique: false });
        store.createIndex('queued_at', 'queued_at', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
    request.onblocked = () => {
      // Another tab is holding an older version open. Don't reject —
      // surface as an error result so the admin diagnostic can show
      // "another tab is blocking the upgrade · close other tabs". The
      // sync daemon treats this as a soft failure.
      reject(new Error('IndexedDB upgrade blocked by another tab'));
    };
  });
}

/**
 * Promisify a single IDBRequest. Used internally by enqueue/dequeue/list
 * so we don't repeat the onsuccess/onerror boilerplate.
 */
function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IDB request failed'));
  });
}

/**
 * Insert a new pending item into the per-service queue. Mints a UUIDv4
 * for `item_id` if the caller didn't pass one — handlers idempotency-key
 * off this value so retries don't duplicate.
 *
 * Returns the generated (or passed-through) `item_id` so callers can
 * cancel/inspect a specific queue entry later.
 *
 * `crypto.randomUUID` is available in all modern browsers (Chrome 92+,
 * Safari 15.4+, Firefox 95+). PWA target floor per [[project_setnayan_pilot_timeline]]
 * is well above those.
 */
export async function enqueueOfflineItem(
  service: ServiceCode,
  item: Omit<OfflineItem, 'item_id' | 'retry_count' | 'queued_at'> & {
    item_id?: string;
    queued_at?: string;
    retry_count?: number;
  },
): Promise<string> {
  const db = await openOfflineDB();
  const storeName = storeNameForService(service);
  const fullItem: OfflineItem = {
    item_id: item.item_id ?? crypto.randomUUID(),
    event_id: item.event_id,
    queued_at: item.queued_at ?? new Date().toISOString(),
    payload: item.payload,
    retry_count: item.retry_count ?? 0,
    last_error: item.last_error,
  };

  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await awaitRequest(store.put(fullItem));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
  db.close();
  return fullItem.item_id;
}

/**
 * Remove an item from the queue — called by the sync daemon after a
 * handler returns `{ ok: true }`. Idempotent: deleting a non-existent
 * key is a no-op (IDB's delete behavior).
 */
export async function dequeueOfflineItem(
  service: ServiceCode,
  item_id: string,
): Promise<void> {
  const db = await openOfflineDB();
  const storeName = storeNameForService(service);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await awaitRequest(store.delete(item_id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
  db.close();
}

/**
 * List pending items in a queue, optionally scoped to a specific event.
 *
 * When `event_id` is provided we open a cursor against the `event_id`
 * index — IDB's index walks the matching range in key order, so we
 * don't load every item just to filter. When `event_id` is omitted
 * we use `getAll()` which is the fastest path for full-queue reads.
 *
 * Used by the admin diagnostic (full-queue stats) + per-event
 * surfaces in V1.x (e.g., "you have 3 photos waiting to upload" on
 * the event-home page).
 */
export async function listOfflineItems(
  service: ServiceCode,
  event_id?: string,
): Promise<OfflineItem[]> {
  const db = await openOfflineDB();
  const storeName = storeNameForService(service);
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);

  let items: OfflineItem[];
  if (event_id) {
    const index = store.index('event_id');
    items = await awaitRequest(index.getAll(IDBKeyRange.only(event_id)));
  } else {
    items = await awaitRequest(store.getAll());
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
  db.close();

  // Drain oldest-first by queued_at — getAll() returns keyPath order
  // (item_id), which is random UUIDs, so we sort explicitly. The
  // index('queued_at') path would already be sorted, but we wanted
  // the event_id-scoped query above, and switching indexes mid-tx
  // is more complex than a JS sort over a small set.
  items.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  return items;
}

/**
 * Update an existing queue item — used by the sync daemon when a
 * handler returns `{ ok: false }` so we can increment `retry_count`
 * + stash `last_error` for the diagnostic page.
 *
 * Exported so per-service handlers in V1.x can also reach in (e.g.,
 * to update a partially-uploaded chunk's progress marker on the
 * payload). Stays in `db.ts` so the IDB transaction boilerplate
 * lives in one place.
 */
export async function updateOfflineItem(
  service: ServiceCode,
  item: OfflineItem,
): Promise<void> {
  const db = await openOfflineDB();
  const storeName = storeNameForService(service);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await awaitRequest(store.put(item));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
  db.close();
}

/**
 * Aggregate queue stats across all 7 services. Returns one row per
 * service with a pending count. Used by the admin diagnostic + the
 * service-worker `CHECK_QUEUE_STATUS` message handler.
 *
 * Reads all 7 stores in a single readonly transaction for atomicity
 * — the count is consistent against the moment the transaction
 * opened, not a smear across writes that might land between counts.
 */
export async function getOfflineQueueStats(): Promise<OfflineQueueStat[]> {
  const db = await openOfflineDB();
  const storeNames = SERVICE_CODES.map(storeNameForService);
  const tx = db.transaction(storeNames, 'readonly');
  const counts = await Promise.all(
    SERVICE_CODES.map(async (service) => {
      const store = tx.objectStore(storeNameForService(service));
      const count = await awaitRequest(store.count());
      return { service, pending: count };
    }),
  );
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
  db.close();
  return counts;
}
