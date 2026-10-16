/**
 * THE LOAD-TIME LOG · the browser reporter (owner 2026-10-16: "log the loading
 * time of each load … when a loading takes more than 1.5 seconds … or longer
 * than its target").
 *
 * Installed once, lazily, at idle by app/_components/deferred-observability.tsx
 * — its OWN async chunk, beside the Problems observer, so the first load
 * carries only the import() call. 🔒 IT NEVER BLOCKS: every measurement is a
 * PerformanceObserver or a passive listener, every send is `sendBeacon`, all
 * work is wrapped so a throw here can never reach the page. Held by
 * `the-load-time-log.test.ts`.
 *
 * WHAT A LOAD IS
 *   page  a full page load — Navigation Timing (TTFB, DOMContentLoaded, load)
 *         and Largest Contentful Paint. The wait = LCP (else first contentful
 *         paint, else DOMContentLoaded). Breakdown: server = time to first byte
 *         · download = the document's bytes arriving · render = the rest.
 *   nav   an in-app move — measured the way the event-open speed work measured
 *         it (#6572/#6574): from the real `pointerdown` that started it to the
 *         first paint of the new route's main content, i.e. the paint after the
 *         page's own skeleton (`aria-busy="true"`) is gone AND the route's RSC
 *         response has fully arrived. Breakdown: server = until the RSC answer's
 *         first byte · download = the RSC answer arriving · render = the rest.
 *   Each view also carries its slowest interaction (INP-style) and longest
 *   main-thread task, until the next view starts.
 *
 * WHAT IS SENT: the route with ids blanked (`normalizePath` — the ingest then
 * names it by its route pattern), milliseconds, device class, connection type.
 * NEVER a URL, a query string, an id, a token or anything a person typed. The
 * build SHA and the signed-in flag are stamped by the server.
 *
 * WHEN: a load ≥ 1 s always (every admin target is ≥ 1 s); ~1 in 10 faster
 * ones (weight 10, so the percentiles stay honest). Batched, flushed when the
 * page hides and once a minute; at most MAX_LOADS_PER_PAGE per page lifetime.
 */

import { normalizePath } from '@/lib/telemetry/fault-normalize';
import {
  MAX_LOADS_PER_BATCH,
  MAX_LOADS_PER_PAGE,
  NAV_CAP_MS,
  deviceClass,
  sendWeight,
  type Connection,
  type DeviceClass,
  type LoadOutcome,
  type WireLoad,
} from '@/lib/telemetry/load-timing';

const INGEST = '/api/telemetry/client-fault';
/** A pointerdown this recent started the move (a tap on a button that calls router.push). */
const TAP_WINDOW_MS = 1_000;
/** A tap on a LINK to the destination counts even if the router took this long to move. */
const LINK_TAP_WINDOW_MS = 10_000;
/** The page must be quiet (no new nodes) this long before the content counts as painted. */
const SETTLE_MS = 120;

type Win = Window & typeof globalThis & { __snLoadReporter?: boolean };

/** A measured view, before the device fields and the weight are added. */
type View = Omit<WireLoad, 'weight' | 'device' | 'connection'>;

type Pending = {
  kind: 'nav';
  t0: number;
  path: string;
  route: string;
  rscEntry: PerformanceResourceTiming | null;
  lastMutAt: number;
  lastPaintAt: number;
  timer: number;
  mo: MutationObserver | null;
};

/** The reporter's whole job, split out pure so the tests drive it: a finished view → a wire row, or null (not sent). */
export function toWire(
  v: View,
  env: { device: DeviceClass; connection: Connection | null; rand: number },
): WireLoad | null {
  const weight = sendWeight(v.total_ms, env.rand);
  if (weight === null) return null;
  return { ...v, device: env.device, connection: env.connection, weight };
}

