import { Layers } from 'lucide-react';

/**
 * "Across all services" — a muted note rendered next to the SHOP-LEVEL cards
 * (Health, Grow, Demand, and the funnel's views/inquiries/quotes) when a
 * specific service is selected. THE HONEST CONTRACT: a card that can't segment
 * by service must say so rather than imply its numbers are for the chosen
 * service. Only bookings-derived figures (via event_vendors.service_id) can
 * segment; everything else stays shop-wide and wears this note.
 *
 * Server component — no client JS. Render only when a service is selected.
 */
export function ScopeNote({
  text = 'Across all services',
}: {
  /** Override copy for surfaces that need a more specific caveat. */
  text?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
      style={{
        borderColor: 'var(--m-line)',
        background: 'var(--m-paper)',
        color: 'var(--m-slate-3)',
      }}
    >
      <Layers className="h-3 w-3" strokeWidth={1.75} aria-hidden />
      {text}
    </span>
  );
}
