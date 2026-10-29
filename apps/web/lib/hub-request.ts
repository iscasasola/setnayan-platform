import { cache } from 'react';
import type { HubUaFacts } from './hub-view-key';

/**
 * lib/hub-request.ts — THE CACHED EVENT HUB'S VIEWER, HELD FOR ONE RENDER (EV1, 2026-10-28).
 *
 * The cached hub route (`app/[slug]/cached/[key]/page.tsx`) must read nothing from the request — one `cookies()` or
 * `headers()` anywhere in its tree and Next renders it per request again (or, mid-ISR, fails the page). But the hub's
 * tree reaches the request through a handful of readers deep below the page: the account (`getCurrentUser`), the
 * guest pass (`readGuestPassStanding`), the cookie-scoped Supabase client, the native-shell marks, the "view as free"
 * switch, the user agent. Each of those asks `cachedHubViewer()` FIRST: on the cached route it answers what the
 * route's address already decided (`lib/hub-view-key.ts`) — no account, this guest's checked pass or none, a web
 * browser, these device facts — and never touches the request. Everywhere else it is `null` and they read the request
 * exactly as before.
 *
 * 🔑 WHY THE ANSWERS ARE THE TRUTH, NOT A GUESS: the middleware only rewrites to the cached route a request that
 * carries NO Supabase session, no host-preview / view-as / terms / demo cookie, no native-shell mark and no query the
 * page reads (`hubRequestShape`). For such a request the live render would have read exactly these values.
 *
 * Per render (`React.cache`): the route holds it before anything below it renders. Outside a render (a Server Action,
 * a route handler) `cache` memoizes nothing, so the slot is always empty there — they read the request.
 */
export type CachedHubViewer = {
  /** This event's guest pass, already checked against the guest's current QR token — or null (a stranger). */
  pass: { guest_id: string; event_id: string; qr_token: string } | null;
  /** The device facts the key carries (a guest's copy), or null. */
  ua: HubUaFacts | null;
};

const slot = cache((): { viewer: CachedHubViewer | null } => ({ viewer: null }));

/** The cached route, before it renders anything: "this render is for THIS viewer, read nothing else". */
export function holdCachedHubViewer(viewer: CachedHubViewer): void {
  slot().viewer = viewer;
}

/** The held viewer on the cached hub route; `null` on every other render (read the request as usual). */
export function cachedHubViewer(): CachedHubViewer | null {
  try {
    return slot().viewer;
  } catch {
    return null;
  }
}
