/** Activities — the supplier's segments and questions on `/vendor-dashboard/activities` (`activities/actions.ts`,
 *  `activities/question-actions.ts`). */
export const SUP_ACTIVITIES_STAY_DOORS = [
  'supActivities.addActivity',
  'supActivities.updateActivity',
  'supActivities.toggleActivityOffered',
  'supActivities.reorderActivity',
  'supActivities.addQuestion',
  'supActivities.updateQuestion',
  'supActivities.toggleQuestionAsked',
] as const;
export type SupActivitiesStayDoor = (typeof SUP_ACTIVITIES_STAY_DOORS)[number];
