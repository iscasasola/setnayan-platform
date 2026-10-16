/**
 * THE LOAD-TIME LOG · the PURE half — what a load is, when one is sent, what a
 * page's target is, and how the admin's numbers are computed from the rows.
 *
 * Owner 2026-10-16: "can we make a page on admin that will log the loading time
 * of each load done? or when a loading takes more that 1.5 seconds to load then
 * it will be logged or when it load longer than its target loading time?"
 *
 * Pure: no imports from the browser or the server, so the browser reporter
 * (`load-reporter.ts`, a lazy chunk), the ingest (`ingest-shape.ts`), the admin
 * read (`load-timing.server.ts`) and the tests all share ONE copy of each rule.
 *
 *   SEND      a load ≥ ALWAYS_SEND_MS is ALWAYS sent (weight 1); a faster one is
 *             sent about 1 in 10 (weight 10), so percentiles stay unbiased. An
 *             admin target can never go below ALWAYS_SEND_MS, so EVERY load over
 *             ITS page's target reaches the table.
 *   TARGET    a page's override from platform_settings.load_time_targets, else
 *             DEFAULT_TARGET_MS (1.5 s). Judged when READ, so a changed target
 *             re-judges the history. Held by `the-load-time-log.test.ts`.
 *   ROUTE     a route PATTERN (`/dashboard/[eventId]/guests`), never a URL.
 */

/** The owner's number: a page that takes longer than this is slow unless it has its own target. */
export const DEFAULT_TARGET_MS = 1500;
/** Every load at or above this is sent; below it, ~1 in SAMPLE_WEIGHT is. */
export const ALWAYS_SEND_MS = 1000;
/** An admin target is clamped to this range — never below what is always sent. */
export const TARGET_MIN_MS = ALWAYS_SEND_MS;
export const TARGET_MAX_MS = 30_000;
/** A fast load is sent with probability 1/SAMPLE_WEIGHT and stands for SAMPLE_WEIGHT loads. */
export const SAMPLE_WEIGHT = 10;
/** An in-app move still not painted after this is recorded as 'cap'. */
export const NAV_CAP_MS = 20_000;
/** At most this many loads per ingest call (the RPC takes 20 too). */
export const MAX_LOADS_PER_BATCH = 20;
/** At most this many loads per page lifetime — a loop must not become a flood. */
export const MAX_LOADS_PER_PAGE = 40;
/** How long the log keeps a row (record_load_timings trims). */
export const RETENTION_DAYS = 30;

export type LoadKind = 'page' | 'nav';
export type LoadOutcome = 'painted' | 'left' | 'cap';
export type DeviceClass = 'phone' | 'tablet' | 'desktop';
export const CONNECTIONS = ['slow-2g', '2g', '3g', '4g'] as const;
export type Connection = (typeof CONNECTIONS)[number];

/** One load as the browser sends it. `route` is already id-free (normalizePath). */
export type WireLoad = {
  kind: LoadKind;
  route: string;
  total_ms: number;
  server_ms?: number | null;
  download_ms?: number | null;
  render_ms?: number | null;
  ttfb_ms?: number | null;
  dcl_ms?: number | null;
  load_ms?: number | null;
  lcp_ms?: number | null;
  inp_ms?: number | null;
  long_task_ms?: number | null;
  outcome: LoadOutcome;
  device: DeviceClass;
  connection?: Connection | null;
  weight: number;
};

const MS_FIELDS = [
  'server_ms',
  'download_ms',
  'render_ms',
  'ttfb_ms',
  'dcl_ms',
  'load_ms',
  'lcp_ms',
  'inp_ms',
  'long_task_ms',
] as const;

/**
 * Send this load, and with what weight? `rand` is Math.random() (passed in so
 * the tests drive both branches). null = do not send.
 */
export function sendWeight(totalMs: number, rand: number): number | null {
  if (!Number.isFinite(totalMs) || totalMs < 0) return null;
  if (totalMs >= ALWAYS_SEND_MS) return 1;
  return rand < 1 / SAMPLE_WEIGHT ? SAMPLE_WEIGHT : null;
}

/** phone / tablet / desktop from the screen's short side and the pointer. */
export function deviceClass(shortSidePx: number, coarsePointer: boolean): DeviceClass {
  if (shortSidePx > 0 && shortSidePx < 600) return 'phone';
  if (coarsePointer && shortSidePx < 1100) return 'tablet';
  return 'desktop';
}

/** A millisecond figure the table accepts, or null. */
export function ms(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(120_000, Math.round(n));
}

