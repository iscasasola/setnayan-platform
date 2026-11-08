/** Creators — "Send offer" on each creator card of `/vendor-dashboard/creators` (`creators/actions.ts`). */
export const SV_CREATORS_STAY_DOORS = ['svCreators.sendCreatorOffer'] as const;
export type SvCreatorsStayDoor = (typeof SV_CREATORS_STAY_DOORS)[number];
