// Insights Studio surface — the body of the former /admin/intelligence page,
// re-homed here (2026-07-10) so the App Performance menu is ONE tabbed
// studio. Its actions/_components stay under /admin/intelligence; the legacy
// route is now a redirect into /admin/app-performance?tab={tab}.
import { manilaDayLabel, manilaStampLabel } from '@/lib/admin/manila-stamp';
import { readEventTypeNames, type EventTypeName } from '@/lib/admin/event-type-names.server';
import { cookies } from 'next/headers';
import { AlertTriangle, Trophy } from 'lucide-react';
import {
  fetchIntelligenceStats,
  buildDemoIntelligenceStats,
  STALE_WINDOW_OPTIONS,
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
import { ReadFailed } from '@/app/admin/_components/read-failed';
import { Fold } from '@/app/_components/fold';
import { Badge, Facts, One, Row, Rows, Sec, type NumTone } from '../_components/insights-parts';
import { InsightsParamPick } from '../_components/insights-param-pick';

/**
 * /admin/intelligence — churn radar · market pulse · lead scoring.
 *
 * All three sections are local Postgres aggregations (RPCs from migration
 * 20261202000000) cached for 10 minutes via unstable_cache — zero external
 * AI/API spend, bounded DB load. Mirrors /admin/growth's server-rendered,
 * server-rendered pattern: demo-mode cookie, the churn window as the one
 * dropdown row (`InsightsParamPick`, moves `?quiet=` — the old native select +
 * Apply GET form went, 2026-11-14, approved drawing `admin_pub/insights.html` ›
 * Intelligence). Read-only facts are `Facts` and hairline rows, never tiles (T18);
 * each section's explanation lives in its ⓘ (T17).
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
  return manilaDayLabel(iso);
}

export async function IntelligenceSurface({ searchParams }: Props) {
  const { quiet: rawQuiet, demo: rawDemo } = await searchParams;
  // 🏷 F-A-15: event types by their admin-managed names ("Get-together"), never "simple event".
  const typeName = await readEventTypeNames();
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
    <div className="max-w-3xl">
      <PageMasthead
        title="Intelligence"
        actions={stats.demo ? <Badge tone="warn">Illustrative demo data</Badge> : null}
        className="mb-0"
      />
      {stats.demo ? (
        <One label="Demo data">
          Sample figures so you can see the shape of this surface before real data accrues. Turn off demo mode to see
          live counts.
        </One>
      ) : null}

      {/* Churn window — the one dropdown (approved drawing: fr('Churn window', …)), never a native select with an Apply. */}
      <InsightsParamPick
        name="Churn window"
        param="quiet"
        value={windowKey}
        options={STALE_WINDOW_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
        about={`Refreshed ${manilaStampLabel(stats.generatedAt)}.`}
      />

      {stats.errors.length > 0 ? (
        <p role="alert" className="my-2 rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
          <b>Some metrics couldn&apos;t load: {stats.errors.join(' · ')}</b> — that is not the same as none.
        </p>
      ) : null}

      {/* Vendor unit economics — Won/Lost reasons (moved from /admin/insights
          so the studio stays the one analytics home). Peso-per-Lead card removed
          2026-07-22 — its token-burn model died when answering became free. */}
      <WonLostAdminCard overview={outcomeOverview} />

      {/* ── CHURN RADAR ────────────────────────────────────────────── */}
      <section aria-labelledby="intel-churn">
        <Sec
          id="intel-churn"
          title="Churn radar"
          about={`Upcoming events whose couple has had zero activity — no login, guest change, budget entry, or seating edit — for ${staleDays}+ days.`}
          count={stats.churn ? stats.churn.length : null}
        />
        <ChurnTable
          rows={stats.churn}
          readError={stats.churnError}
          staleDays={staleDays}
          typeName={typeName}
        />
      </section>

      {/* ── MARKET PULSE ───────────────────────────────────────────── */}
      <section aria-labelledby="intel-market">
        <Sec
          id="intel-market"
          title="Market pulse"
          about="Planned budgets, where events are happening, and what kinds of events the platform is hosting. Non-archived events only."
        />
        <MarketPulse market={stats.market} typeName={typeName} />
      </section>

      {/* ── LEAD SCORES ────────────────────────────────────────────── */}
      <section aria-labelledby="intel-leads">
        <Sec
          id="intel-leads"
          title="Lead scores"
          about="Engagement-ranked active events (0–100). Couples who set a budget AND ran seating Auto-arrange concentrate in the top tier — the warmest upsell list on the platform."
          count={stats.leads ? stats.leads.length : null}
        />
        <LeadTable rows={stats.leads} readError={stats.leadsError} typeName={typeName} />
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Presentational helpers (server-rendered; the folds are the client island) */
/* ────────────────────────────────────────────────────────────────── */

function ChurnTable({
  rows,
  readError,
  staleDays,
  typeName,
}: {
  typeName: EventTypeName;
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
      minWidth="20rem"
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
                {typeName(r.eventType)} · {r.publicId}
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
            <Badge tone="warn">quiet {nf.format(r.daysInactive)}d</Badge>
          ),
        },
      ]}
    />
  );
}

