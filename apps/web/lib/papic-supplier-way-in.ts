/**
 * THE "SUPPLIERS" WAY INTO THE PAPIC LIBRARY — what it says, worked out from what is TRUE.
 *
 * Owner 2026-10-23, of the row reading *"Suppliers · Your photographer's finished work, straight into
 * your library · NOT OPEN YET"*: *"what is this for?"*
 *
 * 🔑 "NOT OPEN YET" WAS A HARD-CODED STRING, AND IT WAS FALSE. The row's own comment said the supplier
 * capture lane was *"built and switched off behind the outstanding privacy ruling"*. Measured in the code:
 * the lane (`/api/vendor/papic-capture`) is gated by `isVendorPapicCaptureEnabled()` — the admin Data
 * Privacy control `vendor_papic_capture`, whose own route docblock records it ACTIVE IN PRODUCTION since
 * 2026-07-16 — and by the insert policy, which admits only a supplier BOOKED on the event
 * (`current_vendor_booked_event_ids()`: an `event_vendors` row in `contracted · deposit_paid · delivered ·
 * complete` with a `marketplace_vendor_id`). A supplier's day-of shots already reach the couple's gallery
 * (`fetchPapicGallery` reads `vendor_papic_captures`). So the row was telling every couple a door was shut
 * that, for any couple with a booked supplier, was open.
 *
 * So the row now says the real reason, from two reads, and a read that fails SAYS SO — it never falls back
 * to "not open", which is a claim about the event a failed read has not earned.
 */

/** The `event_vendors.status` values the database counts as BOOKED — `current_vendor_booked_event_ids()`. */
export const SUPPLIER_BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

export type SupplierWayInState =
  | { kind: 'unknown' }
  | { kind: 'lane_off' }
  | { kind: 'none_booked' }
  | { kind: 'closed' }
  | { kind: 'booked'; count: number };

/**
 * `laneOn` — the `vendor_papic_capture` control (or its env override): true / false, null when unread.
 * `booked` — how many suppliers are booked on this event through Setnayan: a count, null when unread.
 * `over` — the event's lifecycle phase is 'after' (`getMenuLifecyclePhase`, the route's own gate: owner
 *   2026-08-28, *"they get to use it until event day"*); null when the event row was not read.
 */
export function supplierWayInState(i: {
  laneOn: boolean | null;
  booked: number | null;
  over: boolean | null;
}): SupplierWayInState {
  if (i.laneOn === null) return { kind: 'unknown' };
  // A lane the privacy board has switched off is shut for EVERY couple, whatever they have booked.
  if (i.laneOn === false) return { kind: 'lane_off' };
  if (i.booked === null || i.over === null) return { kind: 'unknown' };
  if (i.over) return { kind: 'closed' };
  if (i.booked <= 0) return { kind: 'none_booked' };
  return { kind: 'booked', count: i.booked };
}

/** The row's short value — one line, never "Not open yet". */
export function supplierWayInLabel(state: SupplierWayInState): string {
  switch (state.kind) {
    case 'unknown':
      return 'Couldn’t check';
    case 'lane_off':
      return 'Waiting on privacy approval';
    case 'none_booked':
      return 'Opens when you book one';
    case 'closed':
      return 'Closed after your day';
    case 'booked':
      return `${state.count} booked`;
  }
}

/** The row's blurb — what the lane IS, true in every state. */
export const SUPPLIER_WAY_IN_BLURB = 'Photos your booked suppliers take on the day';
