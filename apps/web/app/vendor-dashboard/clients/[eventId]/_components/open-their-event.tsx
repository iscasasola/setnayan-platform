import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

/**
 * 🗂 **Open their event** — beside Chat on the customer card, ONLY when this supplier runs the couple's event as
 * their coordinator, live (owner "approved", 2026-10-28; prototype `coordinator_door_2026-10-28` frame C). The page
 * decides (`readEventsYouRun` → `seatRunsTheEvent`); this only draws. The door is the couple's own event dashboard,
 * `/dashboard/<eventId>`, which admits a coordinator through its shipped check — no new permission, no new address.
 * The accent fill marks it as the card's main door; 44 px tall like every button here.
 */
export function OpenTheirEvent({ eventId }: { eventId: string }) {
  return (
    <Link
      href={`/dashboard/${eventId}`}
      data-open-their-event={eventId}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-sn-accent px-3 text-xs font-semibold text-sn-on-accent"
    >
      <ClipboardList aria-hidden className="h-3.5 w-3.5" /> Open their event
    </Link>
  );
}