/** A target as an admin may set it: whole ms within [TARGET_MIN_MS, TARGET_MAX_MS], else null. */
export function clampTarget(v: unknown): number | null {
  const n = ms(v);
  if (n === null || n === 0) return null;
  return Math.max(TARGET_MIN_MS, Math.min(TARGET_MAX_MS, n));
}

/** platform_settings.load_time_targets as stored → only the entries that are valid. */
export function coerceTargets(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [route, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof route !== 'string' || !route.startsWith('/') || route.length > 200) continue;
    const t = clampTarget(v);
    if (t !== null) out[route] = t;
  }
  return out;
}

/** The target a page is judged against: its override, else the 1.5 s default. */
export function targetFor(route: string, targets: Readonly<Record<string, number>> | null | undefined): number {
  const t = targets && Object.prototype.hasOwnProperty.call(targets, route) ? clampTarget(targets[route]) : null;
  return t ?? DEFAULT_TARGET_MS;
}

/**
 * A browser's `{ loads: [...] }` → rows record_load_timings accepts. The route
 * is re-mapped HERE to a route pattern (`toPattern`, the app's own route list)
 * whatever the browser sent; anything malformed is dropped, never stored.
 */
export function loadsFromWire(raw: unknown, toPattern: (path: string) => string | null): WireLoad[] {
  if (!Array.isArray(raw)) return [];
  const out: WireLoad[] = [];
  for (const item of raw.slice(0, MAX_LOADS_PER_BATCH)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const kind = r.kind === 'page' || r.kind === 'nav' ? r.kind : null;
    const route = typeof r.route === 'string' ? toPattern(r.route) : null;
    const total = ms(r.total_ms);
    const device = r.device === 'phone' || r.device === 'tablet' || r.device === 'desktop' ? r.device : null;
    if (!kind || !route || total === null || !device) continue;
    const outcome: LoadOutcome = r.outcome === 'left' || r.outcome === 'cap' ? r.outcome : 'painted';
    const connection = (CONNECTIONS as readonly unknown[]).includes(r.connection) ? (r.connection as Connection) : null;
    const w = Math.round(Number(r.weight));
    const weight = Number.isFinite(w) ? Math.max(1, Math.min(100, w)) : 1;
    const row: WireLoad = { kind, route, total_ms: total, outcome, device, connection, weight };
    for (const f of MS_FIELDS) row[f] = ms(r[f]);
    out.push(row);
  }
  return out;
}

// ── the admin's numbers ──────────────────────────────────────────────────────

/** One stored row, as the admin read selects it. */
export type LoadRow = {
  created_at: string;
  kind: LoadKind;
  route: string;
  total_ms: number;
  server_ms: number | null;
  download_ms: number | null;
  render_ms: number | null;
  lcp_ms: number | null;
  inp_ms: number | null;
  outcome: LoadOutcome;
  device: DeviceClass;
  connection: string | null;
  signed_in: boolean;
  build_sha: string | null;
  weight: number;
};

/**
 * The weighted p-th percentile (0..1) — each value counts `w` times. A sampled
 * fast load stands for 10, so a slow-heavy table does not read slower than the
 * real traffic. null when there is nothing to read.
 */
export function weightedPercentile(values: ReadonlyArray<{ v: number; w: number }>, p: number): number | null {
  const xs = values.filter((x) => Number.isFinite(x.v) && x.w > 0).sort((a, b) => a.v - b.v);
  if (xs.length === 0) return null;
  const total = xs.reduce((s, x) => s + x.w, 0);
  const rank = p * total;
  let acc = 0;
  for (const x of xs) {
    acc += x.w;
    if (acc >= rank) return x.v;
  }
  return xs[xs.length - 1]!.v;
}

export type PageLoadStats = {
  route: string;
  target: number;
  /** true when the target came from an admin override. */
  targetSet: boolean;
  /** Rows measured (the honest-empty floor counts these). */
  n: number;
  /** Loads those rows stand for (sampled rows count SAMPLE_WEIGHT). */
  loads: number;
  p50: number | null;
  p95: number | null;
  /** Share of loads over the target (weighted), or null below the floor. */
  overPct: number | null;
  /** p50 on the newest build vs the build before it; null when either is below the floor. */
  trend: { current: number; previous: number; pct: number } | null;
};

export type LoadTimeSummary = {
  pages: PageLoadStats[];
  /** Loads over their page's target, newest first. */
  slow: Array<LoadRow & { target: number }>;
  /** All pages together — the overview card. */
  overall: { n: number; loads: number; p50: number | null; p95: number | null; overPct: number | null };
  vitals: { lcpP75: number | null; lcpN: number; inpP75: number | null; inpN: number };
  currentBuild: string | null;
  previousBuild: string | null;
};

