import Link from 'next/link';

import type { RoomLink } from '../_lib/room-links';

/**
 * "IN THIS EVENT" — the way out of a room that is not just "back".
 *
 * Every sub-room of the Event Hub used to end in a single Back link, or in
 * nothing at all. This is the rim of the wheel: the other rooms THIS event
 * actually has, listed where a guest has just finished reading.
 *
 * ── WHY IT IS A LIST AND NOT A BAR ──────────────────────────────────────────
 * The bottom bar is owner-locked at five slots and its middle three are in-page
 * anchors that only mean anything on the event page. This is a different job —
 * leaving a room — so it is a different shape, and it deliberately does not
 * look like the bar. A guest should never be unsure which of two identical
 * strips they are tapping.
 *
 * ── IT DRAWS NOTHING WHEN THERE IS NOTHING TO DRAW ──────────────────────────
 * `resolveRoomLinks` returns only the rooms that would actually let this
 * visitor in, and never returns the room they are standing in. If that leaves
 * just the event page — which is the ordinary case for an event with no
 * seating, no gifts and no album yet — the strip still renders, because "the
 * invitation" is a genuine destination and the room would otherwise be a dead
 * end. If it leaves NOTHING (no slug), nothing renders.
 *
 * Presentational and props-only: zero reads, no decisions. Which rooms exist is
 * settled in `room-links.ts` beside the rules it inherits.
 */
export function RoomFooter({ links }: { links: readonly RoomLink[] }) {
  if (links.length === 0) return null;

  return (
    <nav
      aria-label="Other parts of this event"
      className="mx-auto mt-12 w-full max-w-3xl border-t border-ink/10 px-4 pt-6 sm:px-6"
    >
      <p className="text-center font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink/45">
        In this event
      </p>
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
        {links.map((l) => (
          <li key={l.key}>
            <Link
              href={l.href}
              className="inline-flex items-center rounded-full border border-ink/12 bg-cream px-3.5 py-1.5 text-sm text-ink/70 transition-colors hover:border-ink/25 hover:text-ink"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
