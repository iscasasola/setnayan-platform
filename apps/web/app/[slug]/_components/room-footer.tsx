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
export function RoomFooter({
  links,
  tone = 'paper',
}: {
  links: readonly RoomLink[];
  /**
   * Which surface this strip is sitting on.
   *
   * 🔑 THE 3D ROOM IS NOT AN EXCEPTION, IT IS A SECOND SURFACE. `/venue` renders
   * on `#0b0d12` — near-black, so the 3D scene reads. I first skipped it,
   * calling the styling "a design decision I cannot make blind"; the owner
   * pushed back, and he was right. **The page had already answered the
   * question**: its own chrome uses `bg-white/10` chips and `text-white/60`
   * links. There was nothing to invent, only something to match.
   *
   * ⚠ The lesson is narrower than "just do it": deferring was reasonable, but I
   * deferred WITHOUT LOOKING at what the page already did. Reading it took
   * thirty seconds and removed the whole objection.
   */
  tone?: 'paper' | 'dark';
}) {
  if (links.length === 0) return null;

  const dark = tone === 'dark';

  return (
    <nav
      aria-label="Other parts of this event"
      className={`mx-auto mt-12 w-full max-w-3xl border-t px-4 pt-6 sm:px-6 ${
        dark ? 'border-white/10' : 'border-ink/10'
      }`}
    >
      <p
        className={`text-center font-mono text-[0.62rem] uppercase tracking-[0.18em] ${
          dark ? 'text-white/45' : 'text-ink/45'
        }`}
      >
        In this event
      </p>
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
        {links.map((l) => (
          <li key={l.key}>
            <Link
              href={l.href}
              className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                dark
                  ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  : 'border border-ink/12 bg-cream text-ink/70 hover:border-ink/25 hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
