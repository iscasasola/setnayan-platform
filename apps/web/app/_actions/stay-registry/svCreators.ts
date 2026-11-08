import 'server-only';
import type { SvCreatorsStayDoor } from '@/lib/stay-doors/svCreators';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { sendCreatorOffer } from '@/app/vendor-dashboard/creators/actions';
import { kind, type Door } from './_door';

/** A refusal is `?error=<the sentence>` (`humanizeOfferError`), which `creators/page.tsx` prints as given. A sent offer
 *  (`?sent=1`) re-draws the card as "Offer pending". No shop → bare `/vendor-dashboard`: navigates. */
const SV_CREATORS_WORDS: StayWords = { within: [supplierScreen('creators')], refuse: (q) => q.get('error') };
const svCreators = kind(SV_CREATORS_WORDS, false);

export const SV_CREATORS: Readonly<Record<SvCreatorsStayDoor, Door>> = {
  'svCreators.sendCreatorOffer': svCreators(sendCreatorOffer),
};
