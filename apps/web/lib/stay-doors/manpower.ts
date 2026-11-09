/** Manpower (the host's side) — Cancel a gig (`manpower/host-actions.ts`). */
export const MANPOWER_STAY_DOORS = ['manpower.cancelGigFromHost'] as const;
export type ManpowerStayDoor = (typeof MANPOWER_STAY_DOORS)[number];
