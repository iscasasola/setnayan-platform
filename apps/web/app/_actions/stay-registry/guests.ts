import 'server-only';
import type { GuestsStayDoor } from '@/lib/stay-doors/guests';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { formatCount } from '@/lib/format-number';
import { guestListErrorCopy } from '@/app/dashboard/[eventId]/guests/_components/guest-list-error-copy';
import { bulkApplyRoleAndGroup, createGuestGroup } from '@/app/dashboard/[eventId]/guests/groups-actions';
import { kind, onEvent, type Door } from './_door';

/**
 * The guest list's own words: a refusal is `guestListErrorCopy` (the banner's — a code becomes a sentence, a database
 * message never shows); a partial table set keeps the banner's line about who was left as they were.
 */
const GUESTS_WORDS: StayWords = {
  within: [eventScreen('guests')],
  refuse: (q) => {
    const e = q.get('error');
    return e ? guestListErrorCopy(e) : null;
  },
  note: (q) => {
    const left = Number(q.get('bulk_unseatable') ?? 0);
    return left > 0 ? `${formatCount(left)} not coming or not placed were left as they were.` : null;
  },
};
const guests = kind(GUESTS_WORDS, 'guest_list');

export const GUESTS: Readonly<Record<GuestsStayDoor, Door>> = {
  'guests.bulkApplyRoleAndGroup': guests(onEvent(bulkApplyRoleAndGroup)),
  'guests.createGuestGroup': guests(onEvent(createGuestGroup)),
};
