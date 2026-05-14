import Link from 'next/link';
import { Pin, ArrowRight } from 'lucide-react';
import { TABLE_TYPE_LABEL, type EventTableRow } from '@/lib/seating';

type Props = {
  eventId: string;
  headTable: EventTableRow | null;
  nearbyTables: EventTableRow[];
};

export function YourTableCard({ eventId, headTable, nearbyTables }: Props) {
  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
          <Pin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Head table
        </p>
        <Link
          href={`/dashboard/${eventId}/seating`}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 hover:text-terracotta"
        >
          Plan <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        </Link>
      </header>

      {headTable ? (
        <>
          <h3 className="text-2xl font-semibold tracking-tight text-ink">
            {headTable.table_label}
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {TABLE_TYPE_LABEL[headTable.table_type] ?? headTable.table_type} ·{' '}
            {headTable.capacity} seats
          </p>
          {nearbyTables.length > 0 ? (
            <div className="space-y-1 border-t border-ink/10 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Nearby tables
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {nearbyTables.map((t) => (
                  <li
                    key={t.table_id}
                    className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/70"
                  >
                    {t.table_label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm text-ink/65">
            No head table set up yet.
          </p>
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
          >
            Open seating
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </>
      )}
    </article>
  );
}
