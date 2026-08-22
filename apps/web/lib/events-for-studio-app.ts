/**
 * events-for-studio-app.ts — which of your celebrations may a Studio service be
 * added to.
 *
 * Owner ruling, 2026-08-21: *"they get to pick which event (but only show events
 * that is compatible to this) and the event should be on the ongoing and
 * upcoming only."*
 *
 * PURE. No session, no I/O, no `server-only`. The caller resolves the rows and
 * the event-type profiles; this decides only which of them may be offered, and
 * WHY each of the others may not.
 *
 * ─── THE THREE GATES, IN ORDER ────────────────────────────────────────────
 *  1. YOURS TO CHANGE   `eventStance(member_type) === 'organiser'`. Being invited
 *                       to a wedding is not permission to bolt a paid service
 *                       onto it. Anything that is neither `couple` nor `guest`
 *                       returns null from `eventStance` and is refused — a
 *                       coordinator's access comes from an accepted
 *                       `event_moderators` row, not from `member_type`, so this
 *                       fails CLOSED rather than guessing a door works.
 *  2. NOT FINISHED      `isFinishedEvent` from `lib/event-board`, the SAME
 *                       predicate the events board splits its two shelves on.
 *                       Reused, never re-derived: "when did this end" must have
 *                       one answer in the product, not two. It already handles
 *                       the parts that are easy to get wrong — a celebration is
 *                       not finished ON its own day, a multi-day one runs to
 *                       `event_end_date`, an archived one is finished whatever
 *                       its date says, and the boundary is a MANILA CALENDAR DAY
 *                       rather than an instant.
 *  3. COMPATIBLE        `surfaceEnabled(profile, app.surface)` — the same
 *                       predicate the rail already drops rows with, and the same
 *                       one the couple's own Studio hub filters on. A service
 *                       with no `surface` is universal and skips this gate.
 *
 * 🔑 A DATELESS EVENT IS OFFERED, ON PURPOSE. `isFinishedEvent` returns false
 * when there is no date, and that is right here: you should be able to add Papic
 * to the birthday you have not picked a day for yet. Do not "fix" this by
 * requiring a date.
 *
 * 🔑 THIS GATE FAILS CLOSED WHERE THE RAIL FAILS OPEN, AND THE DIFFERENCE IS
 * DELIBERATE. `railToolsSignedIn()` keeps a row when the profile is unknown
 * (`if (!eventId || !profile) return true`) because showing a row costs nothing.
 * A PICKER is the opposite: offering an event we cannot confirm hands somebody a
 * destination that may `redirect()` away with no message — exactly the harm the
 * rail's own comment describes for a birthday organiser pressing "Logo Maker".
 * So an unreadable profile is `unknown-type` and is NOT offered.
 *
 * 🔑 AND THAT IS WHY THIS RETURNS REASONS, NOT JUST A LIST. If every profile
 * failed to load, a bare array would come back empty and read as "you have no
 * events" — the silently-empty-drawer failure this codebase has shipped before
 * (`count === null` means NOT MEASURED, never zero). The caller can tell
 * "nothing qualifies" from "nothing could be checked" and say something true.
 */
import { eventStance, isFinishedEvent } from './event-board';
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';

// from './events', which is where it is declared — `event-board` only imports it
import type { EventWithRole } from './events';
import type { StudioApp } from './studio-apps';

/** Why an event is not on the list. `ok` never appears in `rejected`. */
export type RejectReason =
  | 'not-organiser'
  | 'finished'
  | 'incompatible'
  | 'unknown-type';

export type PickableEvent = {
  eventId: string;
  /** whatever the caller shows on the row — this module never formats it */
  title: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  archived?: boolean;
  memberType: EventWithRole['member_type'];
  /** null when the event's type could not be resolved — NOT a reason to guess */
  profile: EventTypeProfile | null;
};

export type PickResult = {
  /** offer exactly these, in the order they arrived */
  pickable: PickableEvent[];
  rejected: ReadonlyArray<{ eventId: string; reason: RejectReason }>;
  /**
   * How many events we could not check at all. Non-zero means an empty
   * `pickable` must NOT be reported to a person as "you have no events".
   */
  unchecked: number;
};

/** The subset of a Studio app this decision actually depends on. */
export type ServiceGate = Pick<StudioApp, 'surface'>;

/**
 * Both predicates are IMPORTED rather than injected, deliberately. `studio-rail`
 * already imports `surfaceEnabled` from the same place, and a picker that let a
 * caller supply its own idea of "finished" or "yours" is a picker with two
 * answers to a question that must have one.
 */
export function eventsForStudioApp(
  app: ServiceGate,
  events: readonly PickableEvent[],
  todayISO: string,
): PickResult {
  const pickable: PickableEvent[] = [];
  const rejected: Array<{ eventId: string; reason: RejectReason }> = [];
  let unchecked = 0;

  for (const e of events) {
    // 1 · yours to change
    if (eventStance(e.memberType) !== 'organiser') {
      rejected.push({ eventId: e.eventId, reason: 'not-organiser' });
      continue;
    }

    // 2 · ongoing and upcoming only — the board's own line, not a second one
    if (
      isFinishedEvent(
        {
          event_date: e.eventDate,
          event_end_date: e.eventEndDate ?? null,
          archived: e.archived ?? false,
        },
        todayISO,
      )
    ) {
      rejected.push({ eventId: e.eventId, reason: 'finished' });
      continue;
    }

    // 3 · compatible with this service
    if (app.surface) {
      if (!e.profile) {
        unchecked += 1;
        rejected.push({ eventId: e.eventId, reason: 'unknown-type' });
        continue;
      }
      if (!surfaceEnabled(e.profile, app.surface)) {
        rejected.push({ eventId: e.eventId, reason: 'incompatible' });
        continue;
      }
    }

    pickable.push(e);
  }

  return { pickable, rejected, unchecked };
}

/**
 * What to tell somebody when the list is empty — and never the same sentence
 * for two different situations. Returns null when there IS something to pick.
 */
export function emptyPickerReason(result: PickResult): string | null {
  if (result.pickable.length > 0) return null;
  if (result.unchecked > 0) {
    return 'We couldn’t check your celebrations just now. Try again in a moment.';
  }
  if (result.rejected.length === 0) {
    return 'You don’t have a celebration yet. Start one and this can go straight into it.';
  }
  if (result.rejected.every((r) => r.reason === 'finished')) {
    return 'All your celebrations have already happened. This can only be added to one that’s still coming up.';
  }
  if (result.rejected.some((r) => r.reason === 'incompatible')) {
    return 'None of your celebrations can use this one yet.';
  }
  return 'You organise no celebration this can be added to.';
}
