/**
 * lib/legacy-redirects.ts — the ONE map of retired page paths that still
 * forward, read by `middleware.ts`.
 *
 * ─── WHY THESE LIVE HERE AND NOT AS PAGES OR next.config REDIRECTS ──────────
 * A redirect-only `page.tsx` is still a deployed route, and Vercel caps a
 * project at 2,048 routes (a production deploy was rejected at 2,057). A
 * `next.config` `redirects()` rule costs a route too. A middleware forward
 * costs NONE — it is not in the routes manifest — and the middleware matcher
 * already covers every path here, so the old URL is answered before routing.
 * (Same shape as cleanup PR #6265, which adds its own stubs to this map.)
 *
 * ─── WHY THEY STILL FORWARD ─────────────────────────────────────────────────
 * Digest emails, bookmarks, DB-stored notification URLs (`related_url`) and
 * anything indexed cannot be seen from the code. 308 = permanent +
 * method-preserving, like the `/services` and `/add-ons` forwards beside it.
 *
 * ⚠ EXACT PATHS ONLY (a trailing slash is tolerated). A retired path's child is
 * a different URL and is not forwarded — `/studio/papic` is a live page.
 *
 * ⚠ To retire another page: delete it, add the pair, and
 * `lib/legacy-redirects.test.ts` holds the rest. Do NOT add a `redirects()`
 * rule to next.config.ts for this — it spends the route budget this file saves.
 */
import { MORE_SERVICES_PARAM, MORE_SERVICES_VALUE } from './studio-hub';

/** The More menu's address, relative to the event (`studioHubHref`). */
const MORE_MENU = `?${MORE_SERVICES_PARAM}=${MORE_SERVICES_VALUE}`;

/**
 * `/dashboard/<eventId>/<segment>` → `/dashboard/<eventId><to>`. `to` is
 * either '' (the event's Home), `/<path>`, or a query on Home (`?…`).
 */
const EVENT_SCOPED: readonly (readonly [from: string, to: string])[] = [
  // 🧭 The full-page More Services (owner 2026-10-02, tracker d1: "remove the
  // old page — the More menu is the one place; old links forward"). `/suite`
  // was the page; `/studio` was its predecessor and had redirected to it.
  ['suite', MORE_MENU],
  ['studio', MORE_MENU],
];

/** Whole-path pairs (no event id in them). */
const FIXED: readonly (readonly [from: string, to: string])[] = [];

const EVENT_SCOPED_MAP: ReadonlyMap<string, string> = new Map(EVENT_SCOPED);
const FIXED_MAP: ReadonlyMap<string, string> = new Map(FIXED);

/** Every old path this map forwards, with `<eventId>` as the placeholder — for tests and docs. */
export const LEGACY_REDIRECT_OLD_PATHS: readonly string[] = [
  ...EVENT_SCOPED.map(([from]) => `/dashboard/<eventId>/${from}`),
  ...FIXED.map(([from]) => from),
];

/**
 * Where a retired page forwards to, or `null` when `pathname` is not one of
 * them. Pure — no request, no I/O — so the middleware pays one Map lookup.
 */
export function legacyRedirectTarget(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  const fixed = FIXED_MAP.get(path);
  if (fixed) return fixed;

  const m = /^\/dashboard\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return null;
  const to = EVENT_SCOPED_MAP.get(m[2]!);
  if (to === undefined) return null;
  if (to === '' || to.startsWith('?')) return `/dashboard/${m[1]}${to}`;
  return `/dashboard/${m[1]}/${to}`;
}
