/**
 * Insights Studio surface — the body of the former /admin/operations-hiring
 * page, re-homed here (2026-07-10) so the App Performance menu is ONE tabbed
 * studio. Its actions/_components stay under /admin/operations-hiring; the
 * legacy route is now a redirect into /admin/app-performance?tab={tab}.
 *
 * ── Converted to <ConsoleTable> 2026-08-17 ────────────────────────────────
 * The hiring roadmap read reached this page through a loader that logged its
 * error and returned `[]`, so a refused read rendered "Roadmap not seeded —
 * run migration": a confident diagnosis of a DIFFERENT fault, pointing the
 * reader at a migration that is in fact applied (measured in production
 * 2026-08-17: this table holds 4 rows). The loader now reports the refusal and
 * the table says we do not know.
 *
 * ── Re-drawn onto the approved drawing 2026-11-14 (insights.html › Costs › Operations & hiring) ──
 * No tiles (T18): Now is facts, the milestone and the signals are hairline rows with a pill, the roadmap keeps the
 * console table for its honest states. What the page-load sweep does lives in the opening ⓘ (T17); the sweep's own
 * result for THIS load stays a visible line, because it is news, not explanation.
 */
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import {
  getBottleneckSignals,
  getHiringRoadmapResult,
  getMilestoneForecasts,
  getRecentAlerts,
  refreshBottleneckSignalsIfStale,
} from '@/lib/hiring-guide/queries';
import { runHiringAlertSweep } from '@/lib/hiring-guide/alert-engine';
import {
  JAN_30_2027_SUNSET,
  SIGNAL_THRESHOLDS,
  type SignalLevel,
} from '@/lib/hiring-guide/types';
import { SmokeTestPanel } from '@/app/admin/operations-hiring/_components/smoke-test-panel';
import { formatCount } from '@/lib/format-number';
import { Badge, Facts, One, Row, Rows, Sec, type NumTone } from '../_components/insights-parts';

const SIGNAL_TONE: Record<SignalLevel, NumTone> = {
  green: 'ok',
  yellow: 'warn',
  red: 'danger',
};

const SIGNAL_DOT: Record<SignalLevel, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
};

