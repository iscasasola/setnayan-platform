import { Trophy, X, MessageSquareOff } from 'lucide-react';
import type { VendorOutcomeRollup, OutcomeState } from '@/lib/inquiry-outcomes';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * Won & Lost Reasons roll-up (Wave 6) — the vendor's own outcome breakdown,
 * mounted on the Messages surface above the thread list. Reads from
 * vendor_inquiry_outcomes_rollup (ownership-gated). Renders nothing until the
 * vendor has logged at least one outcome, so an empty Messages page stays clean.
 *
 * "Won" is self-reported (off-platform), not a verified payment — the footnote
 * says so.
 */

const META: Record<
  OutcomeState,
  { label: string; icon: typeof Trophy; tone: string }
> = {
  won: { label: 'Won', icon: Trophy, tone: 'text-mulberry' },
  lost: { label: 'Lost', icon: X, tone: 'text-terracotta-700' },
  no_response: { label: 'No response', icon: MessageSquareOff, tone: 'text-[color:var(--m-slate-2)]' },
};

const nf = new Intl.NumberFormat('en-PH');

export function InquiryOutcomesRollup({
  rollup,
}: {
  rollup: VendorOutcomeRollup | null;
}) {
  // Omit entirely when unavailable or empty — never a hollow card.
  if (!rollup || rollup.totals.total === 0) return null;

  const { totals, byReason } = rollup;
  // Group the per-reason rows by outcome, preserving the RPC's n-desc order.
  const byOutcome: Record<OutcomeState, typeof byReason> = {
    won: byReason.filter((r) => r.outcome === 'won'),
    lost: byReason.filter((r) => r.outcome === 'lost'),
    no_response: byReason.filter((r) => r.outcome === 'no_response'),
  };

  return (
    <section className="mb-6 sn-row p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Won &amp; lost</h2>
        <span className="tabular-nums text-[13px] uppercase tracking-[0.15em] text-[color:var(--m-slate-2)]">
          From {nf.format(totals.total)} logged
        </span>
      </div>

      {/* Totals strip */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(META) as OutcomeState[]).map((key) => {
          const meta = META[key];
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className="rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-center"
            >
              <Icon
                className={`mx-auto h-4 w-4 ${meta.tone}`}
                strokeWidth={2}
                aria-hidden
              />
              <p className="mt-1 text-lg font-semibold text-ink">
                {nf.format(totals[key])}
              </p>
              <p className="text-[13px] uppercase tracking-[0.12em] text-[color:var(--m-slate-2)]">
                {meta.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Per-reason breakdown */}
      <div className="mt-4 space-y-3">
        {(Object.keys(META) as OutcomeState[]).map((key) => {
          const rows = byOutcome[key];
          if (rows.length === 0) return null;
          return (
            <div key={key}>
              <p className={`text-xs font-semibold ${META[key].tone}`}>
                {META[key].label} — why
              </p>
              <ul className="mt-1 space-y-1">
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
            </div>
          );
        })}
      </div>

      <InfoTip
        label="Self-reported by you."
        labelAs="p"
        className="mt-3"
        labelClassName="text-[13px] text-[color:var(--m-slate-2)]"
        align="start"
      >
        “Won” means the couple booked you — Setnayan settles off-platform, so it’s your signal, not a verified payment.
      </InfoTip>
    </section>
  );
}
