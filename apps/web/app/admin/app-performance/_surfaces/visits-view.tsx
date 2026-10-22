/**
 * VISITS — the drawing half of the Visits tab (owner 2026-10-22: "site traffic
 * stats in our own admin, not Vercel; no cookies, no banner"). Pure: it draws
 * the `VisitStats` it is handed, so the tab (`visits-surface.tsx`, live read)
 * and the lab (`/dev/visits-lab`, fixtures) draw the SAME component.
 *
 * Top to bottom: the range · four numbers and the visits → sign-ups → paid
 * orders line · visitors and page views per day · top pages · where visitors
 * came from · phone / tablet / computer · countries.
 *
 * 🔑 A REFUSED READ SAYS SO. `summary === null` prints "Couldn't read the
 * visits" where every visits number would have been, and a refused sign-up or
 * order count prints "—" plus the same sentence — never 0, which would read as
 * a fact about the business (app/admin/admin-reads-say-couldnt-read.test.ts).
 *
 * Server component, no client code: the chart is static SVG; the range is a
 * GET form. Frames only on what you press — sections are divided, not boxed.
 */
import { Footprints } from 'lucide-react';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { ReadFailed } from '@/app/admin/_components/read-failed';
import { formatCount } from '@/lib/format-number';
import { GROWTH_RANGE_OPTIONS, type GrowthRangeKey } from '@/lib/admin/growth-stats';
import {
  countryLabel,
  deviceLabel,
  fillDays,
  share,
  sourceLabel,
  totals,
  type VisitDay,
  type VisitStats,
} from '@/lib/visits/visit-stats';

const VIEWS = 'var(--sn-gold-500)';
const VISITORS = 'var(--sn-ink-700)';

