/** Sponsors — every row and sheet on `/dashboard/<ev>/sponsors` (`sponsors/actions.ts`). */
export const SPONSORS_STAY_DOORS = [
  'sponsors.addSponsor',
  'sponsors.updateSponsor',
  'sponsors.removeSponsor',
  'sponsors.sendInvitation',
  'sponsors.markResponse',
] as const;
export type SponsorsStayDoor = (typeof SPONSORS_STAY_DOORS)[number];
