/**
 * event-size.ts — 👥 THE STARTING GUEST NUMBER BY EVENT SIZE (owner 2026-11-17, DECISION_LOG "STARTING GUEST COUNT
 * WHEN THE HOST HAS NO NUMBER: SMALL 30 · MEDIUM 50 · LARGE (WEDDING) 150 — SHOWN AS THEIR MINIMUM, CHANGEABLE").
 *
 * The SIZE lives on the event-type profile (`event_type_profiles.event_size`, admin-editable — migration
 * 20271350215206); these three numbers are the owner's own and live here once. A type with no size set gets NO start
 * number (null) — the guest step then starts where it always did. Never a guess.
 */
import type { EventSize } from './event-type-profile';

export const EVENT_SIZE_START_GUESTS: Readonly<Record<EventSize, number>> = { small: 30, medium: 50, large: 150 };

/** The words beside each size in the guest step and in Admin ("Large · 150"). */
export const EVENT_SIZE_LABEL: Readonly<Record<EventSize, string>> = { small: 'Small', medium: 'Medium', large: 'Large' };

/** The start number for a size, or null when the type has none set. */
export function startGuestsForSize(size: EventSize | null | undefined): number | null {
  return size ? EVENT_SIZE_START_GUESTS[size] : null;
}

/** The line under the number (owner: "this is gonna be their minimum number. So if they want to change it, they can"). */
export const START_GUESTS_LINE = 'This is your minimum to start. Change it any time.';
