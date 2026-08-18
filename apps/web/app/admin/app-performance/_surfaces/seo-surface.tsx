/**
 * Insights Studio surface — the body of the former /admin/seo page,
 * re-homed here (2026-07-10).
 *
 * ── Converted to <ConsoleTable> 2026-08-17 ─────────────────────────────────
 * Both reads on this surface used to report a refusal as an absence:
 *
 *   • the snapshot read fell through `snapRes.data ?? null` into "No health
 *     snapshot yet. …it'll populate within a few minutes", which tells the
 *     reader to WAIT for a screen that is never coming; and
 *   • the Search Console read fell through `?? []` into a tidy "no data yet"
 *     panel listing four environment variables to go and set — a remedy
 *     addressed to somebody whose read was actually being refused.
 *
 * Neither read throws when it is rejected: Supabase resolves with `{ error }`.
 * So both now keep NULL all the way to the render.
 *
 * ⚠ ZERO SEARCH-CONSOLE ROWS IS THE HONEST, EXPECTED STATE — measured in
 * production 2026-08-17: `seo_metrics` holds 0 rows while `seo_health_
 * snapshots` holds 33. The nightly pull has never delivered, so an empty table
 * here must read as "nothing has arrived", NOT as breakage — which is exactly
 * the distinction the empty state and the error state now draw apart.
 *
 * ⚠ THE `.limit(1)` ON THE SNAPSHOT IS NOT A LIST CAP — it is "the newest one",
 * and `cap` is deliberately not passed for it. Disclosing it would print
 * "showing the first 1, there are more" on every single load. The cap that IS
 * real is the 14-day Search Console window below.
 */
import { AlertTriangle, CheckCircle2, XCircle, Bot } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ErrorState } from '@/app/_components/states/error-state';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';
import type { HealthFinding, PriceDriftEntry, HealthStatus } from '@/lib/seo/health-checks';
import { SeoRerunButton } from './seo-rerun-button';

type Snapshot = {
  checked_at: string;
  ok_count: number;
  warn_count: number;
  fail_count: number;
  findings: HealthFinding[];
  price_drift: PriceDriftEntry[];
  generated_by: string;
};

type MetricRow = {
  metric_date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  top_queries: { query: string; clicks: number; impressions: number }[];
};

const STATUS_STYLE: Record<HealthStatus, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-600', label: 'OK' },
  warn: { icon: AlertTriangle, cls: 'text-amber-600', label: 'Warn' },
  fail: { icon: XCircle, cls: 'text-[color:var(--sn-danger)]', label: 'Fail' },
};

/**
 * The Search Console window, hoisted so the query, the heading and the cap
 * disclosure cannot drift. It used to be typed three separate times.
 */
const GSC_WINDOW_DAYS = 14;

/** The chip list under the table shows the busiest queries of the newest day. */
const TOP_QUERIES_SHOWN = 15;

