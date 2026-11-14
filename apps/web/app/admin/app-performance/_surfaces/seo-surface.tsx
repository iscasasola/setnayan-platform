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
import { Bot } from 'lucide-react';
import type { ReactNode } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';
import type { HealthFinding, PriceDriftEntry, HealthStatus } from '@/lib/seo/health-checks';
import { Badge, Nums, One, Row, Rows, Sec, type NumTone } from '../_components/insights-parts';
import { SeoRerunButton } from './seo-rerun-button';
import { AiAnswerCheckRow, ResolveDriftButton } from './seo-ai-answer-check';
import {
  AI_ANSWER_TAG,
  AI_ANSWER_RECHECK_DAYS,
  aiAnswers,
  lastAskedById,
  parseAiAnswerRationale,
  recheckDue,
} from '@/lib/seo/ai-answers';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { formatCount } from '@/lib/format-number';

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

/** A finding's state as a pill — tokens only (the approved drawing's OK · Warn · Fail badges). */
const STATUS_BADGE: Record<HealthStatus, { tone: NumTone; label: string }> = {
  ok: { tone: 'ok', label: 'OK' },
  warn: { tone: 'warn', label: 'Warn' },
  fail: { tone: 'danger', label: 'Fail' },
};

/**
 * A hairline row whose words WRAP — a finding's detail or an AI's answer is a sentence, and the shared `Row` cuts its
 * lines with "…"; nothing on this view may be cut away (rule: nothing dropped).
 */
function Line({ title, sub, trail, data }: { title: ReactNode; sub?: ReactNode; trail?: ReactNode; data?: string }) {
  return (
    <li data-insights-row={data ?? ''} className="border-t border-ink/10">
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2">
        <span className="min-w-0">
          <span className="block break-words text-[15px] font-semibold leading-tight text-ink">{title}</span>
          {sub ? <span className="mt-0.5 block break-words text-[13px] text-ink/65">{sub}</span> : null}
        </span>
        {trail ? <span className="flex items-center gap-2 text-[14px] text-ink/70">{trail}</span> : null}
      </div>
    </li>
  );
}

/**
 * The Search Console window, hoisted so the query, the heading and the cap
 * disclosure cannot drift. It used to be typed three separate times.
 */
const GSC_WINDOW_DAYS = 14;

/** The chip list under the table shows the busiest queries of the newest day. */
const TOP_QUERIES_SHOWN = 15;

/** How many AI-answer rows the check reads — enough for years of monthly checks; the cap is disclosed if reached. */
const AI_ANSWER_ROWS_READ = 500;

