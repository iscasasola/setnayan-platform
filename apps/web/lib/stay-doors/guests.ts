/** Guests — Select → Set… ▾ (group · table · side) and New group (`guests/groups-actions.ts`), through the Guests
 *  screen's actions context (`guest-actions-context.tsx` › `stay`). */
export const GUESTS_STAY_DOORS = ['guests.bulkApplyRoleAndGroup', 'guests.createGuestGroup'] as const;
export type GuestsStayDoor = (typeof GUESTS_STAY_DOORS)[number];
