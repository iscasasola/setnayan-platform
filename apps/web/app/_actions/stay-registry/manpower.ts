import 'server-only';
import type { ManpowerStayDoor } from '@/lib/stay-doors/manpower';
import { eventScreen, NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import { plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';
import { cancelGigFromHost } from '@/app/dashboard/[eventId]/manpower/host-actions';
import { kind, type Door } from './_door';

/** The page shows `?error=` as given ("Could not cancel this gig.") — said on the row instead. */
const MANPOWER_WORDS: StayWords = {
  within: [eventScreen('manpower')],
  refuse: (q) => {
    const e = q.get('error');
    return e ? plainRefusal(e, NOTHING_CHANGED) : null;
  },
};
const manpower = kind(MANPOWER_WORDS, 'vendors');

export const MANPOWER: Readonly<Record<ManpowerStayDoor, Door>> = {
  'manpower.cancelGigFromHost': manpower(cancelGigFromHost),
};
