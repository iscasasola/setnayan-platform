import {
  getBottleneckSignals,
  getHiringRoadmap,
  getMilestoneForecasts,
  getRecentAlerts,
  refreshBottleneckSignalsIfStale,
} from '@/lib/hiring-guide/queries';
import {
  JAN_30_2027_SUNSET,
  SIGNAL_THRESHOLDS,
  type SignalLevel,
} from '@/lib/hiring-guide/types';

export const metadata = { title: 'Operations & Hiring · Growth Cockpit · Admin' };

const SIGNAL_TONE: Record<SignalLevel, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SIGNAL_DOT: Record<SignalLevel, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
};

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

export default async function OperationsHiringPage() {
  // Refresh stale signals before reading
  await refreshBottleneckSignalsIfStale();

  const [signals, roadmap, alerts] = await Promise.all([
    getBottleneckSignals(),
    getHiringRoadmap(),
    getRecentAlerts(),
  ]);

  const verifiedActive = signals?.verified_active ?? 0;
  const milestones = await getMilestoneForecasts(verifiedActive);
  const sunsetDays = daysUntil(JAN_30_2027_SUNSET);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Operations & Hiring</h1>
        <p className="text-sm text-ink/60">
          Growth Cockpit — bottleneck signals, milestone forecasts, and hiring roadmap tied to the Jan 30, 2027 sunset.
        </p>
      </header>

      {/* Unacknowledged alerts banner */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-900">
            {alerts.length} unacknowledged alert{alerts.length === 1 ? '' : 's'}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {alerts.slice(0, 5).map((alert) => (
              <li key={alert.alert_id}>
                <span className="font-medium">{alert.alert_type.replace(/_/g, ' ')}</span>
                {alert.signal_name && ` · ${alert.signal_name}`}
                <span className="ml-2 text-xs text-rose-700/70">
                  {new Date(alert.fired_at).toLocaleString('en-PH')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* NOW + NEXT MILESTONE */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-cream p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Now</h2>
          {signals ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink/60">Verified active vendors</dt>
                <dd className="text-2xl font-semibold text-ink">{signals.verified_active.toLocaleString('en-PH')}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink/60">Signups (last 7d)</dt>
                <dd className="text-lg font-medium text-ink">{signals.signups_last_week}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink/60">Prior week</dt>
                <dd className="text-sm text-ink/70">{signals.signups_prior_week}</dd>
              </div>
              <div className="text-xs text-ink/50 pt-2 border-t border-ink/10">
                Refreshed {new Date(signals.refreshed_at).toLocaleString('en-PH')}
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink/50">
              Signal data not yet populated. Run{' '}
              <code className="rounded bg-ink/5 px-1 py-0.5 text-xs">
                REFRESH MATERIALIZED VIEW public.bottleneck_signals_current
              </code>
              .
            </p>
          )}
        </div>

        <div className="rounded-lg border border-ink/10 bg-cream p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Next milestone</h2>
          {milestones.length > 0 ? (
            <div className="mt-3 space-y-3 text-sm">
              {milestones.slice(0, 3).map((m) => (
                <div key={m.milestone_label} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium text-ink">{m.milestone_label}</span>
                    <span className="text-ink/60">{m.milestone_target.toLocaleString('en-PH')}</span>
                  </div>
                  <div className="text-xs text-ink/60">
                    {m.weeks_to_milestone !== null
                      ? `Projected ${m.forecasted_date} (~${m.weeks_to_milestone} weeks)`
                      : 'Insufficient signup data'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/50">No milestones to forecast yet.</p>
          )}
        </div>
      </section>

      {/* Bottleneck signals */}
      <section className="rounded-lg border border-ink/10 bg-cream p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Bottleneck signals (live)</h2>
        {signals ? (
          <ul className="mt-3 space-y-2 text-sm">
            <SignalRow
              icon={SIGNAL_DOT[signals.verification_signal]}
              label="Vendor verification"
              detail={`${signals.verification_backlog_count} pending`}
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
            <li className="flex items-center justify-between gap-3 rounded border border-ink/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span>⚪</span>
                <span className="font-medium text-ink">Engineering blockers</span>
                <span className="text-xs text-ink/60">(manual — track in your ops doc)</span>
              </div>
              <span className="text-xs text-ink/50">{SIGNAL_THRESHOLDS.engineering.green}</span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded border border-ink/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span>⚪</span>
                <span className="font-medium text-ink">Founder time on one function</span>
                <span className="text-xs text-ink/60">(self-report weekly via /admin/operations-hiring/time-log)</span>
              </div>
              <span className="text-xs text-ink/50">{SIGNAL_THRESHOLDS.founder_time.green}</span>
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink/50">Signals materialized view empty — refresh needed.</p>
        )}
      </section>

      {/* Hiring roadmap */}
      <section className="rounded-lg border border-ink/10 bg-cream p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            Hiring roadmap (Jan 30, 2027 sunset)
          </h2>
          <span className="text-xs text-ink/60">
            {sunsetDays > 0 ? `${sunsetDays} days to sunset` : 'Sunset reached'}
          </span>
        </div>
        {roadmap.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs font-medium uppercase tracking-wide text-ink/50">
                <th className="py-2">Hire by</th>
                <th>Role</th>
                <th>Salary (PHP/mo)</th>
                <th>Status</th>
                <th className="text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {roadmap.map((role) => (
                <tr key={role.role_id} className="border-b border-ink/5">
                  <td className="py-3 text-ink/80">{role.hire_by_date}</td>
                  <td className="py-3 font-medium text-ink">{role.role_title}</td>
                  <td className="py-3 text-ink/70">
                    {formatPhp(role.salary_range_min_php)} – {formatPhp(role.salary_range_max_php)}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex rounded bg-ink/5 px-2 py-0.5 text-xs uppercase tracking-wide text-ink/70">
                      {role.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={`py-3 text-right tabular-nums ${role.days_until_hire_by < 30 ? 'font-semibold text-rose-700' : 'text-ink/70'}`}>
                    {role.days_until_hire_by > 0 ? `+${role.days_until_hire_by}d` : `${role.days_until_hire_by}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-ink/50">Roadmap not seeded — run migration.</p>
        )}
      </section>

      {/* Footer note */}
      <footer className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-xs text-ink/60">
        <p>
          Alerts route to{' '}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">iscasasolaii@gmail.com</code> via 0028 email
          infra (Resend primary, SendGrid fallback). Weekly digest fires Mon 8am PHT. Bottleneck alerts fire when a
          signal flips yellow → red (suppressed 7 days after fire). Milestone alerts fire when verified-vendor count
          crosses 100 / 1,000 / 5,000 / 25,000. Hiring countdown emails fire T-30 / T-14 / T-7 days from each
          hire-by date in the roadmap above.
        </p>
      </footer>
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
    <li className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${SIGNAL_TONE[level]}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-70">{detail}</span>
      </div>
      <span className="text-xs opacity-60">
        {level === 'green' ? threshold.green : level === 'yellow' ? threshold.yellow : threshold.red}
      </span>
    </li>
  );
}
