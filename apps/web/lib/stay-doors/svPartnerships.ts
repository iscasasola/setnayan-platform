/** Partnerships — every row and the propose form on `/vendor-dashboard/partnerships` (`partnerships/actions.ts`). */
export const SV_PARTNERSHIPS_STAY_DOORS = [
  'svPartnerships.proposePartnership',
  'svPartnerships.acceptPartnership',
  'svPartnerships.declinePartnership',
  'svPartnerships.withdrawPartnership',
  'svPartnerships.changePartnershipKind',
  'svPartnerships.removePartnership',
  'svPartnerships.toggleTrustedByHidden',
] as const;
export type SvPartnershipsStayDoor = (typeof SV_PARTNERSHIPS_STAY_DOORS)[number];
