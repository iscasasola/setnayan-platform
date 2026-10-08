'use client';

import { useEffect } from 'react';
import { appPreloader, type PreloadJob } from '@/lib/app-preload';
import { appCodeMapUrl, chunksForRoute, type AppCodeMap } from '@/lib/app-code-map';

/**
 * 📲 THE SIGNED-IN APP PRELOADS WHAT THE ACCOUNT HAS — the trigger.
 *
 * Mounted by the signed-in layouts a person lands in (their account home, an
 * event they host, their shop) with a plan built on the server from what the
 * shell already read (`lib/app-preload-sets.ts` — `appPreloadPlan`). Once the
 * page has loaded and the phone is idle, it hands the ONE queue
 * (`lib/app-preload.ts`) one job per page: bring that page's CODE to the phone.
 * Nothing with Save-Data on; nothing drawn (the progress line is the Maker's
 * alone); nothing for a guest-only account (the plan is empty).
 *
 * 🔑 CODE, NOT DATA (owner 2026-10-02: *"Event data (guests, photos) is still
 * fetched fresh — the screen shows first, data fills in"*). Next's
 * `router.prefetch` was MEASURED not to bring a page's JavaScript — a host who
 * tapped Hub after it still downloaded 49–79 chunks of the Maker. So each job
 * learns which chunk files its page needs and fetches the ones this tab has
 * not loaded — low priority, four at a time, into the browser's cache
 * (`/_next/static` is immutable). The tap then runs that code from the phone
 * and only asks the server for fresh data.
 *
 * 🧯 …AND IT LEARNS THEM FROM THE BUILD, NEVER BY RENDERING THE PAGE
 * (2026-10-08). Until then each job "asked for the page once the way the router
 * does" (`?_rsc=preload`) — a FULL SERVER RENDER of that page, its layout and
 * every database read in it, fetched only to read the chunk names out of the
 * answer. The plan (`appPreloadPlan`) is 5 pages for a host and 9 more with a
 * shop, so EVERY hard load of any signed-in page rendered up to 14 other pages
 * nobody had asked for: on production, eleven `vendor-dashboard` routes within
 * nine seconds of one Maker open, ~1,090 database requests around it, on a
 * database that allows nine connections. "CODE, NOT DATA" was the promise, and
 * that rendered the data anyway.
 *
 * Now ONE small static file per deploy names every signed-in page's chunks
 * (`lib/app-code-map.ts`, written by `scripts/write-app-code-map.mjs` right
 * after `next build`, served from `/_next/static/` beside the chunks). The
 * shell asks the CDN for it once per page load; the server is asked nothing.
 * If the file is not there, the preload does NOTHING — a section's code then
 * downloads when it is tapped. ⛔ It never falls back to fetching a page: a
 * page render is never a cheap way to learn anything
 * (`app-preload-renders-nothing.test.ts` counts the requests: zero to any app
 * route).
 *
 * 📦 NO `import()` HERE. Loading Maker code by `import()` from these layouts
 * made the Maker page's chunks entries in the webpack runtime EVERY page
 * downloads (measured +139 to +176 B on a shared bundle with no room). Plain
 * fetches add nothing to it. The Maker's tool panels (`maker-tools.tsx`) are
 * fetched and warmed by the Maker itself the moment it is idle — with the
 * Maker's own code already on the phone, that is seconds after it opens.
 *
 * The Maker's own preload (`useMakerPreload`) shares the queue and goes first.
 */
/** The jobs the signed-in shell hands the queue: one per page — bring that page's CODE to the phone. */
export function appPreloadJobs(routes: readonly string[]): PreloadJob[] {
  return routes.filter(Boolean).map((href) => ({ key: `code:${href}`, load: () => preloadRouteCode(href) }));
}

export function AppPreload({ routes }: { routes: readonly string[] }) {
  const key = routes.join('|');
  useEffect(() => {
    if (!key) return;
    appPreloader().preload(appPreloadJobs(key.split('|')));
  }, [key]);
  return null;
}

type LowFetchInit = RequestInit & { priority?: 'low' | 'high' | 'auto' };

let codeMap: Promise<AppCodeMap | null> | null = null;
/** The deploy's code map: ONE static request per page load, shared by every job. Null when it is not served. */
function loadCodeMap(): Promise<AppCodeMap | null> {
  codeMap ??= fetch(appCodeMapUrl(process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev'), { priority: 'low', credentials: 'same-origin' } as LowFetchInit)
    .then((r) => (r.ok ? (r.json() as Promise<AppCodeMap>) : null))
    .catch(() => null);
  return codeMap;
}
/** For the guard: the next job asks for the map again. */
export function forgetCodeMap(): void {
  codeMap = null;
}

/**
 * Fetch the chunk files `href`'s page needs that this tab has not loaded yet — named by the build's
 * code map, never by the page. No map, or a page the map does not know: nothing is fetched (the job fails).
 */
export async function preloadRouteCode(href: string): Promise<void> {
  const needs = chunksForRoute(await loadCodeMap(), href);
  if (!needs) throw new Error(`no code map for ${href}`);
  const have = new Set(
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .concat([...document.scripts].map((s) => (s.src ? new URL(s.src).pathname : ''))),
  );
  // A deployment-pinned query (`?dpl=…`, skew protection) rides on every chunk the page loaded; keep it so the cache key matches.
  const sample = [...document.scripts].find((s) => s.src.includes('/_next/static/chunks/'));
  const suffix = sample ? new URL(sample.src).search : '';
  const todo = needs.filter((p) => !have.has(p));
  // A few at a time: on a phone network each request's round trip, not its size, is the cost.
  const chunk: LowFetchInit = { priority: 'low', credentials: 'same-origin' };
  const lane = async () => {
    for (let path = todo.shift(); path; path = todo.shift()) {
      await fetch(`${path}${suffix}`, chunk).then((r) => r.arrayBuffer());
    }
  };
  await Promise.all([lane(), lane(), lane(), lane()]);
}
