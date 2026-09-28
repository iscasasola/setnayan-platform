import Link from 'next/link';

/**
 * The one line that leads to "Find your seat" — NOT a bar slot (owner
 * 2026-09-27, "FIND YOUR SEAT, REDESIGNED" (4)): the Details scene carries it
 * and the Me panel repeats it, so the five slots stay five.
 *
 *   · a guest we know, seated  → "Your seat · Table 3 →"
 *   · anyone else              → "Find your seat →"
 *
 * The caller decides WHETHER it shows (the event seats people and the plan is
 * published — the destination's own questions); this only says it, the same
 * way everywhere it appears.
 */
export function SeatDoorLine({
  slug,
  tableLabel,
  className = '',
}: {
  slug: string;
  /** The guest's own table, when the page knows it; null for everyone else. */
  tableLabel: string | null;
  className?: string;
}) {
  const label = tableLabel?.trim() ? `Your seat · ${tableLabel.trim()}` : 'Find your seat';
  return (
    <p className={`text-center ${className}`} data-seat-door>
      <Link
        href={`/${slug}/find-seat`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink/80 underline decoration-ink/30 underline-offset-4 hover:text-ink"
      >
        {label}
        <span aria-hidden>→</span>
      </Link>
    </p>
  );
}
