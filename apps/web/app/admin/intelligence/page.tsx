import { cookies } from 'next/headers';
import { Radar, AlertTriangle, Banknote, Trophy } from 'lucide-react';
import {
  fetchIntelligenceStats,
  buildDemoIntelligenceStats,
  STALE_WINDOW_OPTIONS,
  eventTypeLabel,
  regionLabel,
  LEAD_TIER_LABELS,
  type StaleWindowKey,
  type ChurnRiskRow,
  type MarketAnalytics,
  type LeadScoreRow,
  type LeadTier,
} from '@/lib/admin/intelligence-stats';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/demo-mode';

export const metadata = { title: 'Intelligence · Admin' };

/**
 * /admin/intelligence — churn radar · market pulse · lead scoring.
 *
 * All three sections are local Postgres aggregations (RPCs from migration
 * 20261202000000) cached for 10 minutes via unstable_cache — zero external
 * AI/API spend, bounded DB load. Mirrors /admin/growth's server-rendered,
 * no-client-JS pattern: GET-form filter, demo-mode cookie, m-card tiles.
 */

type Props = {
  searchParams: Promise<{ quiet?: string; demo?: string }>;
};

const nf = new Intl.NumberFormat('en-PH');
const phpFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function php(centavos: number | null): string {
  if (centavos === null) return '—';
  return phpFmt.format(centavos / 100);
}

function parseWindow(raw: string | undefined): StaleWindowKey {
  return raw === '7' || raw === '30' ? raw : '14';
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return iso.slice(0, 10);
}

export default async function AdminIntelligencePage({ searchParams }: Props) {
  const { quiet: rawQuiet, demo: rawDemo } = await searchParams;
  const windowKey = parseWindow(rawQuiet);
  const staleDays =
    STALE_WINDOW_OPTIONS.find((o) => o.value === windowKey)?.days ?? 14;

  // The /admin layout 404s non-admins, so by the time this renders the viewer
  // is an admin — reading the demo cookie/flag directly here is safe.
  const cookieStore = await cookies();
  const demoActive =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1' ||
    rawDemo === '1' ||
    rawDemo === 'on';
  const stats = demoActive
    ? buildDemoIntelligenceStats(staleDays)
    : await fetchIntelligenceStats(staleDays);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan · Internal ops
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
            Intelligence
          </h1>
          {stats.demo ? (
            <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
              Illustrative demo data
            </span>
          ) : null}
        </div>
        <p className="max-w-prose text-base text-ink/65">
          {stats.demo ? (
            <>
              Sample figures so you can see the shape of this surface before
              real data accrues. Turn off demo mode to see live counts.
            </>
          ) : (
            <>
              Churn radar, market pulse, and lead scores — computed entirely
              from the platform&apos;s own tables and cached for 10 minutes, so
              this surface never weighs on the production database.
            </>
          )}
        </p>
      </header>

      {/* Stale-window picker — GET form, no client JS (mirrors /admin/growth). */}
      <form method="get" className="mb-8 flex flex-wrap items-center gap-2">
        <label
          htmlFor="quiet"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Churn window
        </label>
        <select
          id="quiet"
          name="quiet"
          defaultValue={windowKey}
          className="input-field h-9 max-w-[14rem] py-0 text-sm"
        >
          {STALE_WINDOW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Refreshed {stats.generatedAt.slice(0, 16).replace('T', ' ')} UTC
        </span>
      </form>

      {stats.errors.length > 0 ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Some metrics couldn&apos;t load: {stats.errors.join(' · ')}
        </p>
      ) : null}

      {/* ── CHURN RADAR ────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          icon={AlertTriangle}
          title="Churn radar"
          blurb={`Upcoming events whose couple has had zero activity — no login, guest change, budget entry, or seating edit — for ${staleDays}+ days.`}
        />
        <ChurnTable rows={stats.churn} staleDays={staleDays} />
      </section>

      {/* ── MARKET PULSE ───────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          icon={Banknote}
          title="Market pulse"
          blurb="Planned budgets, where events are happening, and what kinds of events the platform is hosting. Non-archived events only."
        />
        <MarketPulse market={stats.market} />
      </section>

      {/* ── LEAD SCORES ────────────────────────────────────────────── */}
      <section className="mb-4">
        <SectionHeading
          icon={Trophy}
          title="Lead scores"
          blurb="Engagement-ranked active events (0–100). Couples who set a budget AND ran seating Auto-arrange concentrate in the top tier — the warmest upsell list on the platform."
        />
        <LeadTable rows={stats.leads} />
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Presentational helpers (server-rendered, no client JS)             */
/* ────────────────────────────────────────────────────────────────── */

function SectionHeading({
  title,
  blurb,
  icon: Icon,
}: {
  title: string;
  blurb: string;
  icon: typeof Radar;
}) {
  return (
    <header className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--m-orange)]/10 text-[var(--m-orange-2)]">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-xs text-ink/55">{blurb}</p>
      </div>
    </header>
  );
}

