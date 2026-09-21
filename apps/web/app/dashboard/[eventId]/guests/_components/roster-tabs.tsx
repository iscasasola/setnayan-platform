/**
 * roster-tabs.tsx — the guest list's one row of doors.
 *
 * ⚖ Owner 2026-09-20, on the prototype: *"these row can be 1 row and check
 * which needs to be there and removed"* · *"keep this in 1 row"* · *"carousel
 * if not enough space"* · and of "Arrange the room": *"just make this an icon
 * on mobile same row as roster wedding march and share the link"*.
 *
 * ── EVERY DOOR KEEPS THE CONDITION IT HAD ─────────────────────────────────
 * These were masthead buttons, each gated for a reason recorded beside it. The
 * move changes WHERE they sit, never WHEN they show:
 *
 *   Roster            always
 *   Wedding March     before the event, and only with a processional
 *   Share the link    before the event            (was "Invite guests")
 *   Arrange the room  before the event
 *   Check-in          after the event
 *   Share ▾           after the event, with a join link
 *
 * 🔑 THE ONE THING REMOVED IS A DUPLICATE. Before the event the masthead held
 * BOTH "Invite guests" and a Share dropdown, and both handed out the same join
 * link — the invite page adds its QR code and a download. One tab now. After
 * the event the invite page is "the one door that stops making sense" (its
 * own note, and inviting people to a celebration that already happened is
 * wrong), so the quick Share dropdown stays there, exactly as it did.
 *
 * ⚠ Roster and Wedding March are VIEWS of this page (`?gview=`), so they are
 * real tabs with a current state. Share the link is a different page, so it is
 * a link styled to sit in the row — it never claims to be the current tab.
 *
 * Server component: plain links, no client state. The dropdown that needs a
 * client arrives through `trailing`, so this file imports nothing client-side.
 */

import Link from 'next/link';
import { ClipboardCheck, LayoutGrid, Send } from 'lucide-react';

export type RosterView = 'list' | 'map' | 'walk';

export function RosterTabs({
  eventId,
  view,
  finished,
  hasProcessional,
  trailing,
}: {
  eventId: string;
  view: RosterView;
  /** The event has happened. Invite / arrange / walk stop making sense. */
  finished: boolean;
  /** The event has a processional — a Wedding March is only offered then. */
  hasProcessional: boolean;
  /** The after-the-event Share dropdown, rendered by the page. */
  trailing?: React.ReactNode;
}) {
  const base = `/dashboard/${eventId}/guests`;
  // `map` is a way of LOOKING at the roster, not a different task, so it lights
  // the Roster tab rather than leaving the row with nothing selected.
  const onRoster = view !== 'walk';

  return (
    <div className="flex items-center gap-2 border-b border-ink/[0.07]">
      {/* The carousel. One row at every width; when the doors do not fit, the
          row scrolls sideways instead of wrapping into a second line. */}
      <nav
        aria-label="Guest list"
        // 🪤 A CAROUSEL THAT CUTS A WORD IN HALF READS AS A BUG. Measured at
        // 380px, the three wedding tabs needed 297px and had 282, so "Share the
        // link" was chopped mid-word at the edge — the same complaint as the
        // header's "CONTA", and a scrollable row gives no other hint that it
        // scrolls. Two answers: tighter tabs on phones (below) so they FIT at
        // 380, and an 8px fade on the edge for narrower phones, which fades
        // empty space when everything fits and reads as "more" when it does not.
        className="-mb-px flex min-w-0 flex-1 snap-x snap-proximity items-stretch overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%_-_8px),transparent)] [scrollbar-width:none] sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        <Tab href={base} current={onRoster}>
          Roster
        </Tab>
        {finished || !hasProcessional ? null : (
          <Tab href={`${base}?gview=walk`} current={view === 'walk'}>
            Wedding March
          </Tab>
        )}
        {finished ? null : (
          <Tab href={`${base}/invite`} icon={<Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            Share the link
          </Tab>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 pb-1">
        {finished ? (
          <Link
            href={`${base}/checkin`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <ClipboardCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Check-in</span>
            <span className="sr-only sm:hidden">Check-in</span>
          </Link>
        ) : (
          // The one door that LEAVES for another editor. Owner: an icon on a
          // phone, so it stays in this row instead of wrapping onto its own.
          <Link
            href={`/dashboard/${eventId}/seating`}
            title="Arrange the room"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Arrange the room</span>
            <span className="sr-only sm:hidden">Arrange the room</span>
          </Link>
        )}
        {trailing}
      </div>
    </div>
  );
}

function Tab({
  href,
  current,
  icon,
  children,
}: {
  href: string;
  /** Omitted for a door to ANOTHER page — it is never the current tab. */
  current?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      // px-2 on a phone is what lets three tabs FIT at 380px (273 of 282px);
      // px-3 from `sm` up, where there is room.
      className={`inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-sm transition-colors sm:px-3 ${
        current
          ? 'border-terracotta-700 font-medium text-ink'
          : 'border-transparent text-ink/60 hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
