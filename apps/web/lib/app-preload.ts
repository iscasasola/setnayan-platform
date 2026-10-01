/**
 * ⚡ THE ONE PRELOAD — the code a signed-in person will tap next, fetched while
 * the phone has nothing else to do.
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT
 * AFTER IT OPENS — EVERY TAP IS INSTANT", "A HOST'S WHOLE APP LOADS ONCE, IN
 * THE BACKGROUND…" and "THE PRELOAD FOLLOWS WHAT THE ACCOUNT HAS"): *"can you
 * download the whole maker once it loads?"* · *"when someone logs in, it has
 * their events, and their shop."*
 *
 * This file is the MECHANISM and only the mechanism — no place, page or tool is
 * named here. Its two callers hand it jobs:
 *   · the Maker (`launch/_components/maker-tools.tsx`, its registry of tool
 *     panels) — first in line, with a progress line under its top bar;
 *   · the signed-in shell (`app/_components/app-preload.tsx`) — the host app
 *     and/or the supplier app, by what the account has.
 * Both share ONE queue, so they never download the same thing twice and never
 * compete with each other (a page already open in the Maker goes first).
 *
 * The rules, each held by `app-preload.test.ts`:
 *   · it starts only once the page has LOADED, and each job waits for an IDLE
 *     moment (`requestIdleCallback`, a short timer where there is none) — the
 *     first paint and every tap come first;
 *   · ONE job at a time, in order: a tap in between is never queued behind a
 *     dozen parses — and a tap holds the next job back for a moment
 *     (`TAP_HOLD_MS`), so what was just asked for has the network to itself;
 *   · NOTHING when the phone asked to save data (`navigator.connection
 *     .saveData`) — every tool then loads when tapped, as before, and no
 *     progress is reported (the line stays hidden);
 *   · a job is done once per page: a key that has loaded is never asked again;
 *     a key that FAILED is dropped from the done set, so a later preload (or
 *     the tap itself) asks again;
 *   · a caller's progress reaches its total ONLY when every one of its jobs has
 *     loaded — a failure leaves it short, and `finished` says the queue is
 *     through with it either way.
 */

export type PreloadJob = {
  /** Unique per thing loaded — two callers asking for the same key share one load. */
  readonly key: string;
  readonly load: () => Promise<unknown> | void;
};

export type PreloadEnv = {
  saveData: boolean;
  /** Runs `cb` once the page has loaded (at once if it already has). */
  afterLoad: (cb: () => void) => void;
  /** Runs `cb` when the main thread is idle. */
  whenIdle: (cb: () => void) => void;
};

export type PreloadProgress = {
  /** Jobs of this caller that have loaded. */
  loaded: number;
  total: number;
  /** Every job of this caller has been tried (loaded or failed). */
  finished: boolean;
};

/** 0…1 for a progress line — reaches 1 ONLY when every job has loaded. */
export function preloadFraction(p: PreloadProgress): number {
  return p.total === 0 ? 0 : p.loaded / p.total;
}

type Entry = { job: PreloadJob; listeners: Set<() => void> };

export type Preloader = {
  /**
   * Queue `jobs` (deduplicated by key). `first` puts them ahead of whatever is
   * waiting. `onProgress` hears this caller's progress — never when skipped.
   * Returns a function that stops listening (queued jobs still run).
   */
  preload: (jobs: readonly PreloadJob[], opts?: { first?: boolean; onProgress?: (p: PreloadProgress) => void }) => () => void;
  /** For tests: what has loaded, by key. */
  loadedKeys: () => ReadonlySet<string>;
};

export function createPreloader(env: PreloadEnv): Preloader {
  const loaded = new Set<string>();
  const failed = new Set<string>();
  const queued = new Map<string, Entry>();
  const order: string[] = [];
  let started = false;
  let running = false;

  const pump = () => {
    if (running || !started) return;
    const key = order.shift();
    if (key === undefined) return;
    const entry = queued.get(key);
    if (!entry) return pump();
    running = true;
    env.whenIdle(() => {
      const settle = (ok: boolean) => {
        queued.delete(key);
        (ok ? loaded : failed).add(key);
        running = false;
        for (const l of entry.listeners) l();
        pump();
      };
      let p: Promise<unknown> | void;
      try {
        p = entry.job.load();
      } catch {
        return settle(false);
      }
      Promise.resolve(p).then(
        () => settle(true),
        () => settle(false),
      );
    });
  };

  return {
    preload(jobs, opts = {}) {
      if (env.saveData || jobs.length === 0) return () => {};
      const keys = [...new Set(jobs.map((j) => j.key))];
      const report = () =>
        opts.onProgress?.({
          loaded: keys.filter((k) => loaded.has(k)).length,
          total: keys.length,
          finished: keys.every((k) => loaded.has(k) || (failed.has(k) && !queued.has(k))),
        });
      const fresh: string[] = [];
      for (const job of jobs) {
        if (loaded.has(job.key)) continue;
        let entry = queued.get(job.key);
        if (!entry) {
          failed.delete(job.key);
          entry = { job, listeners: new Set() };
          queued.set(job.key, entry);
          fresh.push(job.key);
        } else if (opts.first) {
          // Already waiting: move it up with the rest of this caller's jobs.
          const i = order.indexOf(job.key);
          if (i >= 0) {
            order.splice(i, 1);
            fresh.push(job.key);
          }
        }
        entry.listeners.add(report);
      }
      if (opts.first) order.unshift(...fresh);
      else order.push(...fresh);
      report();
      env.afterLoad(() => {
        started = true;
        pump();
      });
      return () => {
        for (const k of keys) queued.get(k)?.listeners.delete(report);
      };
    },
    loadedKeys: () => loaded,
  };
}

/** The browser's own environment — read when first used, never at import. */
export function browserPreloadEnv(): PreloadEnv {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  /* A tap holds the queue for a moment: what the person just asked for gets the
     phone's network to itself before the next background job starts. */
  let lastTap = 0;
  window.addEventListener('pointerdown', () => (lastTap = Date.now()), { capture: true, passive: true });
  const idle = (cb: () => void) => {
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 2000 });
    else window.setTimeout(cb, 120);
  };
  return {
    saveData: conn?.saveData === true,
    afterLoad(cb) {
      if (document.readyState === 'complete') cb();
      else window.addEventListener('load', () => cb(), { once: true });
    },
    whenIdle(cb) {
      const go = () => {
        const wait = lastTap + TAP_HOLD_MS - Date.now();
        if (wait > 0) window.setTimeout(() => idle(go), wait);
        else cb();
      };
      idle(go);
    },
  };
}

/** How long a tap keeps the background queue from starting its next job. */
export const TAP_HOLD_MS = 1500;

let shared: Preloader | null = null;
/** The page's one queue (both callers share it). Browser only. */
export function appPreloader(): Preloader {
  if (!shared) shared = createPreloader(browserPreloadEnv());
  return shared;
}

/**
 * The chunk files a page's RSC payload names (its client components' code), as
 * `/_next/static/chunks/…` paths, each once, in order. The payload names them
 * as `"static/chunks/<file>.js"` inside its module rows.
 */
export function routeChunkUrls(payload: string): string[] {
  const out = new Set<string>();
  for (const m of payload.matchAll(/"(static\/chunks\/[A-Za-z0-9_.\-\/\[\]%]+?\.js)"/g)) out.add(`/_next/${m[1]}`);
  return [...out];
}