export async function SeoSurface() {
  // The RLS-bypassing service-role client below must never run for a non-admin,
  // and a layout is not a safe auth boundary (council fix #1). The studio page
  // already gates; this states it in the file that holds the client, so
  // `readPermitted` is honestly true here and not true-by-inheritance.
  await requireAdmin();

  const admin = createAdminClient();

  const [snapRes, metricsRes] = await Promise.all([
    admin
      .from('seo_health_snapshots')
      .select('checked_at, ok_count, warn_count, fail_count, findings, price_drift, generated_by')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('seo_metrics')
      .select('metric_date, clicks, impressions, ctr, avg_position, top_queries')
      .eq('source', 'gsc')
      .order('metric_date', { ascending: false })
      .limit(GSC_WINDOW_DAYS),
  ]);

  // NULL, not a tidy fallback: a refused snapshot read is not "no snapshot
  // yet", and a refused metrics read is not "no data yet".
  const snap = snapRes.data as Snapshot | null;
  const metrics = metricsRes.data as MetricRow[] | null;
  const latestMetric = metrics?.[0] ?? null;
  const nags = (snap?.findings ?? []).filter((f) => f.status !== 'ok');

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageMasthead
        title="SEO & GEO"
        /* The audit is claim-gated to ~daily off admin traffic, and after()
           shows the PREVIOUS snapshot — this is the only way to see a catalog
           edit reflected immediately. */
        actions={<SeoRerunButton />}
      />

      {snapRes.error ? (
        <ErrorState
          title="Couldn't read the health audit"
          broke={`The read was refused: ${snapRes.error.message}`}
          survived="No scorecard loaded, so this is NOT a statement that the audit has never run — it is a statement that we do not know how it stands."
          todo="Reload. If it repeats, the query is being rejected rather than returning nothing, and the column, value or migration it names is the thing to check."
        />
      ) : !snap ? (
        <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
          No health snapshot yet. The daily SEO health audit runs automatically off
          admin traffic (cron-free) and writes the first one; just keep browsing the
          console and it&rsquo;ll populate within a few minutes.
        </div>
      ) : (
        <>
          {/* Scorecard */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Health scorecard</h2>
              <span className="text-xs text-ink/50">
                checked {new Date(snap.checked_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} ·{' '}
                {snap.generated_by}
              </span>
            </div>
            {/* The shared admin stat tile, replacing a local re-declaration of
                it. Its `null` renders an em-dash, which is why these counts are
                only ever reached inside the branch that HAS a snapshot. */}
            <div className="grid grid-cols-3 gap-3">
              <KpiStatCard label="Passing" value={snap.ok_count} />
              <KpiStatCard label="Warnings" value={snap.warn_count} />
              <KpiStatCard label="Failing" value={snap.fail_count} />
            </div>
            <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-white/60">
              {snap.findings.map((f, i) => {
                const s = STATUS_STYLE[f.status];
                const Icon = s.icon;
                return (
                  <li key={i} className="flex items-start gap-3 p-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{f.check}</div>
                      <div className="text-xs text-ink/60">{f.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Price drift */}
          {snap.price_drift.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">
                llms.txt price drift ({snap.price_drift.length})
              </h2>
              <p className="text-xs text-ink/55">
                <strong>missing</strong> = a live catalog price absent from the AI-crawler copy (fix the
                copy). <strong>orphan</strong> = a figure in the copy with no active SKU (retired price or
                a legit example/token band).
              </p>
              <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-white/60">
                {snap.price_drift.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 p-3 text-sm">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        d.kind === 'missing' ? 'bg-[var(--sn-danger-soft)] text-[color:var(--sn-danger)]' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {d.kind}
                    </span>
                    <span className="font-mono text-ink">{d.figure}</span>
                    <span className="min-w-0 truncate text-xs text-ink/55">{d.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Owner-action nags */}
          {nags.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Owner actions</h2>
              <ul className="space-y-1.5">
                {nags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/70">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{f.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Search Console trend */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink/70">
          <Bot className="h-4 w-4 text-ink/40" /> Search Console (last {GSC_WINDOW_DAYS} days)
        </h2>
        <ConsoleTable
          rows={metrics}
          readPermitted
          readError={metricsRes.error}
          reads="the Search Console figures"
          cap={GSC_WINDOW_DAYS}
          label="Search Console daily figures"
          minWidth="34rem"
          rowKey={(m) => m.metric_date}
          empty={{
            Icon: Bot,
            title: 'No Search Console data has arrived',
            blurb:
              'Nothing has been pulled yet, which is the expected state rather than a fault — the nightly pull has never delivered a day of figures. It needs GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN and GSC_SITE_URL set in Vercel, and a Google account that is allowed to answer; the audit above does not depend on any of that and keeps running either way.',
          }}
          columns={[
            { header: 'Date', mono: true, cell: (m) => <span className="text-ink/70">{m.metric_date}</span> },
            { header: 'Clicks', align: 'right', mono: true, cell: (m) => m.clicks },
            {
              header: 'Impressions',
              align: 'right',
              mono: true,
              cell: (m) => m.impressions,
            },
            {
              header: 'CTR',
              align: 'right',
              mono: true,
              hideBelow: 'md',
              cell: (m) => <span className="text-ink/70">{(m.ctr * 100).toFixed(1)}%</span>,
            },
            {
              header: 'Avg pos',
              align: 'right',
              mono: true,
              hideBelow: 'md',
              cell: (m) => <span className="text-ink/70">{m.avg_position.toFixed(1)}</span>,
            },
          ]}
        />
        {latestMetric?.top_queries?.length ? (
          <div className="rounded-xl border border-ink/10 bg-white/60 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-ink/70">
              Top queries on {latestMetric.metric_date}
              {latestMetric.top_queries.length > TOP_QUERIES_SHOWN
                ? ` · showing ${TOP_QUERIES_SHOWN} of ${latestMetric.top_queries.length}`
                : ''}
            </div>
            <ul className="flex flex-wrap gap-2">
              {latestMetric.top_queries.slice(0, TOP_QUERIES_SHOWN).map((q, i) => (
                <li key={i} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70">
                  {q.query} <span className="text-ink/70">· {q.clicks}c</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
