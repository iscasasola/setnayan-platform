import Link from 'next/link';
import { Pin, ArrowRight } from 'lucide-react';
import { TABLE_TYPE_LABEL, type EventTableRow } from '@/lib/seating';
import { formatCount } from '@/lib/format-number';

type Props = {
  eventId: string;
  headTable: EventTableRow | null;
  nearbyTables: EventTableRow[];
  /** The table read was refused (`measuredOr` on the page) — NOT the same as "no tables". */
  tablesFailed?: boolean;
};

/**
 * 🪑 Does this event have a seat plan at all? True when it has ANY table — a head table or any
 * other. A debut, a hangout or a wedding nobody seated has none, and on the day their Home must
 * not lead with "Head table · No head table set up yet" (audit 2026-10-23, owner "yes").
 *
 * The signal is the tables themselves (`fetchTables` on the page) — no new flag: a seat plan IS
 * its tables.
 *
 * ⚠ A FAILED READ IS NOT "NO SEAT PLAN". The page reads the tables through `measuredOr` and
 * passes `tablesFailed`; then the card stays and says "Couldn't load your tables" — hiding it
 * would render a refused read byte-identical to a debut that never had tables.
 */
export function eventHasSeatPlan(headTable: EventTableRow | null, nearbyTables: readonly EventTableRow[]): boolean {
  return headTable !== null || nearbyTables.length > 0;
}

// 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 6 · 13 · 14): no box — the section's grey capitals over plain lines; the
// nearby tables are one hairline row each; the way to the plan is the terracotta › on the label's row; an empty or
// refused read is one line where the rows would be; 12 px floor, full-strength ink.
const LABEL = 'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';

export function YourTableCard({ eventId, headTable, nearbyTables, tablesFailed = false }: Props) {
  if (!tablesFailed && !eventHasSeatPlan(headTable, nearbyTables)) return null;
  return (
    <section aria-labelledby="day-of-head-table" className="space-y-1">
      <header className="flex min-h-11 items-center justify-between gap-2">
        <h2 id="day-of-head-table" className={LABEL}>
          <Pin aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
          Head table
        </h2>
        <Link
          href={`/dashboard/${eventId}/seating`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-terracotta-700 hover:underline"
        >
          Plan <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </header>

      {tablesFailed ? (
        <p role="status" className="py-2 text-sm text-warn-800">
          Couldn’t load your tables — not the same as none.{' '}
          <Link href={`/dashboard/${eventId}/seating`} className="font-semibold text-terracotta-700 underline-offset-2 hover:underline">
            Open seating
          </Link>
        </p>
      ) : headTable ? (
        <>
          <h3 className="text-2xl font-bold tracking-tight text-ink">{headTable.table_label}</h3>
          <p className="text-sm text-ink/75">
            {TABLE_TYPE_LABEL[headTable.table_type] ?? headTable.table_type} ·{' '}
            {formatCount(headTable.capacity)} seats
          </p>
          {nearbyTables.length > 0 ? (
            <div className="pt-2">
              <p className={LABEL}>Nearby tables</p>
              <ul className="divide-y divide-ink/10">
                {nearbyTables.map((t) => (
                  <li key={t.table_id} className="flex min-h-11 items-center py-2 text-[15px] text-ink">
                    {t.table_label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="py-2 text-sm text-ink/75">
          No head table set up yet.{' '}
          <Link href={`/dashboard/${eventId}/seating`} className="font-semibold text-terracotta-700 underline-offset-2 hover:underline">
            Open seating
          </Link>
        </p>
      )}
    </section>
  );
}
