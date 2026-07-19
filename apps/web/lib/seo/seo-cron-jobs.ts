import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSeoHealthChecks, type CatalogRow } from '@/lib/seo/health-checks';
import { gscConfigured, pullSearchConsole } from '@/lib/seo/search-console';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';

/**
 * CRON-FREE SEO jobs — the daily SEO health audit + Google Search Console pull,
 * extracted verbatim from the retired /api/cron/seo-{health,gsc} routes and now
 * driven by admin-layout `after()` traffic via the shared claim primitive.
 * Admin-consumed (both feed /admin/seo), so admin traffic is the right trigger;
 * a skipped day only leaves the dashboard a day stale (advisory data).
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

function orgSameAs(): string[] {
  return (process.env.SETNAYAN_ORG_SAMEAS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Daily SEO/GEO health audit → one seo_health_snapshots row. */
export async function runSeoHealthAudit(): Promise<{ ok: boolean; drift?: number }> {
  // Live AI-crawler surface (tests the real served file, not a repo copy).
  let llmsText = '';
  try {
    const res = await fetch(`${APP_URL}/llms.txt`, { cache: 'no-store' });
    if (res.ok) llmsText = await res.text();
  } catch {
    // fall through — an empty body makes prices look "missing", a visible fail.
  }

  const admin = createAdminClient();
  const [retailRes, vendorRes] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php')
      .eq('is_active', true),
    admin
      .from('vendor_billing_catalog')
      .select('sku_code, price_php')
      .eq('is_active', true),
  ]);
  const catalog: CatalogRow[] = [
    ...((retailRes.data ?? []) as { service_code: string; retail_price_php: number }[]).map((r) => ({
      sku_code: r.service_code,
      price_php: Number(r.retail_price_php),
      source: 'retail' as const,
    })),
    ...((vendorRes.data ?? []) as { sku_code: string; price_php: number }[]).map((r) => ({
      sku_code: r.sku_code,
      price_php: Number(r.price_php),
      source: 'vendor' as const,
    })),
  ];

  const result = runSeoHealthChecks({
    llmsText,
    catalog,
    env: {
      googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION,
      bingSiteVerification: process.env.BING_SITE_VERIFICATION,
      orgSameAs: orgSameAs(),
    },
  });

  const { error } = await admin.from('seo_health_snapshots').insert({
    ok_count: result.counts.ok,
    warn_count: result.counts.warn,
    fail_count: result.counts.fail,
    findings: result.findings,
    price_drift: result.priceDrift,
    generated_by: 'cron',
  });
  if (error) {
    console.error('[seo-health] snapshot insert failed:', error.message);
    return { ok: false };
  }
  return { ok: true, drift: result.priceDrift.length };
}

/** Daily Google Search Console pull → seo_metrics upsert (skips if unconfigured). */
export async function runSeoGscPull(): Promise<{ ok: boolean; days?: number; skipped?: string }> {
  if (!gscConfigured()) return { ok: true, skipped: 'gsc not configured' };

  let pull;
  try {
    pull = await pullSearchConsole(14);
  } catch (e) {
    console.error('[seo-gsc] pull failed:', e instanceof Error ? e.message : String(e));
    return { ok: false };
  }

  const admin = createAdminClient();
  const latestDate = pull.days.reduce<string | null>(
    (max, d) => (max === null || d.metricDate > max ? d.metricDate : max),
    null,
  );
  const rows = pull.days.map((d) => ({
    source: 'gsc' as const,
    metric_date: d.metricDate,
    clicks: d.clicks,
    impressions: d.impressions,
    ctr: d.ctr,
    avg_position: d.avgPosition,
    top_queries: d.metricDate === latestDate ? pull.topQueries : [],
    captured_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('seo_metrics')
    .upsert(rows, { onConflict: 'source,metric_date' });
  if (error) {
    console.error('[seo-gsc] metrics upsert failed:', error.message);
    return { ok: false };
  }
  return { ok: true, days: rows.length };
}

/**
 * Fire the SEO periodic jobs off admin-layout traffic. Each is claim-gated to
 * ~once/day; best-effort, never throws.
 */
export async function runSeoPeriodicJobs(): Promise<void> {
  try {
    if (await claimPeriodicJob('seo-health', DAILY_GAP_MS)) await runSeoHealthAudit();
  } catch {
    /* best-effort */
  }
  try {
    if (await claimPeriodicJob('seo-gsc', DAILY_GAP_MS)) await runSeoGscPull();
  } catch {
    /* best-effort */
  }
}
