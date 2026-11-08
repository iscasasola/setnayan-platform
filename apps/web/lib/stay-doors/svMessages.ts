/** Messages — the "How did this inquiry end?" card on `/vendor-dashboard/messages/<thread>` (`outcome-actions.ts`). */
export const SV_MESSAGES_STAY_DOORS = ['svMessages.recordInquiryOutcome'] as const;
export type SvMessagesStayDoor = (typeof SV_MESSAGES_STAY_DOORS)[number];
