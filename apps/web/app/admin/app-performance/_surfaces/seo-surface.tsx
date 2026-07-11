// Insights Studio surface — the body of the former /admin/seo page,
// re-homed here (2026-07-10). Gating is handled by the studio shell.
import { AlertTriangle, CheckCircle2, XCircle, Search, Bot } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { HealthFinding, PriceDriftEntry, HealthStatus } from '@/lib/seo/health-checks';

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
  fail: { icon: XCircle, cls: 'text-red-600', label: 'Fail' },
};

function StatCard({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4 text-center">
      <div className={`text-2xl font-semibold ${tone}`}>{n}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-ink/55">{label}</div>
    </div>
  );
}

export async function SeoSurface() {
  // Page-level gate — the RLS-bypassing service-role client below must never run
  // for a non-admin (layouts aren't a safe auth boundary; council fix #1).

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
      .limit(14),
  ]);

  const snap = (snapRes.data ?? null) as Snapshot | null;
  const metrics = (metricsRes.data ?? []) as MetricRow[];
  const latestMetric = metrics[0] ?? null;
  const nags = (snap?.findings ?? []).filter((f) => f.status !== 'ok');

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <Search className="mt-1 h-6 w-6 text-ink/40" />
        <div>
          <h1 className="text-xl font-semibold text-ink">SEO &amp; GEO</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Daily automated audit of the search + AI-answer-engine surface. The{' '}
            <code className="rounded bg-ink/5 px-1">seo-health</code> cron diffs the served{' '}
            <code className="rounded bg-ink/5 px-1">llms.txt</code> against the live catalog and
            checks route + token coverage each night; <code className="rounded bg-ink/5 px-1">seo-gsc</code>{' '}
            pulls Search Console. Drift surfaces here instead of shipping wrong answers to every LLM.
          </p>
        </div>
      </header>

      {!snap ? (
        <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
          No health snapshot yet. The nightly <code className="rounded bg-ink/5 px-1">/api/cron/seo-health</code>{' '}
          run writes the first one; trigger it manually with the{' '}
          <code className="rounded bg-ink/5 px-1">CRON_SECRET</code> to populate this page now.
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
            <div className="grid grid-cols-3 gap-3">
              <StatCard n={snap.ok_count} label="Passing" tone="text-emerald-600" />
              <StatCard n={snap.warn_count} label="Warnings" tone="text-amber-600" />
              <StatCard n={snap.fail_count} label="Failing" tone="text-red-600" />
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
                        d.kind === 'missing' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
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
          <Bot className="h-4 w-4 text-ink/40" /> Search Console (last 14 days)
        </h2>
        {metrics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/60">
            No Search Console data yet. Set <code className="rounded bg-ink/5 px-1">GSC_CLIENT_ID</code>,{' '}
            <code className="rounded bg-ink/5 px-1">GSC_CLIENT_SECRET</code>,{' '}
            <code className="rounded bg-ink/5 px-1">GSC_REFRESH_TOKEN</code>,{' '}
            <code className="rounded bg-ink/5 px-1">GSC_SITE_URL</code> in Vercel env and the nightly{' '}
            <code className="rounded bg-ink/5 px-1">seo-gsc</code> cron fills this in.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                    <th className="p-2 font-medium">Date</th>
                    <th className="p-2 text-right font-medium">Clicks</th>
                    <th className="p-2 text-right font-medium">Impressions</th>
                    <th className="p-2 text-right font-medium">CTR</th>
                    <th className="p-2 text-right font-medium">Avg pos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.metric_date} className="border-b border-ink/5 last:border-0">
                      <td className="p-2 text-ink/70">{m.metric_date}</td>
                      <td className="p-2 text-right tabular-nums text-ink">{m.clicks}</td>
                      <td className="p-2 text-right tabular-nums text-ink">{m.impressions}</td>
                      <td className="p-2 text-right tabular-nums text-ink/70">
                        {(m.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="p-2 text-right tabular-nums text-ink/70">{m.avg_position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {latestMetric?.top_queries?.length ? (
              <div className="rounded-xl border border-ink/10 bg-white/60 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Top queries</div>
                <ul className="flex flex-wrap gap-2">
                  {latestMetric.top_queries.slice(0, 15).map((q, i) => (
                    <li key={i} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70">
                      {q.query} <span className="text-ink/40">· {q.clicks}c</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
