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
 *   · its schedule level resolves to 'edit' through `seatAreaLevel`, the TS
 *     mirror of `public.moderator_area_level` — never a second copy of the rule —
 *     which since 8 Nov 2026 caps a SUPPLIER's seat at 'view' unless they are the
 *     booked coordinator (`supplierProposesOnly`, migration 20271329978605): a
 *     florist the hosts let see the day proposes, they never approve;
 *   · its access window is still open (`delegate-access-window.ts`, owner
 *     2026-09-14: a delegate's access ends 7 days after the event).
 * View, Off, an un-accepted invite, a removed seat and an expired window are
 * not told — telling somebody about a request they cannot answer is noise.
 *
 * Pure (type-only imports + two pure modules), so the rule is executed by a
 * test rather than read off a server file.
 */
import { seatAreaLevel, supplierProposesOnly, type ModeratorPermissions } from './delegate-areas';
import { permissionsWithinWindow } from './delegate-access-window';

export type ScheduleRequestSeat = {
  user_id: string | null;
  /** The seat's role — a supplier's seat is `wedding_planner_external` (SUPPLIER_SEAT_ROLE). */
  role_subtype?: string | null;
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
  /**
   * 🧭 Per person acting for a shop booked on the event: booked supplier? booked coordinator? (`bookedSupplierFacts`,
   * lib/coordinator-trade.ts). Somebody absent is not a booked supplier, so their seat is the hosts' own delegate.
   */
  suppliers?: ReadonlyMap<string, { bookedSupplier: boolean; bookedCoordinator: boolean }>;
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
    const facts = input.suppliers?.get(seat.user_id);
    const proposesOnly = supplierProposesOnly({
      roleSubtype: seat.role_subtype ?? null,
      bookedSupplier: facts?.bookedSupplier ?? false,
      bookedCoordinator: facts?.bookedCoordinator ?? false,
    });
    if (seatAreaLevel(perms, 'schedule', proposesOnly) === 'edit') add(seat.user_id);
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
  /** Auto-agree already put it on the schedule (Step 4b): say it is in, never "asked". */
  applied?: boolean;
}): string {
  const who = input.supplierName.trim() || 'A supplier';
  const item = input.itemLabel?.trim();
  if (input.applied) {
    switch (input.kind) {
      case 'new':
        return item ? `${who} added “${item}” to the schedule (Auto-agree)` : `${who} added a moment to the schedule (Auto-agree)`;
      case 'remove':
        return item ? `${who} removed “${item}” from the schedule (Auto-agree)` : `${who} removed a moment from the schedule (Auto-agree)`;
      case 'adjust':
        return item ? `${who} changed “${item}” (Auto-agree)` : `${who} changed a moment (Auto-agree)`;
    }
  }
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
