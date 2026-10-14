/**
 * <PriceSummary> — KIND 26 of the approved control templates (round 2,
 * 2026-10-12; one source: `PriceSummary`). How one booking is paid, one row per
 * instalment with its badge, then the total as the one bold line:
 *
 *   Downpayment                         ₱31,350   [Paid ✓]
 *   Second payment · Nov 12             ₱31,350   [Waiting for their check]
 *   Balance · Dec 5                     ₱62,700   [Due Dec 5]
 *   ─────────────────────────────────────────────
 *   Total                              ₱125,400
 *
 * Read-only hairline rows, NO box (a frame only on what you press — owner
 * 2026-10-11); badges are soft fills with no border (look call 7, 2026-10-12);
 * every state has words, never colour alone. Server-safe: no hooks — the couple's
 * Pay sheet (a client island) and the supplier's customer card (a server page)
 * both mount it, over `priceSummaryOf` (`lib/price-summary.ts`), so the two ends
 * of one booking draw the same rows.
 */
import { Count } from '@/components/count';
import { formatPhp } from '@/lib/php';
import { priceDueText, type PriceBadgeTone, type PriceSummary as PriceSummaryData } from '@/lib/price-summary';

const BADGE: Record<PriceBadgeTone, string> = {
  ok: 'bg-[rgb(var(--color-ok)_/_0.12)] text-[rgb(var(--color-ok))]',
  warn: 'bg-[rgb(var(--color-warn)_/_0.12)] text-[rgb(var(--color-warn))]',
  soft: 'bg-ink/5 text-ink/70',
  late: 'bg-[rgb(var(--color-danger)_/_0.12)] text-[rgb(var(--color-danger))]',
};

function Peso({ value, id }: { value: number; id?: string }) {
  return Number.isInteger(value) && id ? (
    <Count value={value} format="peso" id={id} />
  ) : (
    <span>{formatPhp(value)}</span>
  );
}

export function PriceSummary({
  summary,
  idPrefix,
  className,
}: {
  summary: PriceSummaryData;
  /** A stable id for the total's count — unique per booking on the page. */
  idPrefix: string;
  className?: string;
}) {
  if (summary.rows.length === 0) return null;
  return (
    <div className={className} data-price-summary="" data-price-cleared={summary.cleared ? '' : undefined}>
      {summary.cleared ? (
        <p className="pb-1 text-[13px] font-medium text-[rgb(var(--color-ok))]" role="status">
          Cleared — every payment is settled.
        </p>
      ) : null}
      <ol role="list">
        {summary.rows.map((r) => (
          <li
            key={r.seq}
            data-price-row={r.state}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-ink/10 py-2.5 first:border-t-0"
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-ink">{r.label}</span>
              {r.dueDate && r.state !== 'due' ? (
                <span className="block text-[12.5px] text-ink/55">Due {priceDueText(r.dueDate)}</span>
              ) : null}
            </span>
            <span className="grid justify-items-end gap-1">
              <span className="whitespace-nowrap text-[14px] font-medium tabular-nums text-ink">
                {r.amountPhp !== null ? <Peso value={r.amountPhp} /> : <span className="font-normal text-ink/60">{r.amountWords}</span>}
              </span>
              <span
                data-price-badge={r.badge.tone}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-none ${BADGE[r.badge.tone]}`}
              >
                {r.badge.text}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p
        className="mt-1 flex items-baseline justify-between gap-3 border-t border-ink/15 pt-2.5 text-[15px]"
        data-price-total={summary.totalPhp === null ? 'unresolved' : 'whole'}
      >
        <b className="font-semibold text-ink">Total</b>
        {summary.totalPhp !== null ? (
          <b className="font-semibold tabular-nums text-ink">
            <Peso value={summary.totalPhp} id={`${idPrefix}-total`} />
          </b>
        ) : (
          // A share of a total nobody has set is not a smaller total.
          <span className="text-[13px] text-ink/60">not every amount is set yet</span>
        )}
      </p>
    </div>
  );
}
