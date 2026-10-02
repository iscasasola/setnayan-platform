'use client';

import { useEffect } from 'react';
import { appPreloader, routeChunkUrls, type PreloadJob } from '@/lib/app-preload';

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
 * asks for the page once the way the router does (its RSC payload), reads the
 * chunk files that payload names, and fetches the ones this tab has not loaded
 * — low priority, four at a time, into the browser's cache (`/_next/static` is
 * immutable). The tap then runs that code from the phone and only asks the
 * server for fresh data.
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
export function AppPreload({ routes }: { routes: readonly string[] }) {
  const key = routes.join('|');
  useEffect(() => {
    if (!key) return;
    const jobs: PreloadJob[] = key
      .split('|')
      .filter(Boolean)
      .map((href) => ({ key: `code:${href}`, load: () => preloadRouteCode(href) }));
    appPreloader().preload(jobs);
  }, [key]);
  return null;
}

type LowFetchInit = RequestInit & { priority?: 'low' | 'high' | 'auto' };

/** Fetch the chunk files a page's RSC payload names that this tab has not loaded yet. */
async function preloadRouteCode(href: string): Promise<void> {
  const url = new URL(href, window.location.origin);
  url.searchParams.set('_rsc', 'preload');
  const init: LowFetchInit = { headers: { RSC: '1' }, credentials: 'same-origin', priority: 'low' };
  const res = await fetch(url, init);
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('text/x-component')) throw new Error(`no payload for ${href}`);
  const have = new Set(
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .concat([...document.scripts].map((s) => (s.src ? new URL(s.src).pathname : ''))),
  );
  // A deployment-pinned query (`?dpl=…`, skew protection) rides on every chunk the page loaded; keep it so the cache key matches.
  const sample = [...document.scripts].find((s) => s.src.includes('/_next/static/chunks/'));
  const suffix = sample ? new URL(sample.src).search : '';
  const todo = routeChunkUrls(await res.text()).filter((p) => !have.has(p));
  // A few at a time: on a phone network each request's round trip, not its size, is the cost.
  const chunk: LowFetchInit = { priority: 'low', credentials: 'same-origin' };
  const lane = async () => {
    for (let path = todo.shift(); path; path = todo.shift()) {
      await fetch(`${path}${suffix}`, chunk).then((r) => r.arrayBuffer());
    }
  };
  await Promise.all([lane(), lane(), lane(), lane()]);
}
