import { Trophy } from 'lucide-react';
import type { AdminOutcomeOverview, OutcomeState } from '@/lib/inquiry-outcomes';

/**
 * Won & Lost Reasons aggregate report card (Wave 6) — rendered on
 * /admin/insights beside the Peso-per-lead card. Platform-wide tally of the
 * vendor-self-reported inquiry outcomes (won / lost / no-response) + the top
 * reasons behind each, read from admin_inquiry_outcomes_overview (admin-gated).
 *
 * BEHAVIORAL HONESTY: "Won" is a VENDOR self-reported signal, not a verified
 * on-platform payment — Setnayan settles off-platform. The card says so and
 * never treats "won" as revenue.
 */

const META: Record<OutcomeState, { label: string; tone: string }> = {
  won: { label: 'Won', tone: 'text-mulberry' },
  lost: { label: 'Lost', tone: 'text-terracotta-700' },
  no_response: { label: 'No response', tone: 'text-ink/60' },
};

const nf = new Intl.NumberFormat('en-PH');

export function WonLostAdminCard({ overview }: { overview: AdminOutcomeOverview }) {
  const { totals, byReason } = overview;
  const hasData = totals.total > 0;

  const byOutcome: Record<OutcomeState, typeof byReason> = {
    won: byReason.filter((r) => r.outcome === 'won').slice(0, 4),
    lost: byReason.filter((r) => r.outcome === 'lost').slice(0, 4),
    no_response: byReason.filter((r) => r.outcome === 'no_response').slice(0, 4),
  };

  return (
    <section className="m-card mb-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
            Vendor inquiry outcomes
          </p>
          <h2 className="m-display-tight mt-1 text-2xl" style={{ color: 'var(--m-ink)' }}>
            Won &amp; lost reasons
          </h2>
          <p className="mt-1 max-w-prose text-sm" style={{ color: 'var(--m-slate)' }}>
            What vendors say happens to their inquiries — and why. Self-reported,
            so &ldquo;won&rdquo; is a vendor signal (they settle off-platform), not a
            verified payment.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
          <Trophy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Soon
        </span>
      </div>

      {/* Totals */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {(Object.keys(META) as OutcomeState[]).map((key) => (
          <Metric key={key} label={META[key].label} value={nf.format(totals[key])} />
        ))}
        <Metric
          label="Reporting vendors"
          value={nf.format(totals.reporting_vendors)}
          sub={`${nf.format(totals.total)} outcomes logged`}
          emphasis
        />
      </div>

      {/* Per-outcome top reasons */}
      {hasData ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {(Object.keys(META) as OutcomeState[]).map((key) => {
            const rows = byOutcome[key];
            return (
              <div
                key={key}
                className="rounded-lg border px-4 py-3"
                style={{ borderColor: 'var(--m-line)' }}
              >
                <p className={`text-xs font-semibold ${META[key].tone}`}>
                  {META[key].label} — top reasons
                </p>
                {rows.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {rows.map((r) => (
                      <li
                        key={`${key}-${r.reasonCode ?? 'none'}`}
                        className="flex items-center justify-between gap-3 text-sm text-ink/75"
                      >
                        <span className="truncate">{r.label}</span>
                        <span className="shrink-0 tabular-nums font-medium text-ink">
                          {nf.format(r.n)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-ink/45">None logged yet.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-4 text-center text-sm text-ink/55">
          No outcomes logged yet — vendors appear here once they mark an inquiry
          won, lost, or no-response from their Messages.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={'rounded-lg border px-4 py-3 ' + (emphasis ? 'bg-ink/[0.02]' : '')}
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-ink/50">{sub}</p> : null}
    </div>
  );
}
