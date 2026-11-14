import type { AdminOutcomeOverview, OutcomeState } from '@/lib/inquiry-outcomes';
import { Fold } from '@/app/_components/fold';
import { Badge, Nums, Row, Rows, Sec } from './insights-parts';

/**
 * Won & Lost Reasons aggregate report (Wave 6) — rendered on Insights ›
 * Intelligence (moved from the retired /admin/insights). Platform-wide tally of
 * the vendor-self-reported inquiry outcomes (won / lost / no-response) + the
 * top reasons behind each, read from admin_inquiry_outcomes_overview
 * (admin-gated).
 *
 * BEHAVIORAL HONESTY: "Won" is a VENDOR self-reported signal, not a verified
 * on-platform payment — Setnayan settles off-platform. The section says so (in
 * its ⓘ) and never treats "won" as revenue.
 *
 * Re-drawn 2026-11-14 onto the approved drawing (`admin_pub/insights.html` ›
 * Intelligence): no card frame around read-only facts (T18) — a section head
 * with its ⓘ and the "Soon" badge, the three totals as `Nums`, each outcome's
 * top reasons as a fold of hairline rows, and the reporting-supplier count as
 * the closing line. The name `WonLostAdminCard` stays (its one caller).
 */

const META: Record<OutcomeState, { label: string }> = {
  won: { label: 'Won' },
  lost: { label: 'Lost' },
  no_response: { label: 'No response' },
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
  const keys = Object.keys(META) as OutcomeState[];

  return (
    <section aria-labelledby="won-lost" data-testid="won-lost">
      <Sec
        id="won-lost"
        title="Won & lost reasons"
        about={
          <>
            Supplier inquiry outcomes — what suppliers say happens to their inquiries, and why. Self-reported, so
            &ldquo;won&rdquo; is a supplier signal (they settle off-platform), not a verified payment.
          </>
        }
        right={<Badge tone="info">Soon</Badge>}
      />

      <Nums
        data="won-lost-totals"
        items={keys.map((key) => ({ value: totals[key], label: META[key].label.toLowerCase() }))}
      />

      {hasData ? (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {keys.map((key) => {
            const rows = byOutcome[key];
            const top = rows[0];
            return (
              <Fold
                key={key}
                data={`won-lost-${key}`}
                title={`${META[key].label} — top reasons`}
                summary={top ? `${top.label} · ${nf.format(top.n)}` : 'None logged yet.'}
              >
                {rows.length > 0 ? (
                  <Rows label={`${META[key].label} — top reasons`}>
                    {rows.map((r) => (
                      <Row key={`${key}-${r.reasonCode ?? 'none'}`} title={r.label} trail={nf.format(r.n)} />
                    ))}
                  </Rows>
                ) : (
                  <p className="pb-3 text-[13px] text-ink/65">None logged yet.</p>
                )}
              </Fold>
            );
          })}
        </div>
      ) : (
        <p className="py-1 text-[13px] text-ink/65">
          No outcomes logged yet — suppliers appear here once they mark an inquiry won, lost, or no-response from
          their Messages.
        </p>
      )}

      <p className="mt-1.5 text-[13px] text-ink/65">
        {nf.format(totals.reporting_vendors)} reporting suppliers · {nf.format(totals.total)} outcomes logged
      </p>
    </section>
  );
}