/** Navigation Timing (+ LCP/FCP) → a page load, or null when there is nothing honest to say. */
export function pageLoadFrom(
  nav: Pick<
    PerformanceNavigationTiming,
    'responseStart' | 'responseEnd' | 'domContentLoadedEventEnd' | 'loadEventEnd' | 'loadEventStart'
  > & { activationStart?: number },
  paint: { lcp: number | null; fcp: number | null },
): Omit<WireLoad, 'weight' | 'device' | 'connection' | 'route' | 'kind' | 'outcome'> | null {
  const a = nav.activationStart && nav.activationStart > 0 ? nav.activationStart : 0;
  const rel = (t: number | null | undefined) => (t && t > 0 ? Math.max(0, t - a) : null);
  const ttfb = rel(nav.responseStart);
  const resEnd = rel(nav.responseEnd);
  const dcl = rel(nav.domContentLoadedEventEnd);
  const load = rel(nav.loadEventEnd) ?? rel(nav.loadEventStart);
  const lcp = rel(paint.lcp);
  const fcp = rel(paint.fcp);
  const shown = lcp ?? fcp ?? dcl;
  if (shown === null || ttfb === null) return null;
  const total = Math.max(shown, resEnd ?? 0);
  return {
    total_ms: Math.round(total),
    server_ms: Math.round(ttfb),
    download_ms: resEnd !== null ? Math.round(Math.max(0, resEnd - ttfb)) : null,
    render_ms: resEnd !== null ? Math.round(Math.max(0, total - resEnd)) : null,
    ttfb_ms: Math.round(ttfb),
    dcl_ms: dcl !== null ? Math.round(dcl) : null,
    load_ms: load !== null ? Math.round(load) : null,
    lcp_ms: lcp !== null ? Math.round(lcp) : null,
  };
}

/** An in-app move's breakdown from its RSC answer (null entry = it was already on the phone). */
export function navBreakdown(
  t0: number,
  end: number,
  rsc: Pick<PerformanceResourceTiming, 'startTime' | 'responseStart' | 'responseEnd'> | null,
): { total_ms: number; server_ms: number | null; download_ms: number | null; render_ms: number } {
  const total = Math.max(0, end - t0);
  if (!rsc || !(rsc.responseEnd > 0)) {
    return { total_ms: Math.round(total), server_ms: null, download_ms: null, render_ms: Math.round(total) };
  }
  const first = rsc.responseStart > 0 ? rsc.responseStart : rsc.responseEnd;
  const server = Math.max(0, first - t0);
  const download = Math.max(0, rsc.responseEnd - first);
  return {
    total_ms: Math.round(total),
    server_ms: Math.round(Math.min(server, total)),
    download_ms: Math.round(Math.min(download, Math.max(0, total - server))),
    render_ms: Math.round(Math.max(0, total - server - download)),
  };
}

export function installLoadReporter(win: Win = window as Win): void {
  try {
    install(win);
  } catch {
    /* a measurement must never break the page */
  }
}

