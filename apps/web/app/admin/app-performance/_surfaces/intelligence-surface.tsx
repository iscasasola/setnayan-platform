// Insights Studio surface — the body of the former /admin/intelligence page,
// re-homed here (2026-07-10) so the App Performance menu is ONE tabbed
// studio. Its actions/_components stay under /admin/intelligence; the legacy
// route is now a redirect into /admin/app-performance?tab={tab}.
import { cookies } from 'next/headers';
import { Radar, AlertTriangle, Banknote, Trophy } from 'lucide-react';
import {
  fetchIntelligenceStats,
  buildDemoIntelligenceStats,
  STALE_WINDOW_OPTIONS,
  eventTypeLabel,
  regionLabel,
  CHURN_ROW_CAP,
  LEAD_ROW_CAP,
  LEAD_TIER_LABELS,
  type StaleWindowKey,
  type ChurnRiskRow,
  type MarketAnalytics,
  type LeadScoreRow,
  type LeadTier,
} from '@/lib/admin/intelligence-stats';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/demo-mode';
import { fetchAdminOutcomeOverview } from '@/lib/inquiry-outcomes';
import { WonLostAdminCard } from '../_components/won-lost-admin-card';

/**
 * /admin/intelligence — churn radar · market pulse · lead scoring.
 *
 * All three sections are local Postgres aggregations (RPCs from migration
 * 20261202000000) cached for 10 minutes via unstable_cache — zero external
 * AI/API spend, bounded DB load. Mirrors /admin/growth's server-rendered,
 * no-client-JS pattern: GET-form filter, demo-mode cookie, sn-row tiles.
 *
 * ── Converted to <ConsoleTable> 2026-08-17 · BOTH tables ──────────────────
 * Three reads, three ways to fail, and the two tables read a failure as good
 * news: a refused churn read printed "No at-risk events — every couple with an
 * upcoming event has been active", which is the most reassuring sentence on
 * the surface and was being shown precisely when nobody had checked. The
 * banner above them was right the whole time and lost the argument, because a
 * table saying "all clear" outranks a line of small print saying "some metrics
 * couldn't load".
 *
 * The caps were silent too: the churn RPC is asked for 100 rows and the lead
 * RPC for 50, and neither said so. Both numbers now come from the module that
 * passes them to the query.
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

export async function IntelligenceSurface({ searchParams }: Props) {
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

  // Vendor unit-economics scorecard (Wave 6) — re-homed from the retired
  // /admin/insights landing grid (page-layer hygiene 2026-07-12; that route
  // now redirects here). The page already ran requireAdmin() and both RPCs
  // self-gate on is_console_admin(), so these service-role reads only resolve
  // for admins.
  const outcomeOverview = await fetchAdminOutcomeOverview();

  return (
    <div>
      <PageMasthead
        title="Intelligence"
        actions={
          stats.demo ? (
            <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
              Illustrative demo data
            </span>
          ) : null
        }
        className="mb-6"
      />

      {/* Vendor unit economics — Won/Lost reasons (moved from /admin/insights
          so the studio stays the one analytics home). Peso-per-Lead card removed
          2026-07-22 — its token-burn model died when answering became free. */}
      <WonLostAdminCard overview={outcomeOverview} />

      {/* Stale-window picker — GET form, no client JS (mirrors /admin/growth). */}
      <form method="get" className="mb-8 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="intelligence" />
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
        <ChurnTable
          rows={stats.churn}
          readError={stats.churnError}
          staleDays={staleDays}
        />
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
        <LeadTable rows={stats.leads} readError={stats.leadsError} />
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
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sn-gold-500)]/10 text-[var(--sn-gold-700)]">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-xs text-ink/55">{blurb}</p>
      </div>
    </header>
  );
}

function ChurnTable({
  rows,
  readError,
  staleDays,
}: {
  rows: ChurnRiskRow[] | null;
  readError: string | null;
  staleDays: number;
}) {
  return (
    <ConsoleTable
      rows={rows}
      readPermitted
      readError={readError ? { message: readError } : null}
      reads="the churn radar"
      cap={CHURN_ROW_CAP}
      label="Churn radar"
      minWidth="56rem"
      rowKey={(r) => r.eventId}
      empty={{
        Icon: AlertTriangle,
        title: 'No at-risk events',
        blurb: `Every couple with an upcoming event has been active inside the last ${staleDays} days. This is a measured all-clear — a radar that could not be read says so instead.`,
      }}
      columns={[
        {
          header: 'Event',
          cell: (r) => (
            <>
              <span className="font-medium text-ink">{r.eventName}</span>
              <span className="block text-xs text-ink/70">
                {eventTypeLabel(r.eventType)} · {r.publicId}
              </span>
            </>
          ),
        },
        {
          header: 'Couple',
          cell: (r) => (
            <>
              <span className="text-ink">{r.ownerDisplayName ?? '—'}</span>
              <span className="block text-xs text-ink/70">
                {r.ownerEmail ?? 'no linked account'}
              </span>
            </>
          ),
        },
        {
          header: 'Event date',
          hideBelow: 'md',
          mono: true,
          cell: (r) => <span className="text-ink">{r.eventDate}</span>,
        },
        {
          header: 'Days out',
          align: 'right',
          mono: true,
          hideBelow: 'md',
          cell: (r) => <span className="text-ink">{nf.format(r.daysToEvent)}d</span>,
        },
        {
          header: 'Last login',
          hideBelow: 'lg',
          mono: true,
          cell: (r) => <span className="text-ink/70">{fmtDate(r.lastSignInAt)}</span>,
        },
        {
          header: 'Last guest change',
          hideBelow: 'lg',
          mono: true,
          cell: (r) => <span className="text-ink/70">{fmtDate(r.lastGuestChangeAt)}</span>,
        },
        {
          header: 'Last budget change',
          hideBelow: 'xl',
          mono: true,
          cell: (r) => <span className="text-ink/70">{fmtDate(r.lastBudgetChangeAt)}</span>,
        },
        {
          header: 'Quiet for',
          align: 'right',
          cell: (r) => (
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
              style={{ background: '#FEF2F2', color: '#991B1B' }}
            >
              {nf.format(r.daysInactive)}d
            </span>
          ),
        },
      ]}
    />
  );
}

