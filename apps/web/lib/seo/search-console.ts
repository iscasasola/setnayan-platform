/**
 * Minimal Google Search Console (Search Analytics) pull — no googleapis dep.
 *
 * Uses an installed-app OAuth refresh token exchanged for a short-lived access
 * token, then queries the Search Analytics API. All four env vars must be set or
 * the pull is skipped (the cron no-ops cleanly) — this is owner action #1 in
 * SEO_GEO_UPDATE_2026-07-10.md §7: create the GSC property + paste creds.
 *
 *   GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REFRESH_TOKEN
 *   GSC_SITE_URL   e.g. "https://www.setnayan.com/" or "sc-domain:setnayan.com"
 */

export type GscDayRow = {
  metricDate: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
};

export type GscQueryRow = { query: string; clicks: number; impressions: number };

export type GscPull = { days: GscDayRow[]; topQueries: GscQueryRow[] };

export function gscConfigured(): boolean {
  return Boolean(
    process.env.GSC_CLIENT_ID &&
      process.env.GSC_CLIENT_SECRET &&
      process.env.GSC_REFRESH_TOKEN &&
      process.env.GSC_SITE_URL,
  );
}

async function accessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GSC_CLIENT_ID!,
      client_secret: process.env.GSC_CLIENT_SECRET!,
      refresh_token: process.env.GSC_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GSC token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('GSC token exchange returned no access_token');
  return json.access_token;
}

async function query(
  token: string,
  body: Record<string, unknown>,
): Promise<{ rows?: Array<{ keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }> }> {
  const site = encodeURIComponent(process.env.GSC_SITE_URL!);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`GSC query failed: ${res.status}`);
  return res.json();
}

/**
 * Pull the last `days` of daily totals + the window's top queries. GSC finalizes
 * data with a ~2-3 day lag, so re-pulling recent days (the cron upserts) is
 * expected and correct.
 */
export async function pullSearchConsole(days = 14): Promise<GscPull> {
  const token = await accessToken();

  // en-CA renders ISO YYYY-MM-DD; anchor the window to UTC (GSC reports in
  // Pacific but day granularity is coarse enough that UTC is fine here).
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [byDate, byQuery] = await Promise.all([
    query(token, { startDate: iso(start), endDate: iso(end), dimensions: ['date'], rowLimit: days + 2 }),
    query(token, { startDate: iso(start), endDate: iso(end), dimensions: ['query'], rowLimit: 25 }),
  ]);

  const dayRows: GscDayRow[] = (byDate.rows ?? []).map((r) => ({
    metricDate: r.keys?.[0] ?? iso(end),
    clicks: Math.round(r.clicks),
    impressions: Math.round(r.impressions),
    ctr: Number(r.ctr.toFixed(4)),
    avgPosition: Number(r.position.toFixed(2)),
  }));

  const topQueries: GscQueryRow[] = (byQuery.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? '',
    clicks: Math.round(r.clicks),
    impressions: Math.round(r.impressions),
  }));

  return { days: dayRows, topQueries };
}
