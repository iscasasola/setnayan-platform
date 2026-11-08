import 'server-only';
import type { SupActivitiesStayDoor } from '@/lib/stay-doors/supActivities';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { addActivity, reorderActivity, toggleActivityOffered, updateActivity } from '@/app/vendor-dashboard/activities/actions';
import { addQuestion, toggleQuestionAsked, updateQuestion } from '@/app/vendor-dashboard/activities/question-actions';
import { kind, type Door } from './_door';

/** Activities' `?error=` already carries the page's own sentence (`activities/page.tsx` prints it as given). Signed out
 *  → `/login`, no shop → bare `/vendor-dashboard`: both navigate. A supplier door carries no event, so `null`. */
const SUP_ACTIVITIES_WORDS: StayWords = { within: [supplierScreen('activities')], refuse: (q) => q.get('error') };
const supActivities = kind(SUP_ACTIVITIES_WORDS, false);

export const SUP_ACTIVITIES: Readonly<Record<SupActivitiesStayDoor, Door>> = {
  'supActivities.addActivity': supActivities(addActivity),
  'supActivities.updateActivity': supActivities(updateActivity),
  'supActivities.toggleActivityOffered': supActivities(toggleActivityOffered),
  'supActivities.reorderActivity': supActivities(reorderActivity),
  'supActivities.addQuestion': supActivities(addQuestion),
  'supActivities.updateQuestion': supActivities(updateQuestion),
  'supActivities.toggleQuestionAsked': supActivities(toggleQuestionAsked),
};