function MarketPulse({ market }: { market: MarketAnalytics | null }) {
  if (!market) {
    return (
      <div className="sn-row p-5">
        <p className="text-sm" style={{ color: 'var(--sn-ink-700)' }}>
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
    <div className="sn-row p-5">
      <p className="sn-eye mb-3" style={{ color: 'var(--sn-ink-500)' }}>
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--sn-ink-700)' }}>
          {empty}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span style={{ color: 'var(--sn-ink-900)' }}>{r.label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--sn-ink-700)' }}>
                    {nf.format(r.count)} · {pct}%
                  </span>
                </div>
                <span
                  aria-hidden
                  className="block h-2 rounded-full"
                  style={{
                    width: `${Math.max(4, Math.round((r.count / max) * 100))}%`,
                    background: 'var(--sn-gold-500)',
                    opacity: 0.55,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {footnote ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--sn-ink-700)' }}>
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
    <div className="sn-row p-4">
      <p className="sn-eye" style={{ color: 'var(--sn-ink-500)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{ color: 'var(--sn-ink-900)' }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--sn-ink-700)' }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const TIER_STYLES: Record<LeadTier, { background: string; color: string }> = {
  high_value: { background: '#ECFDF5', color: '#065F46' },
  engaged: { background: '#FFFBEB', color: '#92400E' },
  early: { background: 'rgba(27, 26, 23, 0.05)', color: 'var(--sn-ink-700)' },
};

/** The engagement chips for one event, in the order the score weighs them. */
function leadSignals(r: LeadScoreRow): string[] {
  return [
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
}

function LeadTable({
  rows,
  readError,
}: {
  rows: LeadScoreRow[] | null;
  readError: string | null;
}) {
  return (
    <ConsoleTable
      rows={rows}
      readPermitted
      readError={readError ? { message: readError } : null}
      reads="the lead scores"
      cap={LEAD_ROW_CAP}
      label="Lead scores"
      minWidth="56rem"
      rowKey={(r) => r.eventId}
      empty={{
        Icon: Trophy,
        title: 'No active events to score yet',
        blurb:
          'Scores appear as soon as there is an active event to rank. Nothing to do here — the list fills itself from what couples are already doing.',
      }}
      columns={[
        {
          header: 'Score',
          align: 'right',
          mono: true,
          cell: (r) => (
            <span className="text-base font-semibold text-ink">{r.score}</span>
          ),
        },
        {
          header: 'Tier',
          cell: (r) => (
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
              style={TIER_STYLES[r.tier]}
            >
              {LEAD_TIER_LABELS[r.tier]}
            </span>
          ),
        },
        {
          header: 'Event',
          cell: (r) => (
            <>
              <span className="font-medium text-ink">{r.eventName}</span>
              <span className="block text-xs text-ink/70">
                {eventTypeLabel(r.eventType)} · {r.eventDate ?? 'date TBD'}
              </span>
            </>
          ),
        },
        {
          header: 'Couple',
          hideBelow: 'md',
          cell: (r) => (
            <>
              <span className="text-ink">{r.ownerDisplayName ?? '—'}</span>
              <span className="block text-xs text-ink/70">
                {r.ownerEmail ?? 'no linked account'}
              </span>
            </>
          ),
        },
        {
          header: 'Profile',
          align: 'right',
          mono: true,
          hideBelow: 'lg',
          cell: (r) => <span className="text-ink">{r.profileCompletionPct}%</span>,
        },
        {
          header: 'Signals',
          hideBelow: 'lg',
          cell: (r) => {
            const signals = leadSignals(r);
            return (
              <span className="flex max-w-[26rem] flex-wrap gap-1">
                {signals.length === 0 ? (
                  <span className="text-xs text-ink/70">No engagement yet</span>
                ) : (
                  signals.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70"
                    >
                      {s}
                    </span>
                  ))
                )}
              </span>
            );
          },
        },
      ]}
    />
  );
}
