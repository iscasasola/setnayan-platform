import Link from 'next/link';
import { SeatReloadButton } from './seat-reload-button';

/**
 * The one line that leads to "Find your seat" — NOT a bar slot (owner
 * 2026-09-27, "FIND YOUR SEAT, REDESIGNED" (4)): the Details scene carries it
 * and the Me panel repeats it, so the five slots stay five.
 *
 *   · a guest we know, seated  → "Your seat · Table 3 →"
 *   · a guest whose seat read FAILED → "Couldn't load your seat — Reload"
 *   · anyone else              → "Find your seat →"
 *
 * The caller decides WHETHER it shows (the event seats people and the plan is
 * published — the destination's own questions); this only says it, the same
 * way everywhere it appears.
 *
 * 🔌 A failed read is never drawn as "Find your seat" — that is what a guest
 * with no table sees, and it would send a seated guest off to look themselves
 * up (the honest-read rule, lib/guests.ts). Guarded by
 * `app/[slug]/an-unread-seat-is-not-an-empty-one.test.ts`.
 */
export function SeatDoorLine({
  slug,
  tableLabel,
  unreadable = false,
  className = '',
}: {
  slug: string;
  /** The guest's own table, when the page knows it; null for everyone else. */
  tableLabel: string | null;
  /** The guest's seat read failed (`guestHubData.seatUnreadable`). */
  unreadable?: boolean;
  className?: string;
}) {
  if (unreadable && !tableLabel?.trim()) {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-center text-sm text-ink/70 ${className}`} data-seat-door="unreadable" role="status">
        <span>Couldn&rsquo;t load your seat &mdash;</span>
        <SeatReloadButton />
      </p>
    );
  }
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