type AiAnswerRow = {
  id: number;
  route: string;
  current_value: string | null;
  rationale: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export async function SeoSurface() {
  // The RLS-bypassing service-role client below must never run for a non-admin,
  // and a layout is not a safe auth boundary (council fix #1). The studio page
  // already gates; this states it in the file that holds the client, so
  // `readPermitted` is honestly true here and not true-by-inheritance.
  await requireAdmin();

  const admin = createAdminClient();

  const [snapRes, metricsRes, aiRes, bookingFee] = await Promise.all([
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
    // Build 6 Lane K — the AI-answer check's own rows in the review queue.
    admin
      .from('seo_suggestions')
      .select('id, route, current_value, rationale, status, created_at')
      .like('rationale', `${AI_ANSWER_TAG}%`)
      .order('created_at', { ascending: false })
      .limit(AI_ANSWER_ROWS_READ),
    getBookingFeeSchedule(admin),
  ]);

  // NULL, not a tidy fallback: a refused snapshot read is not "no snapshot
  // yet", and a refused metrics read is not "no data yet".
  const snap = snapRes.data as Snapshot | null;
  const metrics = metricsRes.data as MetricRow[] | null;
  const latestMetric = metrics?.[0] ?? null;
  const nags = (snap?.findings ?? []).filter((f) => f.status !== 'ok');
  // NULL on a refused read — the check then says it could not load, never "never asked".
  const aiRows = aiRes.error ? null : ((aiRes.data ?? []) as AiAnswerRow[]);
  const lastAsked = aiRows ? lastAskedById(aiRows) : null;
  const drift = (aiRows ?? []).filter((r) => r.status === 'pending');
  const questions = aiAnswers({ bookingFee });
  const nowMs = Date.now();

  const checkedAt = snap
    ? new Date(snap.checked_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    : null;

  return (
    <div className="w-full max-w-3xl">
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
        <section aria-labelledby="seo-health">
          <Sec id="seo-health" title="Health audit" />
          <One label="No health snapshot yet">
            The daily SEO health audit runs automatically off admin traffic (cron-free) and writes the first one; just
            keep browsing the console and it&rsquo;ll populate within a few minutes.
          </One>
        </section>
      ) : (
        <>
          {/* Scorecard — the three counts as one strip, the findings as hairline rows (no tiles, T18). Only ever
              reached inside the branch that HAS a snapshot, so a count here is a measured count. */}
          <section aria-labelledby="seo-health">
            <Sec
              id="seo-health"
              title="Health audit"
              about={`Checked ${checkedAt} · ${snap.generated_by}. Runs off admin traffic (cron-free); "Re-run audit now" checks again at once.`}
              right={<span className="text-[12px] text-ink/55">checked {checkedAt}</span>}
            />
            <Nums
              data="seo-scorecard"
              items={[
                { value: snap.ok_count, label: 'passing', tone: 'ok' },
                { value: snap.warn_count, label: 'warnings', tone: snap.warn_count > 0 ? 'warn' : undefined },
                { value: snap.fail_count, label: 'failing', tone: snap.fail_count > 0 ? 'danger' : undefined },
              ]}
            />
            <Rows label="Health findings" data="seo-findings">
              {snap.findings.map((f, i) => {
                const s = STATUS_BADGE[f.status];
                return <Line key={i} title={f.check} sub={f.detail} trail={<Badge tone={s.tone}>{s.label}</Badge>} />;
              })}
            </Rows>
          </section>

          {/* Price drift */}
          {snap.price_drift.length > 0 && (
            <section aria-labelledby="seo-drift">
              <Sec
                id="seo-drift"
                title="llms.txt price drift"
                count={snap.price_drift.length}
                about={
                  <>
                    <strong>missing</strong> = a live catalog price absent from the AI-crawler copy (fix the copy).{' '}
                    <strong>orphan</strong> = a figure in the copy with no active SKU (retired price or a legit
                    example/token band).
                  </>
                }
              />
              <Rows label="llms.txt price drift" data="seo-price-drift">
                {snap.price_drift.map((d, i) => (
                  <Line
                    key={i}
                    title={<span className="font-mono">{d.figure}</span>}
                    sub={d.note}
                    trail={<Badge tone={d.kind === 'missing' ? 'danger' : 'warn'}>{d.kind}</Badge>}
                  />
                ))}
              </Rows>
            </section>
          )}

          {/* Owner-action nags */}
          {nags.length > 0 && (
            <section aria-labelledby="seo-owner-actions">
              <Sec id="seo-owner-actions" title="Owner actions" count={nags.length} />
              <Rows label="Owner actions" data="seo-owner-actions">
                {nags.map((f, i) => (
                  <Line key={i} title={f.detail} trail={<Badge tone={STATUS_BADGE[f.status].tone}>{STATUS_BADGE[f.status].label}</Badge>} />
                ))}
              </Rows>
            </section>
          )}
        </>
      )}

      {/* AI-answer check (Build 6 Lane K) */}
      <section aria-labelledby="seo-ai-check">
        <Sec
          id="seo-ai-check"
          title="AI answer check"
          count={questions.length}
          about={
            <>
              Every {AI_ANSWER_RECHECK_DAYS} days, ask an AI assistant each question below in a fresh chat, without
              naming our features, and paste what it said. Right or wrong, it is saved; a wrong answer waits in the
              queue until the copy is fixed. The true answers are the ones /llms.txt and the /features FAQ print.
            </>
          }
        />
        {aiRows === null ? (
          <ErrorState
            title="Couldn't read the AI answer log"
            broke={`The read was refused: ${aiRes.error?.message ?? 'unknown error'}`}
            survived="The saved questions are still listed, but when each was last asked is unknown — not 'never'."
            todo="Reload. If it repeats, the saved questions are refusing reads — check who may read them."
          />
        ) : null}
        {aiRows && aiRows.length >= AI_ANSWER_ROWS_READ ? (
          <p className="text-[13px] text-ink/60">Showing the newest {formatCount(AI_ANSWER_ROWS_READ)} logged answers.</p>
        ) : null}
        <Rows label="AI answer check questions" data="seo-ai-questions">
          {questions.map((q) => {
            const last = lastAsked?.get(q.id) ?? null;
            return (
              <AiAnswerCheckRow
                key={q.id}
                id={q.id}
                question={q.question}
                answer={q.answer}
                corrects={q.corrects}
                lastAsked={
                  last ? new Date(last).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : null
                }
                due={lastAsked !== null && recheckDue(last, nowMs)}
              />
            );
          })}
        </Rows>
        {drift.length > 0 ? (
          <>
            <Sec title="Drift to fix" count={drift.length} />
            <Rows label="Drift to fix" data="seo-ai-drift">
              {drift.map((r) => {
                const parsed = parseAiAnswerRationale(r.rationale);
                const q = questions.find((x) => x.id === parsed?.id);
                return (
                  <Line
                    key={r.id}
                    title={q?.question ?? parsed?.id ?? r.route}
                    sub={
                      <>
                        AI said: {r.current_value}
                        <span className="block text-ink/55">
                          {new Date(r.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} · fix on{' '}
                          {r.route}
                        </span>
                      </>
                    }
                    trail={<ResolveDriftButton rowId={r.id} />}
                  />
                );
              })}
            </Rows>
          </>
        ) : null}
      </section>

      {/* Search Console trend */}
      <section aria-labelledby="seo-gsc">
        <Sec
          id="seo-gsc"
          title={`Search Console · last ${GSC_WINDOW_DAYS} days`}
          about="It needs GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN and GSC_SITE_URL set in Vercel, and a Google account that is allowed to answer; the audit above does not depend on any of that and keeps running either way."
        />
        <ConsoleTable
          rows={metrics}
          readPermitted
          readError={metricsRes.error}
          reads="the Search Console figures"
          cap={GSC_WINDOW_DAYS}
          label="Search Console daily figures"
          minWidth="20rem"
          rowKey={(m) => m.metric_date}
          empty={{
            Icon: Bot,
            title: 'No Search Console data has arrived',
            blurb:
              'Nothing has been pulled yet, which is the expected state rather than a fault — the nightly pull has never delivered a day of figures.',
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
          <>
            <Sec
              title={`Top queries on ${latestMetric.metric_date}`}
              right={
                latestMetric.top_queries.length > TOP_QUERIES_SHOWN
                  ? `showing ${formatCount(TOP_QUERIES_SHOWN)} of ${formatCount(latestMetric.top_queries.length)}`
                  : undefined
              }
            />
            <Rows label="Top queries" data="seo-top-queries">
              {latestMetric.top_queries.slice(0, TOP_QUERIES_SHOWN).map((q, i) => (
                <Row
                  key={i}
                  title={q.query}
                  trail={`${formatCount(q.clicks)} clicks · ${formatCount(q.impressions)} impressions`}
                />
              ))}
            </Rows>
          </>
        ) : null}
      </section>
    </div>
  );
}
