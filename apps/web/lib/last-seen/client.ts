/**
 * 💾 LAST-SEEN DATA — the one module the five pages load LAZILY (`import()`),
 * on the phone, after they render. Everything heavy lives behind it: the store
 * (`./store.ts`) and the snapshot cleaner (`./snapshot-dom.ts`).
 *
 * ONE lazy module, not two, on purpose: every `import()` target is an entry in
 * the webpack runtime that EVERY page downloads, and the shared bundle has
 * little room (`scripts/check-bundle-size.mjs`). Statically imported, this code
 * rode into the first load of every event page — the Maker's included
 * (measured +4.3KB gzipped on `/dashboard/[eventId]/launch`) — because
 * `[eventId]/loading.tsx` is Home's loading screen AND every child route's.
 */
export { deviceStorage, readLastSeen, saveLastSeen } from './store';
export { snapshotFromRoot } from './snapshot-dom';
