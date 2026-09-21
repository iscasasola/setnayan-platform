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
import { rosterDoors } from '@/lib/roster-doors';

export type RosterView = 'list' | 'map' | 'walk';

const ICON: Record<'share' | 'arrange' | 'checkin', React.ReactNode> = {
  share: <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />,
  arrange: <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  checkin: <ClipboardCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

export function RosterTabs({
  eventId,
  view,
  finished,
  hasProcessional,
  hasJoinLink,
  shareMenu,
  viewSwitch,
}: {
  eventId: string;
  view: RosterView;
  /** The event has happened. Invite / arrange / walk stop making sense. */
  finished: boolean;
  /** The event has a processional — a Wedding March is only offered then. */
  hasProcessional: boolean;
  /** A join link exists — the after-the-event Share menu needs one. */
  hasJoinLink: boolean;
  /** The Share dropdown, rendered by the page; shown only when the rules say. */
  shareMenu?: React.ReactNode;
  /** The List / Mind map switch — a way of LOOKING at the roster. */
  viewSwitch?: React.ReactNode;
}) {
  // 🔑 NOTHING IS DECIDED HERE. Which doors exist, and when, is
  // `lib/roster-doors.ts` — pure, and executed by its test — so a door cannot
  // quietly vanish from this row the way nothing noticed it could have when
  // the masthead's buttons moved in.
  const { tabs, trailing } = rosterDoors({ eventId, view, finished, hasProcessional, hasJoinLink });

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
        // scrolls. Two answers: tighter tabs on phones so they FIT at 380, and
        // an 8px fade on the edge for narrower phones, which fades empty space
        // when everything fits and reads as "more" when it does not.
        className="-mb-px flex min-w-0 flex-1 snap-x snap-proximity items-stretch overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%_-_8px),transparent)] [scrollbar-width:none] sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((d) =>
          d.kind === 'tab' ? (
            <Tab key={d.key} href={d.href} current={d.current}>
              {d.label}
            </Tab>
          ) : d.kind === 'link' ? (
            <Tab key={d.key} href={d.href} icon={ICON[d.key]}>
              {d.label}
            </Tab>
          ) : null,
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 pb-1">
        {viewSwitch}
        {trailing.map((d) =>
          d.kind === 'link' ? (
            // The one door that LEAVES for another editor (or, after the day,
            // the check-in desk). Owner: an icon on a phone, so it stays in
            // this row instead of wrapping onto its own.
            <Link
              key={d.key}
              href={d.href}
              title={d.label}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
            >
              {ICON[d.key]}
              <span className="hidden sm:inline">{d.label}</span>
              <span className="sr-only sm:hidden">{d.label}</span>
            </Link>
          ) : d.kind === 'shareMenu' ? (
            <span key={d.key}>{shareMenu}</span>
          ) : null,
        )}
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
