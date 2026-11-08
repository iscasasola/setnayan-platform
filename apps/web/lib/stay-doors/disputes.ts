/** Disputes — Open a new dispute (`disputes/actions.ts`). */
export const DISPUTES_STAY_DOORS = ['disputes.fileForceMajeureFlag'] as const;
export type DisputesStayDoor = (typeof DISPUTES_STAY_DOORS)[number];
