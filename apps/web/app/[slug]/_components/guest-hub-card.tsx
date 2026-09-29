/**
 * guest-hub-card.tsx — WHAT IS LEFT OF THE GUEST HUB CARD: its data shape.
 *
 * ⛔ THE CARD ITSELF IS GONE (owner 2026-09-30). "Hi again, <name> · Your
 * invitation summary" (RSVP · Your seat · Meal · Coming up · Quick links ·
 * Signed in as) restated what the page's top control ("You're going ·
 * Change"), the Digital ticket on Me and the Your details sheet each already
 * say. Do not bring it back as a new component either — a status card on the
 * guest's Home is the duplicate the owner removed.
 *
 * What stays, because other surfaces read it: `GuestHubData` (the memento,
 * the seat line, Me) and `pickNextScheduleBlock`. The file keeps its name so
 * those imports do not move.
 */

import type { ScheduleBlockRow } from '@/lib/schedule';
import { pickTriggerNowNext } from '@/lib/run-of-show';
import { venueNowMs } from '@/lib/schedule';

/** What the card's schedule tile renders. `happeningNow` = the pick is the
 *  host-set LIVE block (run-of-show trigger), so the tile labels it
 *  "Happening now" instead of "Coming up". Absent/false = preview semantics. */
export type NextScheduleBlockPick = Pick<
  ScheduleBlockRow,
  'label' | 'start_at' | 'location'
> & { happeningNow?: boolean };

// ---- Types from the parent page ------------------------------------------

type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export type GuestHubData = {
  /** Guest's first name for the headline greeting. */
  firstName: string;
  /** Resolved display name (display_name ?? first + last). */
  displayName: string;
  rsvpStatus: RsvpStatus;
  /** Table label (e.g. "Table 5") when the guest has a seat assignment. */
  tableLabel: string | null;
  mealPreference: string | null;
  dietaryRestrictions: string | null;
  /** Next upcoming public schedule block (may be null when none are set). */
  nextScheduleBlock: NextScheduleBlockPick | null;
  /** /[slug] paths for the nav links. */
  slug: string;
  /** Whether the guest is a limited +1 (hides certain links). */
  isLimitedPlusOne: boolean;
  /** True once this guest has scanned in at the door on the day-of (a
   *  guest_checkins row exists). Flips the seat tile to a warm arrival state. */
  arrived: boolean;
  /**
   * True only on this guest's VERY FIRST arrival — their earliest recorded scan
   * is inside the arrival window.
   *
   * ⚠ NO READER SINCE 2026-09-30: its one reader was the hub card's "Hello" vs
   * "Hi again" greeting, and the card is gone. The loader still computes it
   * (`guestFirstVisit`, loaders.ts). The scan-trail notice still tells a guest
   * the record "is how this page knows to welcome you when you first arrive" —
   * that sentence now names a greeting nothing renders. Owner call, flagged on
   * the PR that removed the card: reword the notice, or give the signal a reader.
   *
   * Optional and defaulting to false so every existing construction site stays
   * byte-unchanged, and so an unknown answer falls back to today's copy rather
   * than greeting a returning guest as a stranger.
   */
  firstVisit?: boolean;
};

/**
 * Pick the nearest upcoming block from the already-fetched public schedule.
 * "Upcoming" = start_at is in the future (or within the last 15 min to cover
 * the "happening now" window). Returns top-level blocks only (no children).
 *
 * With `preferRunState` (NEXT_PUBLIC_GUEST_NOW_TRIGGER, owner directive
 * 2026-07-23): once the host/coordinator has started the run of show, the
 * card follows the run_state pointer — the 'live' block first, else the first
 * still-'upcoming' block (a private live block simply isn't in the public
 * list, so this degrades to the next visible moment — no teaser). While the
 * show hasn't started, the wall-clock inference below runs unchanged.
 */
export function pickNextScheduleBlock(
  blocks: ScheduleBlockRow[],
  opts?: { preferRunState?: boolean },
): NextScheduleBlockPick | null {
  const topLevel = blocks.filter((b) => !b.parent_block_id && b.is_public);
  if (opts?.preferRunState) {
    const picked = pickTriggerNowNext(topLevel);
    if (picked) {
      const chosen = picked.current ?? picked.next;
      if (!chosen) return null; // program wrapped — nothing to come up
      const { label, start_at, location } = chosen;
      // happeningNow flips the card's label from "Coming up" to "Happening
      // now" — the host-set live block is the current moment, not a preview.
      return { label, start_at, location, happeningNow: chosen === picked.current };
    }
  }
  // The VENUE's clock, minus a 15-minute grace. `start_at` holds the venue's
  // wall clock, so measuring it against the guest's own clock put this card a
  // whole UTC offset out — eight hours in Manila, which on the day means a
  // guest standing at the reception is told the ceremony is "coming up".
  const now = venueNowMs() - 15 * 60 * 1000;
  const upcoming = topLevel
    .filter((b) => new Date(b.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  if (!upcoming.length) return null;
  const { label, start_at, location } = upcoming[0]!;
  return { label, start_at, location };
}
