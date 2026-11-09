import 'server-only';
import type { SponsorsStayDoor } from '@/lib/stay-doors/sponsors';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { addSponsor, markResponse, removeSponsor, sendInvitation, updateSponsor } from '@/app/dashboard/[eventId]/sponsors/actions';
import { kind, type Door } from './_door';

/** Sponsors' `?error=` already carries the page's own sentence (`sponsors/page.tsx` shows it as given). Hosts only — a
 *  limited helper is refused (`null`), as `sponsors/actions.ts` already does. */
const SPONSORS_WORDS: StayWords = { within: [eventScreen('sponsors')], refuse: (q) => q.get('error') };
const sponsors = kind(SPONSORS_WORDS, null);

export const SPONSORS: Readonly<Record<SponsorsStayDoor, Door>> = {
  'sponsors.addSponsor': sponsors(addSponsor),
  'sponsors.updateSponsor': sponsors(updateSponsor),
  'sponsors.removeSponsor': sponsors(removeSponsor),
  'sponsors.sendInvitation': sponsors(sendInvitation),
  'sponsors.markResponse': sponsors(markResponse),
};
