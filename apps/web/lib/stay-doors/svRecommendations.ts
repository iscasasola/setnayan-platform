/** Recommend — Turn on / Turn off and the two feedback forms on `/vendor-dashboard/recommendations` (`recommendations/actions.ts`). */
export const SV_RECOMMENDATIONS_STAY_DOORS = ['svRecommendations.setOptIn', 'svRecommendations.flagFeedback'] as const;
export type SvRecommendationsStayDoor = (typeof SV_RECOMMENDATIONS_STAY_DOORS)[number];