const TH_CLASS =
  'px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] whitespace-nowrap';
const TD_CLASS = 'px-3 py-2.5 align-top text-sm whitespace-nowrap';

function ChurnTable({ rows, staleDays }: { rows: ChurnRiskRow[]; staleDays: number }) {
  if (rows.length === 0) {
    return (
      <div className="m-card p-5">
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          No at-risk events — every couple with an upcoming event has been
          active inside the last {staleDays} days.
        </p>
      </div>
    );
  }
  return (
    <div className="m-card overflow-x-auto p-0">
      <table className="w-full min-w-[56rem] border-collapse">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: 'var(--m-paper-3)', color: 'var(--m-slate-2)' }}
          >
            <th className={TH_CLASS}>Event</th>
            <th className={TH_CLASS}>Couple</th>
            <th className={TH_CLASS}>Event date</th>
            <th className={TH_CLASS}>Days out</th>
            <th className={TH_CLASS}>Last login</th>
            <th className={TH_CLASS}>Last guest change</th>
            <th className={TH_CLASS}>Last budget change</th>
            <th className={TH_CLASS}>Quiet for</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.eventId}
              className="border-b last:border-b-0"
              style={{ borderColor: 'var(--m-paper-3)' }}
            >
              <td className={TD_CLASS}>
                <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                  {r.eventName}
                </span>
                <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
                  {eventTypeLabel(r.eventType)} · {r.publicId}
                </span>
              </td>
              <td className={TD_CLASS}>
                <span style={{ color: 'var(--m-ink)' }}>
                  {r.ownerDisplayName ?? '—'}
                </span>
                <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
                  {r.ownerEmail ?? 'no linked account'}
                </span>
              </td>
              <td className={TD_CLASS} style={{ color: 'var(--m-ink)' }}>
                {r.eventDate}
              </td>
              <td className={`${TD_CLASS} tabular-nums`} style={{ color: 'var(--m-ink)' }}>
                {nf.format(r.daysToEvent)}d
              </td>
              <td className={TD_CLASS} style={{ color: 'var(--m-slate)' }}>
                {fmtDate(r.lastSignInAt)}
              </td>
              <td className={TD_CLASS} style={{ color: 'var(--m-slate)' }}>
                {fmtDate(r.lastGuestChangeAt)}
              </td>
              <td className={TD_CLASS} style={{ color: 'var(--m-slate)' }}>
                {fmtDate(r.lastBudgetChangeAt)}
              </td>
              <td className={TD_CLASS}>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                  style={{ background: '#FEF2F2', color: '#991B1B' }}
                >
                  {nf.format(r.daysInactive)}d
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketPulse({ market }: { market: MarketAnalytics | null }) {
  if (!market) {
    return (
      <div className="m-card p-5">
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Market aggregates couldn&apos;t load.
        </p>
      </div>
    );
  }
  const b = market.budget;
  const coverage =
    b.eventsTotal > 0 ? Math.round((b.eventsWithBudget / b.eventsTotal) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg planned budget" value={php(b.avgCentavos)} />
        <StatTile label="Median planned budget" value={php(b.medianCentavos)} />
        <StatTile
          label="Budgets set"
          value={`${nf.format(b.eventsWithBudget)} / ${nf.format(b.eventsTotal)}`}
          sub={`${coverage}% of events`}
        />
        <StatTile
          label="Budget range"
          value={b.minCentavos === null ? '—' : `${php(b.minCentavos)} – ${php(b.maxCentavos)}`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarListCard
          title="Top regions"
          empty="No events carry a region yet."
          rows={market.topRegions.map((r) => ({
            key: r.region,
            label: regionLabel(r.region),
            count: r.events,
          }))}
          footnote={
            market.unlocatedEvents > 0
              ? `${nf.format(market.unlocatedEvents)} events have no region set.`
              : undefined
          }
        />
        <BarListCard
          title="Events by type"
          empty="No events yet."
          rows={market.eventTypes.map((t) => ({
            key: t.eventType,
            label: eventTypeLabel(t.eventType),
            count: t.events,
          }))}
        />
      </div>
    </div>
  );
}

function BarListCard({
  title,
  rows,
  empty,
  footnote,
}: {
  title: string;
  rows: { key: string; label: string; count: number }[];
  empty: string;
  footnote?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="m-card p-5">
      <p className="m-label-mono mb-3" style={{ color: 'var(--m-slate-2)' }}>
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {empty}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span style={{ color: 'var(--m-ink)' }}>{r.label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
                    {nf.format(r.count)} · {pct}%
                  </span>
                </div>
                <span
                  aria-hidden
                  className="block h-2 rounded-full"
                  style={{
                    width: `${Math.max(4, Math.round((r.count / max) * 100))}%`,
                    background: 'var(--m-orange)',
                    opacity: 0.55,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {footnote ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--m-slate)' }}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="m-card p-4">
      <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{ color: 'var(--m-ink)' }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const TIER_STYLES: Record<LeadTier, { background: string; color: string }> = {
  high_value: { background: '#ECFDF5', color: '#065F46' },
  engaged: { background: '#FFFBEB', color: '#92400E' },
  early: { background: 'var(--m-paper-2)', color: 'var(--m-slate)' },
};

function LeadTable({ rows }: { rows: LeadScoreRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="m-card p-5">
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          No active events to score yet.
        </p>
      </div>
    );
  }
  return (
    <div className="m-card overflow-x-auto p-0">
      <table className="w-full min-w-[56rem] border-collapse">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: 'var(--m-paper-3)', color: 'var(--m-slate-2)' }}
          >
            <th className={TH_CLASS}>Score</th>
            <th className={TH_CLASS}>Tier</th>
            <th className={TH_CLASS}>Event</th>
            <th className={TH_CLASS}>Couple</th>
            <th className={TH_CLASS}>Profile</th>
            <th className={TH_CLASS}>Signals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const signals = [
              r.budgetSet ? 'Budget set' : null,
              r.lineItemCount > 0 ? `${nf.format(r.lineItemCount)} line items` : null,
              r.paymentCount > 0 ? `${nf.format(r.paymentCount)} payments` : null,
              r.autoArrangeUsed ? 'Auto-arrange' : null,
              r.guestCount > 0 ? `${nf.format(r.guestCount)} guests` : null,
              r.vendorCount > 0 ? `${nf.format(r.vendorCount)} vendors` : null,
              r.websiteConfigured ? 'Website' : null,
              r.monogramConfigured ? 'Monogram' : null,
              r.signedInLast7d ? 'Active this week' : null,
            ].filter((s): s is string => s !== null);
            return (
              <tr
                key={r.eventId}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--m-paper-3)' }}
              >
                <td
                  className={`${TD_CLASS} text-base font-semibold tabular-nums`}
                  style={{ color: 'var(--m-ink)' }}
                >
                  {r.score}
                </td>
                <td className={TD_CLASS}>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={TIER_STYLES[r.tier]}
                  >
                    {LEAD_TIER_LABELS[r.tier]}
                  </span>
                </td>
                <td className={TD_CLASS}>
                  <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                    {r.eventName}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
                    {eventTypeLabel(r.eventType)} · {r.eventDate ?? 'date TBD'}
                  </span>
                </td>
                <td className={TD_CLASS}>
                  <span style={{ color: 'var(--m-ink)' }}>
                    {r.ownerDisplayName ?? '—'}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
                    {r.ownerEmail ?? 'no linked account'}
                  </span>
                </td>
                <td className={`${TD_CLASS} tabular-nums`} style={{ color: 'var(--m-ink)' }}>
                  {r.profileCompletionPct}%
                </td>
                <td className={`${TD_CLASS} !whitespace-normal`}>
                  <span className="flex max-w-[26rem] flex-wrap gap-1">
                    {signals.length === 0 ? (
                      <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
                        No engagement yet
                      </span>
                    ) : (
                      signals.map((s) => (
                        <span
                          key={s}
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            background: 'var(--m-paper-2)',
                            color: 'var(--m-slate-2)',
                          }}
                        >
                          {s}
                        </span>
                      ))
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
