import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * GalleryDoors — one row per event the signed-in person HOSTS, each a door
 * into that event's Gallery (`/dashboard/[eventId]/galleries`).
 *
 * Owner 2026-10-02 (DECISION_LOG "MEMORIES LISTS EVERY EVENT WITH ITS
 * GALLERY"): Memories shows each of the person's events with a way into that
 * event's Gallery, Papic or not. Before this, an event with no Papic had no
 * normal door to its gallery — the shelf's cover opens the Papic studio.
 *
 * ── NO PAPIC CONDITION, DELIBERATELY ───────────────────────────────────────
 * This takes events, not Papic state. The Gallery hub is where an event's
 * photos are gathered whether or not Papic is on; gating the door on Papic is
 * exactly the defect this fixes.
 *
 * ── HOSTS ONLY ─────────────────────────────────────────────────────────────
 * `role === 'couple'` is the host / co-host membership (the Gallery hub admits
 * `couple` and `coordinator`; a helper is not given a Memories door). An
 * attended event has no Gallery of its own to open here.
 *
 * ── NOTHING IS COPIED ──────────────────────────────────────────────────────
 * A link, not a grid. The gallery stays in one place.
 *
 * Phone first: the door is one tap target, `min-h-11` (44px).
 */
export type GalleryDoorEvent = {
  event_id: string;
  display_name: string;
  role: 'couple' | 'guest';
};

export function galleryDoorHref(eventId: string): string {
  return `/dashboard/${eventId}/galleries`;
}

/**
 * 2026-10-22 (Memories wears the Papic gallery): the door rides each event's chapter heading — "Gallery ›" at its
 * right end — instead of a list of rows under the shelf. Same rule, same address: hosts only, no Papic condition.
 */
export function GalleryDoor({ event }: { event: GalleryDoorEvent }) {
  if (event.role !== 'couple') return null;
  return (
    <Link
      href={galleryDoorHref(event.event_id)}
      data-gallery-door={event.event_id}
      aria-label={`${event.display_name} — Gallery`}
      className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[13px] text-ink/60"
    >
      Gallery
      <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
    </Link>
  );
}