/**
 * Rows + targets → everything the Slow loads tab and the overview card show.
 * `minN` is the cockpit's honest-empty floor (MIN_N): below it a percentile is
 * null, never a number from three loads.
 */
export function summarizeLoads(
  rows: ReadonlyArray<LoadRow>,
  targets: Readonly<Record<string, number>>,
  opts: { minN: number; slowLimit?: number },
): LoadTimeSummary {
  const { minN } = opts;
  const slowLimit = opts.slowLimit ?? 50;

  // Builds in the order they were last seen: newest first.
  const lastSeen = new Map<string, string>();
  for (const r of rows) {
    if (!r.build_sha) continue;
    const prev = lastSeen.get(r.build_sha);
    if (!prev || r.created_at > prev) lastSeen.set(r.build_sha, r.created_at);
  }
  const builds = [...lastSeen.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([sha]) => sha);
  const currentBuild = builds[0] ?? null;
  const previousBuild = builds[1] ?? null;

  const byRoute = new Map<string, LoadRow[]>();
  for (const r of rows) {
    const list = byRoute.get(r.route) ?? [];
    list.push(r);
    byRoute.set(r.route, list);
  }
  // A page with a target set but no loads yet still gets a row — the admin can see and clear it.
  for (const route of Object.keys(targets)) if (!byRoute.has(route)) byRoute.set(route, []);

  const p50Of = (list: LoadRow[]) =>
    list.length >= minN ? weightedPercentile(list.map((r) => ({ v: r.total_ms, w: r.weight })), 0.5) : null;

  const pages: PageLoadStats[] = [];
  for (const [route, list] of byRoute) {
    const target = targetFor(route, targets);
    const n = list.length;
    const loads = list.reduce((s, r) => s + r.weight, 0);
    const vals = list.map((r) => ({ v: r.total_ms, w: r.weight }));
    const over = list.reduce((s, r) => s + (r.total_ms > target ? r.weight : 0), 0);
    let trend: PageLoadStats['trend'] = null;
    if (currentBuild && previousBuild) {
      const cur = p50Of(list.filter((r) => r.build_sha === currentBuild));
      const prev = p50Of(list.filter((r) => r.build_sha === previousBuild));
      if (cur !== null && prev !== null && prev > 0) trend = { current: cur, previous: prev, pct: (cur - prev) / prev };
    }
    pages.push({
      route,
      target,
      targetSet: Object.prototype.hasOwnProperty.call(targets, route),
      n,
      loads,
      p50: n >= minN ? weightedPercentile(vals, 0.5) : null,
      p95: n >= minN ? weightedPercentile(vals, 0.95) : null,
      overPct: n >= minN && loads > 0 ? over / loads : null,
      trend,
    });
  }
  // Worst first: the most loads over target, then the busiest.
  pages.sort((a, b) => (b.overPct ?? -1) - (a.overPct ?? -1) || b.loads - a.loads || a.route.localeCompare(b.route));

  const slow = rows
    .map((r) => ({ ...r, target: targetFor(r.route, targets) }))
    .filter((r) => r.total_ms > r.target)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, slowLimit);

  const allVals = rows.map((r) => ({ v: r.total_ms, w: r.weight }));
  const allLoads = rows.reduce((s, r) => s + r.weight, 0);
  const allOver = rows.reduce((s, r) => s + (r.total_ms > targetFor(r.route, targets) ? r.weight : 0), 0);
  const lcp = rows.filter((r) => r.kind === 'page' && r.lcp_ms !== null).map((r) => ({ v: r.lcp_ms as number, w: r.weight }));
  const inp = rows.filter((r) => r.inp_ms !== null).map((r) => ({ v: r.inp_ms as number, w: r.weight }));

  return {
    pages,
    slow,
    overall: {
      n: rows.length,
      loads: allLoads,
      p50: rows.length >= minN ? weightedPercentile(allVals, 0.5) : null,
      p95: rows.length >= minN ? weightedPercentile(allVals, 0.95) : null,
      overPct: rows.length >= minN && allLoads > 0 ? allOver / allLoads : null,
    },
    vitals: {
      lcpP75: lcp.length >= minN ? weightedPercentile(lcp, 0.75) : null,
      lcpN: lcp.length,
      inpP75: inp.length >= minN ? weightedPercentile(inp, 0.75) : null,
      inpN: inp.length,
    },
    currentBuild,
    previousBuild,
  };
}

/** "1.62 s" / "840 ms" — one way of writing a wait, everywhere. */
export function formatMs(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}
