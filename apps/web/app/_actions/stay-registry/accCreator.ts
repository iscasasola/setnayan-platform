import 'server-only';
import type { AccCreatorStayDoor } from '@/lib/stay-doors/accCreator';
import type { StayWords } from '@/lib/save-in-place';
import { createChapter, deleteChapter, setChapterAudience, updateChapter } from '@/app/dashboard/(account)/creator/actions';
import { acceptCreatorOffer, declineCreatorOffer, linkCreatorOfferDeliverable } from '@/app/dashboard/(account)/creator/offer-actions';
import { kind, type Door } from './_door';

/** Creator's refusals already carry the page's own sentence (`fail()` / `back()` → `?error=<sentence>`, shown as
 *  given). Signed out → `/login`, navigates. An account screen — no event, no limited-helper area. */
const ACC_CREATOR_WORDS: StayWords = { within: [/^\/dashboard\/creator$/], refuse: (q) => q.get('error') };
const accCreator = kind(ACC_CREATOR_WORDS, null);

export const ACC_CREATOR: Readonly<Record<AccCreatorStayDoor, Door>> = {
  'accCreator.createChapter': accCreator(createChapter),
  'accCreator.updateChapter': accCreator(updateChapter),
  'accCreator.setChapterAudience': accCreator(setChapterAudience),
  'accCreator.deleteChapter': accCreator(deleteChapter),
  'accCreator.acceptCreatorOffer': accCreator(acceptCreatorOffer),
  'accCreator.declineCreatorOffer': accCreator(declineCreatorOffer),
  'accCreator.linkCreatorOfferDeliverable': accCreator(linkCreatorOfferDeliverable),
};
