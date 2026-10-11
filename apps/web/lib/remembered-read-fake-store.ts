/**
 * TEST ONLY — a stand-in for the store behind `rememberWith`, behaving the way
 * Next's `unstable_cache` does (read from `next/dist/server/web/spec-extension/
 * unstable-cache.js`, 15.5): a fresh entry is returned; a STALE entry is
 * returned too and refreshed behind the response; a thrown load stores nothing;
 * a value comes back through JSON, as it does from the real store.
 */
import type { RememberStore } from './remembered-read-core';

/** A stale-while-revalidate store on a clock the test owns. */
export function fakeSwrStore(clock: { now: number }) {
  const entries = new Map<string, { value: unknown; storedAt: number }>();
  const background: Promise<unknown>[] = [];
  const store: RememberStore = (load, key, opts) =>
    async (...args) => {
      const slot = `${key}-${JSON.stringify(args)}`;
      const hit = entries.get(slot);
      if (hit) {
        if (clock.now - hit.storedAt > opts.revalidate * 1000) {
          // Stale: handed back as it is, refreshed behind the response.
          background.push(
            load(...args).then(
              (value) => entries.set(slot, { value: JSON.parse(JSON.stringify(value)), storedAt: clock.now }),
              () => undefined,
            ),
          );
        }
        return JSON.parse(JSON.stringify(hit.value));
      }
      const value = await load(...args);
      entries.set(slot, { value: JSON.parse(JSON.stringify(value)), storedAt: clock.now });
      return value;
    };
  return {
    store,
    entries,
    settle: async () => {
      await Promise.all(background.splice(0));
    },
    /** What `revalidateTag` does to every entry under a tag. */
    clear: () => entries.clear(),
  };
}