function install(win: Win): void {
  if (win.__snLoadReporter) return;
  win.__snLoadReporter = true;
  const doc = win.document;
  const perf = win.performance;
  if (!perf || typeof perf.now !== 'function') return;
  const loc = win.location;
  const origFetch = win.fetch.bind(win);

  const nav = win.navigator as Navigator & { connection?: { effectiveType?: string } };
  const env = () => {
    let coarse = false;
    try {
      coarse = win.matchMedia('(pointer: coarse)').matches;
    } catch {
      /* no matchMedia */
    }
    const eff = nav.connection?.effectiveType;
    return {
      device: deviceClass(Math.min(win.screen?.width || 0, win.screen?.height || 0), coarse),
      connection: (eff === 'slow-2g' || eff === '2g' || eff === '3g' || eff === '4g' ? eff : null) as Connection | null,
      rand: Math.random(),
    };
  };

  // ── sending: batched, beaconed, bounded ──
  const queue: WireLoad[] = [];
  let budget = MAX_LOADS_PER_PAGE;
  function enqueue(v: View): void {
    if (budget <= 0) return;
    const w = toWire(v, env());
    if (!w) return;
    budget -= 1;
    queue.push(w);
  }
  function flush(): void {
    while (queue.length) {
      const body = JSON.stringify({ loads: queue.splice(0, MAX_LOADS_PER_BATCH) });
      try {
        const blob = new Blob([body], { type: 'application/json' });
        if (!(win.navigator.sendBeacon && win.navigator.sendBeacon(INGEST, blob))) {
          void origFetch(INGEST, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
        }
      } catch {
        /* a dropped batch is acceptable; a thrown flush is not */
      }
    }
  }

  // ── what each view accumulates until the next one starts: slowest interaction, longest task ──
  let inp = 0;
  let longTask = 0;
  let sawInp = false;
  let sawLong = false;
  let lcp: number | null = null;
  const observe = (type: string, opts: Record<string, unknown>, cb: (e: PerformanceEntry) => void) => {
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) cb(e);
      });
      po.observe({ type, buffered: true, ...opts } as PerformanceObserverInit);
    } catch {
      /* this browser does not have it — the field stays null */
    }
  };
  observe('event', { durationThreshold: 40 }, (e) => {
    if ((e as PerformanceEventTiming).interactionId) {
      sawInp = true;
      inp = Math.max(inp, e.duration);
    }
  });
  observe('longtask', {}, (e) => {
    sawLong = true;
    longTask = Math.max(longTask, e.duration);
  });
  observe('largest-contentful-paint', {}, (e) => {
    lcp = e.startTime;
  });
  function takeView(): Pick<WireLoad, 'inp_ms' | 'long_task_ms'> {
    const out = { inp_ms: sawInp ? Math.round(inp) : null, long_task_ms: sawLong ? Math.round(longTask) : null };
    inp = 0;
    longTask = 0;
    sawInp = false;
    sawLong = false;
    return out;
  }

  // The view on screen: measured, still collecting its interactions until the next view starts.
  let open: View | null = null;
  function closeOpen(): void {
    const v = open;
    open = null;
    if (!v) {
      takeView(); // interactions with no view of their own belong to no one
      return;
    }
    if (v.kind === 'page') {
      // LCP stops at the first input or hide, so it is final now: re-read it.
      const timing = pageTiming();
      enqueue({ ...v, ...(timing ?? {}), ...takeView() });
    } else {
      enqueue({ ...v, ...takeView() });
    }
  }

  // ── the full page load ──
  function pageTiming() {
    const entry = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return null;
    const fcp = perf.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    return pageLoadFrom(entry, { lcp, fcp });
  }
  const startedHidden = doc.visibilityState === 'hidden';
  let movedBeforeLoad = false;
  function capturePage(): void {
    // A tab opened in the background waited on nothing a person saw; a page left before it loaded is a 'nav'.
    if (startedHidden || movedBeforeLoad) return;
    const timing = pageTiming();
    if (timing) open = { kind: 'page', route: normalizePath(loc.pathname), outcome: 'painted', ...timing };
  }
  if (doc.readyState === 'complete') capturePage();
  else win.addEventListener('load', () => win.setTimeout(capturePage, 0), { once: true });

  // ── in-app moves ──
  // RSC requests the router makes for a MOVE (not a prefetch, not a Server Action), until their bytes are in.
  const rscInflight = new Set<string>();
  let pending: Pending | null = null;
  let lastTap: { t: number; path: string | null } | null = null;
  let currentPath = loc.pathname;

  const pathOf = (href: string) => {
    try {
      return new URL(href).pathname;
    } catch {
      return '';
    }
  };

  observe('resource', {}, (e) => {
    if (!rscInflight.delete(e.name)) return;
    const p = pending;
    if (p && pathOf(e.name) === p.path) p.rscEntry ??= e as PerformanceResourceTiming;
  });

  doc.addEventListener(
    'pointerdown',
    (e) => {
      let path: string | null = null;
      try {
        const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
        if (a instanceof HTMLAnchorElement) {
          const u = new URL(a.href, loc.href);
          if (u.origin === loc.origin) path = u.pathname;
        }
      } catch {
        /* unparsable href */
      }
      lastTap = { t: e.timeStamp, path };
    },
    { capture: true, passive: true },
  );

  win.fetch = function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = origFetch(input as RequestInfo, init);
    try {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (headers.get('rsc') && !headers.get('next-router-prefetch') && !headers.get('next-action')) {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const href = new URL(raw, loc.href).href;
        rscInflight.add(href);
        res.catch(() => rscInflight.delete(href)); // aborted: no timing entry will come
        win.setTimeout(() => rscInflight.delete(href), NAV_CAP_MS); // never wait on it forever
      }
    } catch {
      /* observe nothing */
    }
    return res;
  } as typeof fetch;

  function stamp(p: Pending): void {
    win.requestAnimationFrame(() =>
      win.setTimeout(() => {
        if (pending === p) p.lastPaintAt = perf.now();
      }, 0),
    );
  }

  function endNav(p: Pending, outcome: LoadOutcome, at: number): void {
    win.clearInterval(p.timer);
    p.mo?.disconnect();
    if (pending === p) pending = null;
    const v: View = {
      kind: 'nav',
      route: p.route,
      outcome,
      ...navBreakdown(p.t0, outcome === 'painted' ? p.lastPaintAt : at, p.rscEntry),
    };
    if (outcome === 'painted') open = v; // on screen now: its interactions are still to come
    else enqueue({ ...v, ...takeView() });
  }

  function startNav(at: number): void {
    const path = loc.pathname;
    if (path === currentPath) return; // a query or a #section, not a new page
    currentPath = path;
    if (doc.readyState !== 'complete') movedBeforeLoad = true;
    const now = perf.now();
    if (pending) endNav(pending, 'left', now); // they moved on before it painted
    closeOpen();
    const tap = lastTap;
    const t0 =
      tap && ((tap.path === path && now - tap.t < LINK_TAP_WINDOW_MS) || now - tap.t < TAP_WINDOW_MS) ? tap.t : at;
    lastTap = null;
    const p: Pending = {
      kind: 'nav',
      t0,
      path,
      route: normalizePath(path),
      rscEntry: null,
      lastMutAt: now,
      lastPaintAt: now,
      timer: 0,
      mo: null,
    };
    // The router may have finished this page's RSC answer before it moved the address bar: claim it.
    try {
      for (const e of perf.getEntriesByType('resource') as PerformanceResourceTiming[]) {
        if (e.startTime >= t0 - 5 && /[?&]_rsc=/.test(e.name) && pathOf(e.name) === path) p.rscEntry ??= e;
      }
    } catch {
      /* no resource timing */
    }
    pending = p;
    try {
      p.mo = new MutationObserver(() => {
        p.lastMutAt = perf.now();
        stamp(p);
      });
      p.mo.observe(doc.body, { childList: true, subtree: true });
    } catch {
      /* no observer — the first paint after the move is the answer */
    }
    stamp(p);
    p.timer = win.setInterval(() => {
      const t = perf.now();
      if (t - p.t0 >= NAV_CAP_MS) return endNav(p, 'cap', t);
      for (const href of rscInflight) if (pathOf(href) === p.path) return; // its answer is still arriving
      if (doc.querySelector('[aria-busy="true"]')) return; // its skeleton is still up
      if (t - p.lastMutAt < SETTLE_MS) return; // still drawing
      endNav(p, 'painted', t);
    }, 50);
  }

  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = win.history[m].bind(win.history);
    win.history[m] = function timed(...args: Parameters<History['pushState']>) {
      const r = orig(...args);
      try {
        startNav(perf.now());
      } catch {
        /* never surface */
      }
      return r;
    } as History['pushState'];
  }
  win.addEventListener('popstate', (e) => {
    try {
      startNav(e.timeStamp);
    } catch {
      /* never surface */
    }
  });

  // ── leaving: finish what is open, send everything ──
  const onHide = () => {
    try {
      if (pending) endNav(pending, 'left', perf.now());
      closeOpen();
      flush();
    } catch {
      /* never surface */
    }
  };
  win.addEventListener('pagehide', onHide);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') onHide();
  });
  win.setInterval(flush, 60_000);
}
