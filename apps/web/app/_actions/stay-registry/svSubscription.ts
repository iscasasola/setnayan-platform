import 'server-only';
import type { SvSubscriptionStayDoor } from '@/lib/stay-doors/svSubscription';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { cancelScheduledPlanChange } from '@/app/vendor-dashboard/subscription/actions';
import { kind, type Door } from './_door';

/** "Keep my current plan instead" lands on the Plan page with `?kept=1`, or refuses with `?error=<the sentence>`, which
 *  the plan screen prints as given. The plan screen is also drawn in Shop settings — the redirect still names the Plan
 *  page, so it reads as saved and the page the press is on re-renders. Signed out → `/login`: navigates. */
const SV_SUBSCRIPTION_WORDS: StayWords = { within: [supplierScreen('subscription')], refuse: (q) => q.get('error') };
const svSubscription = kind(SV_SUBSCRIPTION_WORDS, false);

export const SV_SUBSCRIPTION: Readonly<Record<SvSubscriptionStayDoor, Door>> = {
  'svSubscription.cancelScheduledPlanChange': svSubscription(cancelScheduledPlanChange),
};
