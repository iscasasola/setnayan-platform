/** Supplier disputes — "Submit my response" / "Update my response" on `/vendor-dashboard/disputes` (`disputes/actions.ts`). */
export const SV_DISPUTES_STAY_DOORS = ['svDisputes.submitDisputeContest'] as const;
export type SvDisputesStayDoor = (typeof SV_DISPUTES_STAY_DOORS)[number];