function pct(v: number | null): string {
  if (v === null) return '—';
  const p = v * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Views per day as bars, visitors per day as a line, one shared scale. */
function DayChart({ days }: { days: VisitDay[] }) {
  const W = 640;
  const H = 160;
  const top = 8;
  const n = Math.max(1, days.length);
  const max = Math.max(1, ...days.map((d) => d.views));
  const slot = W / n;
  const barW = Math.max(1, slot * 0.7);
  const y = (v: number) => H - ((H - top) * v) / max;
  const points = days.map((d, i) => `${(i + 0.5) * slot},${y(d.visitors)}`).join(' ');
  const first = days[0];
  const last = days[days.length - 1];
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Visitors and page views per day, ${first ? shortDay(first.day) : ''} to ${last ? shortDay(last.day) : ''}`}
        preserveAspectRatio="none"
        data-testid="visits-chart"
      >
        <line x1={0} y1={H - 0.5} x2={W} y2={H - 0.5} stroke="var(--sn-ink-300)" strokeWidth={1} />
        {days.map((d, i) =>
          d.views > 0 ? (
            <rect key={d.day} x={i * slot + (slot - barW) / 2} y={y(d.views)} width={barW} height={H - y(d.views)} fill={VIEWS} opacity={0.55}>
              <title>{`${shortDay(d.day)} · ${formatCount(d.views)} page views · ${formatCount(d.visitors)} visitors`}</title>
            </rect>
          ) : null,
        )}
        <polyline
          fill="none"
          stroke={VISITORS}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] tabular-nums text-ink/50">
        <span>{first ? shortDay(first.day) : ''}</span>
        <span>most in a day: {formatCount(max)} page views</span>
        <span>{last ? shortDay(last.day) : ''}</span>
      </figcaption>
    </figure>
  );
}

function Legend({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={line ? 'h-0.5 w-3 rounded-full' : 'h-2.5 w-2.5 rounded-sm'}
        style={{ background: color, opacity: line ? 1 : 0.55 }}
      />
      {label}
    </span>
  );
}

/** A label, a thin share bar, the number. Rows are divided, not boxed. */
function ShareRows({ rows, label }: { rows: { key: string; label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="divide-y divide-ink/10 border-y border-ink/10">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="block truncate text-ink">{r.label}</span>
            <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-ink/5">
              <span className="block h-1 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: VISITORS, opacity: 0.6 }} />
            </span>
          </span>
          <span className="tabular-nums text-ink/80">{formatCount(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
      {sub ? <dd className="text-[12px] text-ink/55">{sub}</dd> : null}
    </div>
  );
}

export function VisitsView({ stats, range }: { stats: VisitStats; range: GrowthRangeKey }) {
  const { summary } = stats;
  const unread = summary === null;
  const days = summary ? fillDays(summary.days, stats.sinceDay, stats.untilDay) : [];
  const t = totals(days);
  const countedSince = summary?.firstDay && summary.firstDay > stats.sinceDay ? summary.firstDay : null;
  const deviceTotal = summary ? summary.devices.reduce((s, d) => s + d.visitors, 0) : 0;
  const funnelUnread = unread || stats.signUps === null || stats.paidOrders === null;

  return (
    <div className="space-y-10">
      <PageMasthead
        title="Visits"
        className="mb-2"
        actions={
          stats.demo ? (
            <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
              Illustrative demo data
            </span>
          ) : null
        }
      />

      {/* Range picker — GET form, no client JS (the Growth tab's own). */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="visits" />
        <label htmlFor="visits-range" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          Range
        </label>
        <select id="visits-range" name="range" defaultValue={range} className="input-field h-11 max-w-[14rem] py-0 text-sm">
          {GROWTH_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-11 px-4 text-sm">
          Apply
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {countedSince ? `Counting since ${countedSince}` : `Since ${stats.sinceDay}`}
        </span>
      </form>

      {/* ── 1 · the four numbers + the funnel line ─────────────────────── */}
      <section aria-labelledby="visits-numbers">
        <h2 id="visits-numbers" className="sr-only">
          Visits in this range
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 divide-ink/10 border-y border-ink/10 sm:grid-cols-4" data-testid="visits-figures">
          <Figure label="Visitors" value={unread ? '—' : formatCount(t.visitors)} sub="counted once a day" />
          <Figure label="Page views" value={unread ? '—' : formatCount(t.views)} />
          <Figure label="Sign-ups" value={stats.signUps === null ? '—' : formatCount(stats.signUps)} />
          <Figure label="Paid orders" value={stats.paidOrders === null ? '—' : formatCount(stats.paidOrders)} />
        </dl>
        {unread ? (
          <div className="mt-3">
            <ReadFailed what="the visits" />
          </div>
        ) : null}
        {stats.signUps === null ? (
          <div className="mt-3">
            <ReadFailed what="the sign-ups" />
          </div>
        ) : null}
        {stats.paidOrders === null ? (
          <div className="mt-3">
            <ReadFailed what="the paid orders" />
          </div>
        ) : null}
        {funnelUnread ? null : (
          <p className="mt-3 text-sm text-ink/75" data-testid="visits-funnel">
            <span className="font-semibold tabular-nums text-ink">{formatCount(t.visitors)}</span> visitors →{' '}
            <span className="font-semibold tabular-nums text-ink">{formatCount(stats.signUps ?? 0)}</span> sign-ups (
            {pct(share(stats.signUps ?? 0, t.visitors))}) →{' '}
            <span className="font-semibold tabular-nums text-ink">{formatCount(stats.paidOrders ?? 0)}</span> paid orders (
            {pct(share(stats.paidOrders ?? 0, t.visitors))})
          </p>
        )}
      </section>

      {unread ? null : (
        <>
          {/* ── 2 · per day ───────────────────────────────────────────── */}
          <section aria-labelledby="visits-per-day">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="visits-per-day" className="text-base font-semibold text-ink">
                Per day
              </h2>
              <p className="flex flex-wrap items-center gap-3 text-[11px] text-ink/55">
                <Legend color={VISITORS} label="visitors" line />
                <Legend color={VIEWS} label="page views" />
              </p>
            </div>
            {t.views === 0 ? (
              <p className="text-sm text-ink/60">No visits counted in this range yet.</p>
            ) : (
              <DayChart days={days} />
            )}
          </section>
        </>
      )}

      {/* ── 3 · top pages ─────────────────────────────────────────── */}
      <section aria-labelledby="visits-pages">
        <h2 id="visits-pages" className="mb-3 text-base font-semibold text-ink">
          Top pages
        </h2>
        <ConsoleTable
          label="Top pages"
          reads="the visits"
          rows={summary ? summary.pages : null}
        readError={summary ? null : { message: 'site_visit_summary read refused (see the earlier log line)' }}
          rowKey={(p) => p.path}
          readPermitted
          minWidth="18rem"
          empty={{
            Icon: Footprints,
            title: 'No pages counted yet',
            blurb: 'Pages appear here as people open them.',
          }}
          columns={[
            { header: 'Page', mono: true, cell: (p) => <span className="break-all">{p.path}</span> },
            { header: 'Views', align: 'right', cell: (p) => <span className="tabular-nums">{formatCount(p.views)}</span> },
            {
              header: 'First page for',
              align: 'right',
              cell: (p) => <span className="tabular-nums">{formatCount(p.visitors)}</span>,
            },
          ]}
        />
      </section>


      {unread ? null : (
        <>

          {/* ── 4 · where they came from · phone or computer · country ─── */}
          <div className="grid gap-10 lg:grid-cols-3">
            <section aria-labelledby="visits-sources">
              <h2 id="visits-sources" className="mb-3 text-base font-semibold text-ink">
                Where visitors came from
              </h2>
              {summary.sources.length === 0 ? (
                <p className="text-sm text-ink/60">No visitors counted in this range yet.</p>
              ) : (
                <ShareRows
                  label="Visitors by source"
                  rows={summary.sources.map((s) => ({ key: `${s.source}|${s.utm_source}`, label: sourceLabel(s), value: s.visitors }))}
                />
              )}
            </section>

            <section aria-labelledby="visits-devices">
              <h2 id="visits-devices" className="mb-3 text-base font-semibold text-ink">
                Phone or computer
              </h2>
              {deviceTotal === 0 ? (
                <p className="text-sm text-ink/60">No visitors counted in this range yet.</p>
              ) : (
                <ul aria-label="Visitors by device" className="divide-y divide-ink/10 border-y border-ink/10" data-testid="visits-devices">
                  {summary.devices.map((d) => (
                    <li key={d.device} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                      <span className="text-ink">{deviceLabel(d.device)}</span>
                      <span className="tabular-nums text-ink/80">
                        {pct(share(d.visitors, deviceTotal))}
                        <span className="ml-2 text-[12px] text-ink/50">{formatCount(d.visitors)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="visits-countries">
              <h2 id="visits-countries" className="mb-3 text-base font-semibold text-ink">
                Countries
              </h2>
              {summary.countries.length === 0 ? (
                <p className="text-sm text-ink/60">No visitors counted in this range yet.</p>
              ) : (
                <ShareRows
                  label="Visitors by country"
                  rows={summary.countries.map((c) => ({ key: c.country || '—', label: countryLabel(c.country), value: c.visitors }))}
                />
              )}
            </section>
          </div>
        </>
      )}

      <p className="max-w-prose border-t border-ink/10 pt-4 text-[12px] text-ink/55">
        Counted on our own database — no cookie, nothing kept in the visitor&apos;s browser, and not in the iPhone or Android
        app. A visitor is counted once a day; the same person on two days counts twice.
      </p>
    </div>
  );
}
