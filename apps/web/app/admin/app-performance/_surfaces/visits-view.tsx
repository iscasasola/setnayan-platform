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
 * Server component; the chart is static SVG. The range is the one dropdown row
 * (`InsightsParamPick`), which moves `?range=` — the old native select + Apply
 * GET form went (approved drawing, insights.html › Visits; one-selector rule).
 * Drawn with the shared Insights parts — frames only on what you press.
 */
import { Footprints } from 'lucide-react';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { ReadFailed } from '@/app/admin/_components/read-failed';
import { formatCount } from '@/lib/format-number';
import { GROWTH_RANGE_OPTIONS, type GrowthRangeKey } from '@/lib/admin/growth-stats';
import { Mix, Note, Nums, One, Sec } from '../_components/insights-parts';
import { InsightsParamPick } from '../_components/insights-param-pick';
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

export function VisitsView({ stats, range }: { stats: VisitStats; range: GrowthRangeKey }) {
  const { summary } = stats;
  const unread = summary === null;
  const days = summary ? fillDays(summary.days, stats.sinceDay, stats.untilDay) : [];
  const t = totals(days);
  const countedSince = summary?.firstDay && summary.firstDay > stats.sinceDay ? summary.firstDay : null;
  const deviceTotal = summary ? summary.devices.reduce((s, d) => s + d.visitors, 0) : 0;
  const funnelUnread = unread || stats.signUps === null || stats.paidOrders === null;

  return (
    <div className="max-w-3xl">
      <PageMasthead title="Visits" className="mb-0" />
      {stats.demo ? (
        <One label="Illustrative demo data">
          Sample figures so you can see the shape of this view before real data accrues. Turn demo data off to see live
          counts.
        </One>
      ) : null}

      {/* Range — the one dropdown (approved drawing: fr('Range', …)), never a native select with an Apply. */}
      <InsightsParamPick
        name="Range"
        param="range"
        value={range}
        options={GROWTH_RANGE_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
        about={countedSince ? `Counting since ${countedSince}.` : `Since ${stats.sinceDay}.`}
      />

      {/* ── 1 · the four numbers + the funnel line ─────────────────────── */}
      <section aria-labelledby="visits-numbers">
        <h2 id="visits-numbers" className="sr-only">
          Visits in this range
        </h2>
        <Nums
          data="visits-figures"
          testId="visits-figures"
          items={[
            { value: unread ? null : t.visitors, label: 'visitors · counted once a day' },
            { value: unread ? null : t.views, label: 'page views' },
            { value: stats.signUps, label: 'sign-ups', href: '/admin/app-performance?tab=growth' },
            { value: stats.paidOrders, label: 'paid orders', href: '/admin/money' },
          ]}
        />
        {unread ? <ReadFailed what="the visits" /> : null}
        {stats.signUps === null ? (
          <div className="mt-2">
            <ReadFailed what="the sign-ups" />
          </div>
        ) : null}
        {stats.paidOrders === null ? (
          <div className="mt-2">
            <ReadFailed what="the paid orders" />
          </div>
        ) : null}
        {funnelUnread ? null : (
          <p className="mt-1 text-[13px] text-ink/70" data-testid="visits-funnel">
            <span className="font-semibold tabular-nums text-ink">{formatCount(t.visitors)}</span> visitors →{' '}
            <span className="font-semibold tabular-nums text-ink">{formatCount(stats.signUps ?? 0)}</span> sign-ups (
            {pct(share(stats.signUps ?? 0, t.visitors))}) →{' '}
            <span className="font-semibold tabular-nums text-ink">{formatCount(stats.paidOrders ?? 0)}</span> paid orders (
            {pct(share(stats.paidOrders ?? 0, t.visitors))})
          </p>
        )}
      </section>

      {unread ? null : (
        <section aria-labelledby="visits-per-day">
          <Sec
            id="visits-per-day"
            title="Per day"
            about="Visitors as the line, page views as the bars, on one shared scale."
            right={
              <span className="flex flex-wrap items-center gap-3 text-[11px] text-ink/55">
                <Legend color={VISITORS} label="visitors" line />
                <Legend color={VIEWS} label="page views" />
              </span>
            }
          />
          {t.views === 0 ? (
            <p className="text-[13px] text-ink/60">No visits counted in this range yet.</p>
          ) : (
            <DayChart days={days} />
          )}
        </section>
      )}

      {/* ── 3 · top pages ─────────────────────────────────────────── */}
      <section aria-labelledby="visits-pages">
        <Sec id="visits-pages" title="Top pages" />
        <ConsoleTable
          label="Top pages"
          reads="visits"
          rows={summary ? summary.pages : null}
          readError={summary ? null : { message: 'The visits could not be read (the server log says why).' }}
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
          <section aria-labelledby="visits-sources">
            <Sec id="visits-sources" title="Where visitors came from" />
            {summary.sources.length === 0 ? (
              <p className="text-[13px] text-ink/60">No visitors counted in this range yet.</p>
            ) : (
              <ShareRows
                label="Visitors by source"
                rows={summary.sources.map((s) => ({ key: `${s.source}|${s.utm_source}`, label: sourceLabel(s), value: s.visitors }))}
              />
            )}
          </section>

          <section aria-labelledby="visits-devices">
            <Sec id="visits-devices" title="Phone or computer" />
            {deviceTotal === 0 ? (
              <p className="text-[13px] text-ink/60">No visitors counted in this range yet.</p>
            ) : (
              <div data-testid="visits-devices">
                <Mix
                  label="Visitors by device"
                  parts={summary.devices.map((d) => ({
                    label: deviceLabel(d.device),
                    value: d.visitors,
                    legend: `${deviceLabel(d.device)} ${pct(share(d.visitors, deviceTotal))} · ${formatCount(d.visitors)}`,
                  }))}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="visits-countries">
            <Sec id="visits-countries" title="Countries" />
            {summary.countries.length === 0 ? (
              <p className="text-[13px] text-ink/60">No visitors counted in this range yet.</p>
            ) : (
              <ShareRows
                label="Visitors by country"
                rows={summary.countries.map((c) => ({ key: c.country || '—', label: countryLabel(c.country), value: c.visitors }))}
              />
            )}
          </section>
        </>
      )}

      <Note label="No cookie">
        Counted on our own database — no cookie, nothing kept in the visitor&apos;s browser, and not in the iPhone or
        Android app. A visitor is counted once a day; the same person on two days counts twice.
      </Note>
    </div>
  );
}
