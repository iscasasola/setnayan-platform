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
 *   Share the link    before the event            (was "Invite guests")
 *   Check-in          after the event
 *   Share ▾           after the event, with a join link
 *   (QR codes (PDF) moved to Details › For the day, the Wedding March to
 *   Details › Your event, and Arrange the room to Details › Your event › Seat
 *   plan — all 2026-09-29, DECISION_LOG "THE GUEST LIST KEEPS PEOPLE…".)
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
 * (2026-10-04: the row is ONE `.sn-seg` segmented control, and the List · Mind
 * map switch stands in the Roster tab's place — see the render below.)
 *
 * Server component: no state of its own. The dropdown that needs one arrives
 * through `trailing`; the QR PDF door (below) mounts `SaveFileLink`, a client
 * component, for the same reason — a Server Component may render a Client
 * Component directly, so this stays a plain server component either way.
 */

import Link from 'next/link';
import { ClipboardCheck, Send } from 'lucide-react';
import { rosterDoors } from '@/lib/roster-doors';
import { SEG_ITEM } from './view-switcher';

export type RosterView = 'list' | 'map' | 'share';

const ICON: Record<'share' | 'checkin', React.ReactNode> = {
  share: <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  checkin: <ClipboardCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

export function RosterTabs({
  eventId,
  view,
  finished,
  hasJoinLink,
  shareMenu,
  viewSwitch,
}: {
  eventId: string;
  view: RosterView;
  /** The event has happened. Invite / arrange stop making sense. */
  finished: boolean;
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
  const { tabs, trailing } = rosterDoors({ eventId, view, finished, hasJoinLink });

  /*
    ⚖ ONE SEGMENTED CONTROL (owner, live iPhone review 2026-10-04: the row
    mixed underline tabs — Roster · Share the link — with the List · Mind map
    pill, two looks for one job; "sections = ONE segmented control style").
    It is the shipped `.sn-seg` (globals.css), the one the List · Mind map
    switch already drew. List and Mind map ARE the roster, so when the switch
    is handed in it stands where the Roster tab stood — every door still
    reaches exactly where it did (`lib/roster-doors.ts` is unchanged).
  */
  return (
    <div className="flex items-center gap-2">
      {/* A <nav> of LINKS (review of #6352): every door goes to a URL, so it
          keeps the nav landmark and the current one says `aria-current="page"`
          — no tablist, which would promise arrow-key tabs and make "Share the
          link" a broken tab. `.sn-seg-item[aria-current='page']` lights it. */}
      <nav
        aria-label="Guest list"
        className="sn-seg min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] lg:flex-none [&::-webkit-scrollbar]:hidden"
        data-roster-seg=""
      >
        {tabs.map((d) =>
          d.kind === 'tab' ? (
            d.key === 'roster' && viewSwitch ? (
              <span key={d.key} className="contents">
                {viewSwitch}
              </span>
            ) : (
              <Tab
                key={d.key}
                href={d.href}
                current={d.current}
                icon={d.key === 'share' ? ICON.share : undefined}
              >
                {d.label}
              </Tab>
            )
          ) : d.kind === 'link' ? (
            <Tab key={d.key} href={d.href} icon={ICON[d.key]}>
              {d.label}
            </Tab>
          ) : null,
        )}
      </nav>

      {trailing.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {trailing.map((d) =>
            d.kind === 'link' ? (
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
      ) : null}
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
  current?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={SEG_ITEM}
    >
      {icon}
      {children}
    </Link>
  );
}
