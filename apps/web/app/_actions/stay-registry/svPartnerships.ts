import 'server-only';
import type { SvPartnershipsStayDoor } from '@/lib/stay-doors/svPartnerships';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import {
  acceptPartnership,
  changePartnershipKind,
  declinePartnership,
  proposePartnership,
  withdrawPartnership,
} from '@/app/vendor-dashboard/partnerships/actions';
import { kind, type Door } from './_door';

/** A refusal is `?error=<the sentence>`, which `partnerships/page.tsx` prints as given. `?proposed|accepted|declined|
 *  withdrawn=1` re-draws the lists in place. No shop → bare `/vendor-dashboard`: navigates. */
const SV_PARTNERSHIPS_WORDS: StayWords = { within: [supplierScreen('partnerships')], refuse: (q) => q.get('error') };
const svPartnerships = kind(SV_PARTNERSHIPS_WORDS, null);

export const SV_PARTNERSHIPS: Readonly<Record<SvPartnershipsStayDoor, Door>> = {
  'svPartnerships.proposePartnership': svPartnerships(proposePartnership),
  'svPartnerships.acceptPartnership': svPartnerships(acceptPartnership),
  'svPartnerships.declinePartnership': svPartnerships(declinePartnership),
  'svPartnerships.withdrawPartnership': svPartnerships(withdrawPartnership),
  'svPartnerships.changePartnershipKind': svPartnerships(changePartnershipKind),
};
