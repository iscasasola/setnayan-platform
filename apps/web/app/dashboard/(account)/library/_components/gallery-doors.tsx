import Link from 'next/link';
import { ChevronRight, Images } from 'lucide-react';

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
 * Phone first: each row is one tap target, `min-h-12` (48px, above the 44px
 * floor).
 */
export type GalleryDoorEvent = {
  event_id: string;
  display_name: string;
  role: 'couple' | 'guest';
};

export function galleryDoorHref(eventId: string): string {
  return `/dashboard/${eventId}/galleries`;
}

export function GalleryDoors({ events }: { events: GalleryDoorEvent[] }) {
  const hosted = events.filter((e) => e.role === 'couple');
  if (hosted.length === 0) return null;

  return (
    <section aria-labelledby="gallery-doors-heading" className="mb-8">
      <h2 id="gallery-doors-heading" className="mb-2 text-sm font-semibold text-ink">
        Gallery
      </h2>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {hosted.map((e) => (
          <li key={e.event_id}>
            <Link
              href={galleryDoorHref(e.event_id)}
              data-gallery-door={e.event_id}
              className="sn-press flex min-h-12 items-center gap-3 px-4 py-2"
            >
              <Images aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {e.display_name}
              </span>
              <span className="shrink-0 text-xs text-ink/55">Gallery</span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
