import { Megaphone } from 'lucide-react';
import { Explain } from '@/app/_components/explain';
import type { SupplierUpdateLine } from '@/lib/day-requests';

/** A line as the card draws it — the update plus its clock time, already formatted on the event's own clock. */
export type SupplierUpdateCardLine = SupplierUpdateLine & { time: string };

/**
 * 📣 FROM YOUR SUPPLIERS (owner-approved cut 6, 2026-11-14 — prototype `supplier_eleven_jobs_cuts_2026-11-14_fable.html`
 * § 6). What the couple's booked suppliers posted with "Post an update" — On site · Setup done · Ready to start ·
 * Packed up · Running late · Need help, and their notes — newest first, on the couple's day. The same stream their
 * coordinator's inbox reads; "Need help" and "Running late" are work for the coordinator there.
 *
 * `lines === null` means the read was REFUSED — the card says it could not load, never "No updates yet" (a refused
 * read is not an empty one).
 */
export function SupplierUpdatesCard({ lines }: { lines: SupplierUpdateCardLine[] | null }) {
  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm" data-supplier-updates={lines === null ? 'unread' : lines.length}>
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Megaphone aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          From your suppliers
        </p>
        <Explain title="From your suppliers">
          Your booked suppliers post here when they arrive, finish setting up, are ready, or pack up. Running late and
          Need help also go to your coordinator, who sees them as something to act on.
        </Explain>
      </header>
      {lines === null ? (
        <p className="text-sm text-ink/60" role="status">
          Couldn’t load your suppliers’ updates. Refresh the page to try again.
        </p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-ink/55">No updates yet. When a supplier posts one, it shows here.</p>
      ) : (
        <ul className="divide-y divide-ink/10" data-supplier-updates-list="">
          {lines.map((l) => (
            <li key={l.id} className="py-2">
              <p className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink">{l.supplier}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink/50">{l.time}</span>
              </p>
              <p className={`text-sm font-semibold ${l.urgent ? 'text-warn-600' : 'text-ink/75'}`}>{l.status}</p>
              {l.note ? <p className="text-[13px] leading-snug text-ink/65">{l.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
