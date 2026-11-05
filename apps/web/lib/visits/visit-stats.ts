/**
 * VISITS · the shapes the Visits tab draws, and the pure arithmetic over them.
 * Pure (no `server-only`) so the lab and the tests can build one from fixtures.
 * The read is `visit-stats.server.ts`.
 *
 * 🔑 EVERY SECTION CARRIES ITS OWN `unread` FLAG. A refused read is not a day
 * with no visitors; the tab prints "Couldn't read …" where the number would
 * have been, never 0 (app/admin/admin-reads-say-couldnt-read.test.ts' rule).
 */

export type VisitDay = { day: string; views: number; visitors: number };
export type VisitPage = { path: string; views: number; visitors: number };
export type VisitSource = { source: string; utm_source: string; visitors: number };
export type VisitDeviceRow = { device: string; views: number; visitors: number };
export type VisitCountry = { country: string; visitors: number };

export type VisitSummary = {
  firstDay: string | null;
  days: VisitDay[];
  pages: VisitPage[];
  sources: VisitSource[];
  devices: VisitDeviceRow[];
  countries: VisitCountry[];
  signedInViews: number;
};

export type VisitStats = {
  sinceDay: string;
  untilDay: string;
  /** null = the visits read was refused. */
  summary: VisitSummary | null;
  /** null = that count was refused (never 0). */
  signUps: number | null;
  paidOrders: number | null;
  /** True for the lab / demo figures. */
  demo?: boolean;
};

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];

/** `site_visit_summary`'s JSON → the typed summary; null when it is not that shape. */
export function parseVisitSummary(raw: unknown): VisitSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.days)) return null;
  return {
    firstDay: typeof r.first_day === 'string' ? r.first_day : null,
    days: arr(r.days).map((d) => ({ day: str(d.day), views: n(d.views), visitors: n(d.visitors) })),
    pages: arr(r.pages).map((d) => ({ path: str(d.path), views: n(d.views), visitors: n(d.visitors) })),
    sources: arr(r.sources).map((d) => ({ source: str(d.source), utm_source: str(d.utm_source), visitors: n(d.visitors) })),
    devices: arr(r.devices).map((d) => ({ device: str(d.device), views: n(d.views), visitors: n(d.visitors) })),
    countries: arr(r.countries).map((d) => ({ country: str(d.country), visitors: n(d.visitors) })),
    signedInViews: n(r.signed_in_views),
  };
}

/** Every day from `since` to `until` inclusive (YYYY-MM-DD), missing days filled with 0. */
export function fillDays(days: VisitDay[], since: string, until: string): VisitDay[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const out: VisitDay[] = [];
  const end = Date.parse(`${until}T00:00:00Z`);
  for (let t = Date.parse(`${since}T00:00:00Z`); t <= end; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(by.get(day) ?? { day, views: 0, visitors: 0 });
  }
  return out;
}

export function totals(days: VisitDay[]): { views: number; visitors: number } {
  return days.reduce((s, d) => ({ views: s.views + d.views, visitors: s.visitors + d.visitors }), { views: 0, visitors: 0 });
}

/** A source row's words: utm_source wins when present, '' reads "Direct". */
export function sourceLabel(s: Pick<VisitSource, 'source' | 'utm_source'>): string {
  if (s.utm_source && s.source) return `${s.source} · ${s.utm_source}`;
  if (s.utm_source) return s.utm_source;
  return s.source || 'Direct or typed';
}

const DEVICE_WORD: Record<string, string> = { phone: 'Phone', tablet: 'Tablet', desktop: 'Computer' };
export function deviceLabel(d: string): string {
  return DEVICE_WORD[d] ?? d;
}

