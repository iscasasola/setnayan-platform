/**
 * apps/web/lib/app-code-map.ts — WHICH CODE FILES A PAGE NEEDS, FROM THE BUILD.
 *
 * The signed-in shell preloads the CODE of the pages an account will tap next
 * (owner 2026-10-02: *"when someone logs in, it has their events, and their
 * shop"*). Until 2026-10-08 it learned a page's chunk files by asking the
 * server to RENDER the page — every database read in it — and reading the names
 * out of the answer: up to 14 full server renders on every signed-in page load
 * (`app/_components/app-preload.tsx`, "SWITCHED OFF").
 *
 * The build already knows the answer. `next build` writes, for every page and
 * layout, the chunk files it loads (`.next/app-build-manifest.json`);
 * `scripts/write-app-code-map.mjs` folds that into ONE small static file per
 * deploy, served from `/_next/static/` like the chunks themselves — no
 * function, no database, cached by the CDN. This module is its shape and the
 * two pure questions asked of it; it names no page.
 */

/** `chunks` once each; `routes` maps a route pattern (`/dashboard/[eventId]/guests`) to indexes into it. */
export type AppCodeMap = { v: 1; chunks: string[]; routes: Record<string, number[]> };

/** Where a deploy's map lives. `version` is `NEXT_PUBLIC_BUILD_VERSION` — the same value the build script reads. */
export function appCodeMapUrl(version: string): string {
  return `/_next/static/app-code/${encodeURIComponent(version)}.json`;
}

/**
 * The route pattern an address belongs to, as the build names it: the address
 * itself when it is a route of its own, else with the event's id as
 * `[eventId]`. Pure; knows only the one dynamic segment the plan uses.
 */
export function routePatternsOf(href: string): string[] {
  const path = href.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
  const m = /^\/dashboard\/([^/]+)(\/.*)?$/.exec(path);
  return m ? [path, `/dashboard/[eventId]${m[2] ?? ''}`] : [path];
}

/** The chunk files `href` needs, as `/_next/static/chunks/…` paths — or null when the map does not know the page. */
export function chunksForRoute(map: AppCodeMap | null | undefined, href: string): string[] | null {
  if (!map || map.v !== 1 || !Array.isArray(map.chunks) || !map.routes) return null;
  for (const pattern of routePatternsOf(href)) {
    const idx = map.routes[pattern];
    if (!Array.isArray(idx)) continue;
    const out: string[] = [];
    for (const i of idx) {
      const c = map.chunks[i];
      // Only the build's own static chunk files, ever — never an address the map could be made to name.
      if (typeof c === 'string' && /^\/_next\/static\/chunks\/[A-Za-z0-9_.\-\/\[\]%()@]+\.js$/.test(c) && !c.includes('..')) out.push(c);
    }
    return out;
  }
  return null;
}
