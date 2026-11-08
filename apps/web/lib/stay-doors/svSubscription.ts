/** Plan — "Keep my current plan instead" on the plan screen (`/vendor-dashboard/subscription`, also drawn in Shop settings) (`subscription/actions.ts`). */
export const SV_SUBSCRIPTION_STAY_DOORS = ['svSubscription.cancelScheduledPlanChange'] as const;
export type SvSubscriptionStayDoor = (typeof SV_SUBSCRIPTION_STAY_DOORS)[number];
