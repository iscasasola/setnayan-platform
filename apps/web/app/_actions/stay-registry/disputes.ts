import 'server-only';
import type { DisputesStayDoor } from '@/lib/stay-doors/disputes';
import { eventScreen, NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import { plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';
import { fileForceMajeureFlag } from '@/app/dashboard/[eventId]/disputes/actions';
import { kind, type Door } from './_door';

/** The page shows `?error=` as given — said here as long as it is a plain sentence. */
const DISPUTES_WORDS: StayWords = {
  within: [eventScreen('disputes')],
  refuse: (q) => {
    const e = q.get('error');
    return e ? plainRefusal(e, NOTHING_CHANGED) : null;
  },
};
const disputes = kind(DISPUTES_WORDS, null);

export const DISPUTES: Readonly<Record<DisputesStayDoor, Door>> = {
  'disputes.fileForceMajeureFlag': disputes(fileForceMajeureFlag),
};