let regionNames: Intl.DisplayNames | null = null;
export function countryLabel(code: string): string {
  if (!code) return 'Unknown';
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A share 0..1 of a whole, or null when the whole is 0 (never a divide-by-zero 0%). */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** "YYYY-MM-DD" in Asia/Manila — the day the capture stamps. */
export function manilaDay(at: Date = new Date()): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Lab / demo figures — the SHAPE of the tab before real traffic accrues.
 * Deterministic (no Math.random), so a screenshot is reproducible.
 */
export function buildDemoVisitStats(days: number, until: string = manilaDay()): VisitStats {
  const since = addDays(until, -(days - 1));
  const series: VisitDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(since, i);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const trend = 40 + Math.round((i / days) * 70);
    const weekend = dow === 0 || dow === 6 ? 18 : 0;
    const wobble = ((i * 37) % 23) - 11;
    const visitors = Math.max(4, trend + weekend + wobble);
    series.push({ day, visitors, views: Math.round(visitors * (2.6 + ((i * 13) % 7) / 10)) });
  }
  const t = totals(series);
  return {
    sinceDay: since,
    untilDay: until,
    demo: true,
    signUps: Math.round(t.visitors * 0.031),
    paidOrders: Math.round(t.visitors * 0.004),
    summary: {
      firstDay: since,
      days: series,
      pages: [
        { path: '/', views: Math.round(t.views * 0.24), visitors: Math.round(t.visitors * 0.41) },
        { path: '/[slug]', views: Math.round(t.views * 0.19), visitors: Math.round(t.visitors * 0.22) },
        { path: '/explore', views: Math.round(t.views * 0.12), visitors: Math.round(t.visitors * 0.08) },
        { path: '/v/[slug]', views: Math.round(t.views * 0.09), visitors: Math.round(t.visitors * 0.07) },
        { path: '/[slug]/invite', views: Math.round(t.views * 0.07), visitors: Math.round(t.visitors * 0.06) },
        { path: '/pricing', views: Math.round(t.views * 0.05), visitors: Math.round(t.visitors * 0.03) },
        { path: '/for-suppliers', views: Math.round(t.views * 0.04), visitors: Math.round(t.visitors * 0.03) },
        { path: '/dashboard/[eventId]', views: Math.round(t.views * 0.04), visitors: Math.round(t.visitors * 0.02) },
        { path: '/login', views: Math.round(t.views * 0.03), visitors: Math.round(t.visitors * 0.02) },
        { path: '/features', views: Math.round(t.views * 0.02), visitors: Math.round(t.visitors * 0.01) },
      ],
      sources: [
        { source: '', utm_source: '', visitors: Math.round(t.visitors * 0.44) },
        { source: 'facebook.com', utm_source: '', visitors: Math.round(t.visitors * 0.21) },
        { source: 'google.com', utm_source: '', visitors: Math.round(t.visitors * 0.17) },
        { source: 'instagram.com', utm_source: 'ig', visitors: Math.round(t.visitors * 0.08) },
        { source: 'tiktok.com', utm_source: '', visitors: Math.round(t.visitors * 0.05) },
        { source: 'messenger.com', utm_source: '', visitors: Math.round(t.visitors * 0.03) },
      ],
      devices: [
        { device: 'phone', views: Math.round(t.views * 0.81), visitors: Math.round(t.visitors * 0.84) },
        { device: 'desktop', views: Math.round(t.views * 0.16), visitors: Math.round(t.visitors * 0.13) },
        { device: 'tablet', views: Math.round(t.views * 0.03), visitors: Math.round(t.visitors * 0.03) },
      ],
      countries: [
        { country: 'PH', visitors: Math.round(t.visitors * 0.86) },
        { country: 'US', visitors: Math.round(t.visitors * 0.05) },
        { country: 'AE', visitors: Math.round(t.visitors * 0.03) },
        { country: 'SG', visitors: Math.round(t.visitors * 0.02) },
        { country: 'CA', visitors: Math.round(t.visitors * 0.02) },
      ],
      signedInViews: Math.round(t.views * 0.22),
    },
  };
}
