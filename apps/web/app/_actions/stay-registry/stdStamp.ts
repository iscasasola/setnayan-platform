import 'server-only';
import type { StdStampStayDoor } from '@/lib/stay-doors/stdStamp';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { saveWaxSeal } from '@/app/dashboard/[eventId]/studio/save-the-date/wax-actions';
import { kind, type Door } from './_door';

/** `?wax_error=` was drawn by no banner — a refused seal said nothing. In place it is said on the row. */
const STD_STAMP_WORDS: StayWords = {
  within: [eventScreen('studio/save-the-date/stamp')],
  refuse: (q) => (q.get('wax_error') === 'not-found' ? 'This page is for the couple’s account.' : null),
};
const stdStamp = kind(STD_STAMP_WORDS, 'invitations');

export const STD_STAMP: Readonly<Record<StdStampStayDoor, Door>> = {
  'stdStamp.saveWaxSeal': stdStamp(saveWaxSeal),
};
