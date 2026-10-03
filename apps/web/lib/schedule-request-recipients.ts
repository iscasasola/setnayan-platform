/**
 * schedule-request-recipients.ts — WHO HEARS THAT A SUPPLIER ASKED FOR A
 * SCHEDULE CHANGE.
 *
 * Owner, 2026-10-03 (DECISION_LOG "SUPPLIERS WRITE THEIR OWN PART OF THE
 * SCHEDULE"): a supplier's add / edit / delete is a request "the couple (or the
 * coordinator, The Day = Edit) is notified [of] and APPROVES or DECLINES".
 *
 * Before this, `suggestScheduleChange` told the couple's `event_members` rows
 * and nobody else — so a coordinator who could approve the request (the
 * suggestion UPDATE policy admits `moderator_area_level(…,'schedule') = 'edit'`)
 * was never told one existed.
 *
 * 🔑 THE RECIPIENTS ARE EXACTLY THE PEOPLE WHO CAN ANSWER. A delegate counts
 * when, and only when, the database would let them approve:
 *   · the seat is accepted and not removed (`moderator_area_level`'s own WHERE);
 *   · its schedule level resolves to 'edit' through `resolveAreaLevel`, the TS
 *     mirror of `public.moderator_area_level` — never a second copy of the rule;
 *   · its access window is still open (`delegate-access-window.ts`, owner
 *     2026-09-14: a delegate's access ends 7 days after the event).
 * View, Off, an un-accepted invite, a removed seat and an expired window are
 * not told — telling somebody about a request they cannot answer is noise.
 *
 * Pure (type-only imports + two pure modules), so the rule is executed by a
 * test rather than read off a server file.
 */
import { resolveAreaLevel, type ModeratorPermissions } from './delegate-areas';
import { permissionsWithinWindow } from './delegate-access-window';

export type ScheduleRequestSeat = {
  user_id: string | null;
  accepted_at: string | null;
  removed_at: string | null;
  permissions_json: ModeratorPermissions | null;
};

export type ScheduleRequestWindow = {
  eventDate: string | null;
  eventEndDate: string | null;
  precision: string | null;
};

/** The couple first, then each approving delegate; every user once. */
export function scheduleRequestRecipients(input: {
  coupleUserIds: readonly (string | null)[];
  seats: readonly ScheduleRequestSeat[];
  window: ScheduleRequestWindow;
  now: Date;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };

  for (const id of input.coupleUserIds) add(id);

  for (const seat of input.seats) {
    if (!seat.user_id || !seat.accepted_at || seat.removed_at) continue;
    const perms = permissionsWithinWindow(seat.permissions_json, {
      isCouple: false,
      eventDate: input.window.eventDate,
      eventEndDate: input.window.eventEndDate,
      precision: input.window.precision,
      now: input.now,
    });
    if (resolveAreaLevel(perms, 'schedule') === 'edit') add(seat.user_id);
  }
  return out;
}

export type ScheduleRequestKind = 'new' | 'adjust' | 'remove';

/**
 * The tray / email title. Names the supplier and the item, in the words the
 * Schedule page uses ("moment"), so the person knows what to look at before
 * they open it.
 */
export function scheduleRequestTitle(input: {
  supplierName: string;
  kind: ScheduleRequestKind;
  /** The block's label for adjust/remove; the proposed label for new. */
  itemLabel: string | null;
  /** adjust only: does it carry a new time, label or place (an edit), or only words? */
  proposesChange: boolean;
}): string {
  const who = input.supplierName.trim() || 'A supplier';
  const item = input.itemLabel?.trim();
  switch (input.kind) {
    case 'new':
      return item ? `${who} asked to add “${item}” to the schedule` : `${who} asked to add a moment to the schedule`;
    case 'remove':
      return item ? `${who} asked to remove “${item}” from the schedule` : `${who} asked to remove a moment from the schedule`;
    case 'adjust':
      if (input.proposesChange) {
        return item ? `${who} asked to change “${item}”` : `${who} asked to change a moment`;
      }
      return item ? `${who} suggested a change to “${item}”` : `${who} suggested a change to the schedule`;
  }
}