function MarketPulse({ market, typeName }: { market: MarketAnalytics | null; typeName: EventTypeName }) {
  if (!market) {
    return (
      <>
        <Facts
          data="intel-market"
          rows={[
            ['Avg planned budget', null],
            ['Median planned budget', null],
            ['Budgets set', null],
            ['Budget range', null],
          ]}
        />
        <ReadFailed what="the market aggregates" />
      </>
    );
  }
  const b = market.budget;
  const coverage =
    b.eventsTotal > 0 ? Math.round((b.eventsWithBudget / b.eventsTotal) * 100) : 0;
  return (
    <>
      <Facts
        data="intel-market"
        rows={[
          ['Avg planned budget', php(b.avgCentavos)],
          ['Median planned budget', php(b.medianCentavos)],
          ['Budgets set', `${nf.format(b.eventsWithBudget)} / ${nf.format(b.eventsTotal)} · ${coverage}% of events`],
          ['Budget range', b.minCentavos === null ? '—' : `${php(b.minCentavos)} – ${php(b.maxCentavos)}`],
          ...(market.unlocatedEvents > 0
            ? ([['No region set', `${nf.format(market.unlocatedEvents)} events`]] as [string, string][])
            : []),
        ]}
      />
      <div className="divide-y divide-ink/10 border-y border-ink/10">
        <ShareFold
          title="Top regions"
          empty="No events carry a region yet."
          rows={market.topRegions.map((r) => ({
            key: r.region,
            label: regionLabel(r.region),
            count: r.events,
          }))}
        />
        <ShareFold
          title="Events by type"
          empty="No events yet."
          rows={market.eventTypes.map((t) => ({
            key: t.eventType,
            label: typeName(t.eventType),
            count: t.events,
          }))}
        />
      </div>
    </>
  );
}

/** A share list as a fold: the row names its top entries; it opens to every row with its meter (no card frame — T18). */
function ShareFold({
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
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const summary =
    rows.length === 0
      ? empty
      : rows
          .slice(0, 3)
          .map((r) => r.label)
          .join(' · ');
  return (
    <Fold title={title} summary={summary} data={`intel-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {rows.length === 0 ? (
        <p className="pb-3 text-[13px] text-ink/65">{empty}</p>
      ) : (
        <Rows label={title}>
          {rows.map((r, i) => (
            <Row
              key={r.key}
              title={r.label}
              sub={
                <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.round((r.count / max) * 100))}%`,
                      background: i === 0 ? 'var(--sn-accent)' : 'var(--sn-ink-300)',
                    }}
                  />
                </span>
              }
              trail={`${nf.format(r.count)} · ${pct(r.count)}%`}
            />
          ))}
        </Rows>
      )}
      {footnote ? <p className="pb-3 pt-1 text-[12px] text-ink/65">{footnote}</p> : null}
    </Fold>
  );
}

const TIER_TONE: Record<LeadTier, NumTone | undefined> = {
  high_value: 'ok',
  engaged: 'warn',
  early: undefined,
};

/** The engagement chips for one event, in the order the score weighs them. */
function leadSignals(r: LeadScoreRow): string[] {
  return [
    r.budgetSet ? 'Budget set' : null,
    r.lineItemCount > 0 ? `${nf.format(r.lineItemCount)} line items` : null,
    r.paymentCount > 0 ? `${nf.format(r.paymentCount)} payments` : null,
    r.autoArrangeUsed ? 'Auto-arrange' : null,
    r.guestCount > 0 ? `${nf.format(r.guestCount)} guests` : null,
    r.vendorCount > 0 ? `${nf.format(r.vendorCount)} suppliers` : null,
    r.websiteConfigured ? 'Website' : null,
    r.monogramConfigured ? 'Monogram' : null,
    r.signedInLast7d ? 'Active this week' : null,
  ].filter((s): s is string => s !== null);
}

function LeadTable({
  rows,
  readError,
  typeName,
}: {
  rows: LeadScoreRow[] | null;
  readError: string | null;
  typeName: EventTypeName;
}) {
  return (
    <ConsoleTable
      rows={rows}
      readPermitted
      readError={readError ? { message: readError } : null}
      reads="the lead scores"
      cap={LEAD_ROW_CAP}
      label="Lead scores"
      minWidth="20rem"
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
            <Badge tone={TIER_TONE[r.tier]}>{LEAD_TIER_LABELS[r.tier]}</Badge>
          ),
        },
        {
          header: 'Event',
          cell: (r) => (
            <>
              <span className="font-medium text-ink">{r.eventName}</span>
              <span className="block text-xs text-ink/70">
                {typeName(r.eventType)} · {r.eventDate ?? 'date TBD'}
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
              <span className="block max-w-[26rem] text-xs text-ink/70">
                {signals.length === 0 ? 'No engagement yet' : signals.join(' · ')}
              </span>
            );
          },
        },
      ]}
    />
  );
}
