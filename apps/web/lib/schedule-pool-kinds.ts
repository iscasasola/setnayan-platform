/**
 * 🏛 WHICH SCHEDULE POOLS ARE SCHEDULES — one filter for every reader that predates Spaces (ship review 21 Nov on #8088).
 *
 * Since Spaces (migration 20271356372536) a `vendor_schedule_pools` row can be a cart, a vehicle, an object, clothing or
 * "Others" (`space_kind`). Those live on Shop › Spaces and are booked through a card's Uses pick; they are not a team's
 * schedule and not a hall. Carts, vehicles and items are also `is_hall` (booked whole), so a reader that filtered on
 * `is_hall` alone offered a cart in a venue card's halls pick.
 *
 * The readers that list schedules or halls (Teams and days, a card's Schedule and Uses picks, Today, a chat's day
 * answer, Check a date) keep exactly what they kept before Spaces: a team schedule (`space_kind` NULL), a hall, and a
 * room (a room is booked whole like a hall). Pure: no database. 🔒 lib/schedule-pool-kinds.test.ts
 */

/** PostgREST `.or(...)` for the pools a pre-Spaces reader keeps. */
export const SCHEDULE_OR_HALL_POOLS = 'space_kind.is.null,space_kind.in.(hall,room)';

/** The same rule on a row already read. */
export function isScheduleOrHall(spaceKind: string | null | undefined): boolean {
  return spaceKind == null || spaceKind === 'hall' || spaceKind === 'room';
}
