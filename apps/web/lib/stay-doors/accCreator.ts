/** Account › Creator — the chapters and the supplier offers on `/dashboard/creator` (`creator/actions.ts`,
 *  `creator/offer-actions.ts`). */
export const ACC_CREATOR_STAY_DOORS = [
  'accCreator.createChapter',
  'accCreator.updateChapter',
  'accCreator.setChapterAudience',
  'accCreator.deleteChapter',
  'accCreator.acceptCreatorOffer',
  'accCreator.declineCreatorOffer',
  'accCreator.linkCreatorOfferDeliverable',
] as const;
export type AccCreatorStayDoor = (typeof ACC_CREATOR_STAY_DOORS)[number];