/** The shared `Row` cuts its second line with "…"; a forecast or a threshold must never be cut away, so it wraps. */
function Wraps({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatPhp(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `₱${n.toLocaleString('en-PH')}`;
}

export async function OperationsHiringSurface() {
  // Refresh stale signals before reading
  await refreshBottleneckSignalsIfStale();

  // On-access alert sweep — fires new bottleneck/milestone/countdown alerts
  // and dispatches emails to iscasasolaii@gmail.com (per
  // reference_setnayan_owner_email memory). No pg_cron — see
  // reference_setnayan_cron_strategy.
  const dashboardUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com') +
    '/admin/app-performance?tab=operations';
  const sweep = await runHiringAlertSweep(dashboardUrl).catch((err) => {
    console.error('[operations-hiring] alert sweep failed', err);
    return { alertsFired: 0, emailsSent: 0, emailsFailed: 0, errors: [String(err)] };
  });

  const [signals, roadmapRes, alerts] = await Promise.all([
    getBottleneckSignals(),
    getHiringRoadmapResult(),
    getRecentAlerts(),
  ]);
  // Nullable all the way to the render — see the loader's own note.
  const roadmap = roadmapRes.rows;

  const verifiedActive = signals?.verified_active ?? 0;
  const milestones = await getMilestoneForecasts(verifiedActive);
  const sunsetDays = daysUntil(JAN_30_2027_SUNSET);

  return (
    <div className="max-w-3xl">
      <PageMasthead
        title="Operations & Hiring"
      />

      <One label="Loading this page runs a sweep">
        It refreshes stale signals and runs the alert sweep, so opening it can fire alerts and send emails. Alerts
        route to <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">iscasasolaii@gmail.com</code> via 0028 email
        infra (Resend primary, SendGrid fallback). Weekly digest fires Mon 8am PHT. Bottleneck alerts fire when a
        signal flips yellow → red (suppressed 7 days after fire). Milestone alerts fire when verified-supplier count
        crosses 100 / 1,000 / 5,000 / 25,000. Hiring countdown emails fire T-30 / T-14 / T-7 days from each hire-by
        date in the roadmap below.
      </One>
      {sweep.alertsFired > 0 && (
        <p className="mt-1 text-[13px] text-ink/70" role="status">
          <strong>This page-load sweep:</strong> {sweep.alertsFired} new alert{sweep.alertsFired === 1 ? '' : 's'}{' '}
          recorded · {sweep.emailsSent} email{sweep.emailsSent === 1 ? '' : 's'} sent
          {sweep.emailsFailed > 0 && ` · ${sweep.emailsFailed} failed`}.
        </p>
      )}
      {sweep.errors.length > 0 && (
        <p className="mt-1 text-[13px] text-[var(--sn-danger)]" role="alert">
          Sweep errors: {sweep.errors.join('; ')}
        </p>
      )}

      {/* Unacknowledged alerts */}
      {alerts.length > 0 && (
        <section aria-labelledby="ops-alerts">
          <Sec id="ops-alerts" title={`Unacknowledged alert${alerts.length === 1 ? '' : 's'}`} count={alerts.length} />
          <Rows label="Unacknowledged alerts" data="ops-alerts">
            {alerts.slice(0, 5).map((alert) => (
              <Row
                key={alert.alert_id}
                title={
                  <span className="text-[var(--sn-danger)]">
                    {alert.alert_type.replace(/_/g, ' ')}
                    {alert.signal_name && ` · ${alert.signal_name}`}
                  </span>
                }
                sub={new Date(alert.fired_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
              />
            ))}
          </Rows>
        </section>
      )}

      {/* NOW */}
      <section aria-labelledby="ops-now">
        <Sec id="ops-now" title="Now" />
        {signals ? (
          <Facts
            data="ops-now"
            rows={[
              ['Verified active suppliers', signals.verified_active.toLocaleString('en-PH')],
              ['Signups (last 7d)', formatCount(signals.signups_last_week)],
              ['Prior week', formatCount(signals.signups_prior_week)],
              ['Refreshed', new Date(signals.refreshed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })],
            ]}
          />
        ) : (
          <p className="text-[13px] text-ink/60">
            These numbers haven&rsquo;t been calculated yet. They fill in on their own — check back later.
          </p>
        )}
      </section>

      {/* NEXT MILESTONE */}
      <section aria-labelledby="ops-milestone">
        <Sec id="ops-milestone" title="Next milestone" />
        {milestones.length > 0 ? (
          <Rows label="Next milestones" data="ops-milestones">
            {milestones.slice(0, 3).map((m) => (
              <Row
                key={m.milestone_label}
                title={m.milestone_label}
                tone={m.weeks_to_milestone === null && m.signups_measured === false ? 'warn' : undefined}
                sub={
                  <Wraps>
                    {m.weeks_to_milestone !== null
                      ? `Projected ${m.forecasted_date} (~${m.weeks_to_milestone} weeks)`
                      : m.signups_measured === false
                        ? 'Signups could not be read — this is not a forecast of no growth'
                        : 'Insufficient signup data'}
                  </Wraps>
                }
                trail={m.milestone_target.toLocaleString('en-PH')}
              />
            ))}
          </Rows>
        ) : (
          <p className="text-[13px] text-ink/60">No milestones to forecast yet.</p>
        )}
      </section>

      {/* Bottleneck signals */}
      <section aria-labelledby="ops-signals">
        <Sec id="ops-signals" title="Bottleneck signals" about="Live — refreshed when stale, each time this page opens." />
        {signals ? (
          <Rows label="Bottleneck signals" data="ops-signals">
            <SignalRow
              icon={SIGNAL_DOT[signals.verification_signal]}
              label="Supplier verification"
              detail={`${formatCount(signals.verification_backlog_count)} pending`}
              level={signals.verification_signal}
              threshold={SIGNAL_THRESHOLDS.verification}
            />
            <SignalRow
              icon={SIGNAL_DOT[signals.support_signal]}
              label="Customer support response"
              detail={`${signals.support_avg_response_hours.toFixed(1)}h avg (last 7d)`}
              level={signals.support_signal}
              threshold={SIGNAL_THRESHOLDS.support}
            />
            <SignalRow
              icon={SIGNAL_DOT[signals.marketing_signal]}
              label="Marketing pipeline"
              detail={`${signals.signups_last_week} signups vs ${signals.signups_prior_week} prior week`}
              level={signals.marketing_signal}
              threshold={SIGNAL_THRESHOLDS.marketing}
            />
            <SignalRow
              icon={SIGNAL_DOT[signals.disputes_signal]}
              label="Open disputes / force majeure"
              detail={`${signals.open_disputes} open`}
              level={signals.disputes_signal}
              threshold={SIGNAL_THRESHOLDS.disputes}
            />
            <Row
              title="Engineering blockers"
              sub={<Wraps>manual — track in your ops doc · {SIGNAL_THRESHOLDS.engineering.green}</Wraps>}
              trail={<Badge><span aria-hidden="true">⚪</span></Badge>}
            />
            <Row
              title="Founder time on one function"
              sub={<Wraps>manual — not tracked here yet · {SIGNAL_THRESHOLDS.founder_time.green}</Wraps>}
              trail={<Badge><span aria-hidden="true">⚪</span></Badge>}
            />
          </Rows>
        ) : (
          <p className="text-[13px] text-ink/60">These signals haven&rsquo;t been calculated yet — check back later.</p>
        )}
      </section>

      {/* Hiring roadmap */}
      <section aria-labelledby="ops-roadmap">
        <Sec
          id="ops-roadmap"
          title="Hiring roadmap"
          about="Jan 30, 2027 capacity milestone. The roadmap is seeded by migration and edited from Operations & Hiring."
          right={sunsetDays > 0 ? `${sunsetDays} days to milestone` : 'Milestone reached'}
        />
        <ConsoleTable
          rows={roadmap}
          readPermitted
          readError={roadmapRes.error}
          reads="the hiring roadmap"
          label="Hiring roadmap"
          minWidth="20rem"
          rowKey={(role) => String(role.role_id)}
          empty={{
            Icon: Users,
            title: 'No roles on the roadmap',
            blurb:
              'An empty roadmap means every seeded role has been removed — it does not mean the read failed; a failed read says so in its own words.',
          }}
          columns={[
            {
              header: 'Hire by',
              mono: true,
              cell: (role) => <span className="text-ink/80">{role.hire_by_date}</span>,
            },
            {
              header: 'Role',
              cell: (role) => (
                <span className="font-medium text-ink">{role.role_title}</span>
              ),
            },
            {
              header: 'Salary (PHP/mo)',
              hideBelow: 'md',
              mono: true,
              cell: (role) => (
                <span className="whitespace-nowrap text-ink/70">
                  {formatPhp(role.salary_range_min_php)} – {formatPhp(role.salary_range_max_php)}
                </span>
              ),
            },
            {
              header: 'Status',
              hideBelow: 'lg',
              cell: (role) => <Badge>{role.status.replace(/_/g, ' ')}</Badge>,
            },
            {
              header: 'Days',
              align: 'right',
              mono: true,
              cell: (role) => (
                <span
                  className={
                    role.days_until_hire_by < 30
                      ? 'font-semibold text-[var(--sn-danger)]'
                      : 'text-ink/70'
                  }
                >
                  {role.days_until_hire_by > 0
                    ? `+${role.days_until_hire_by}d`
                    : `${role.days_until_hire_by}d`}
                </span>
              ),
            },
          ]}
        />
      </section>

      {/* Smoke tests */}
      <SmokeTestPanel />
    </div>
  );
}

function SignalRow({
  icon,
  label,
  detail,
  level,
  threshold,
}: {
  icon: string;
  label: string;
  detail: string;
  level: SignalLevel;
  threshold: { green: string; yellow: string; red: string };
}) {
  return (
    <Row
      title={label}
      sub={
        <Wraps>
          {detail} · {level === 'green' ? threshold.green : level === 'yellow' ? threshold.yellow : threshold.red}
        </Wraps>
      }
      trail={
        <Badge tone={SIGNAL_TONE[level]}>
          <span aria-hidden="true">{icon}</span>
          <span className="sr-only">{level}</span>
        </Badge>
      }
    />
  );
}
