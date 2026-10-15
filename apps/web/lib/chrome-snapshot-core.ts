/* The decision, with no request in it — `lib/chrome-snapshot.ts` adds the request (and the docblock). Split so a
   guard can run it under node (`server-only` throws outside Next). */
export const SNAPSHOT_MS = 20_000;

/** An in-app request that may reuse a snapshot: the app's own fetch, not a page load, not a Server Action. */
export function mayReuseChrome(h: { get(name: string): string | null }): boolean {
  if (h.get('next-action')) return false;
  return h.get('sec-fetch-dest') === 'empty';
}
const MAX_ENTRIES = 500;

type Entry = { at: number; value: unknown };
const store = new Map<string, Entry>();

export async function chromeSnapshotWith<T>(
  name: string,
  userId: string,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
  now: () => number,
  prefetch: () => Promise<boolean>,
): Promise<T> {
  const key = `${name}\u0000${userId}`;
  if (await prefetch()) {
    const hit = store.get(key);
    if (hit && now() - hit.at < SNAPSHOT_MS) return hit.value as T;
  }
  const value = await load();
  if (keep(value)) {
    store.delete(key);
    store.set(key, { at: now(), value });
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  } else {
    store.delete(key);
  }
  return value;
}

/** Tests only. */
export function __clearChromeSnapshots(): void {
  store.clear();
}
