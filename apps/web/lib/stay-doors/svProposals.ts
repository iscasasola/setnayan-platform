/** Quotes — "Save template" on the Quotes surface (`/vendor-dashboard/proposals`, also drawn on Customers), and the
 *  couple's Accept / Decline on a quote (`/proposals/<id>`, and "Accept the update" in a chat thread)
 *  (`proposals/actions.ts`). */
export const SV_PROPOSALS_STAY_DOORS = ['svProposals.saveTemplate', 'svProposals.respondToProposal'] as const;
export type SvProposalsStayDoor = (typeof SV_PROPOSALS_STAY_DOORS)[number];
