import 'server-only';
import type { InvitationStayDoor } from '@/lib/stay-doors/invitation';
import { eventScreen, NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import { plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';
import { MONO_ERROR_COPY } from '@/app/dashboard/[eventId]/invitation/mono-error-copy';
import { updateMonogram } from '@/app/dashboard/[eventId]/invitation/actions';
import { kind, onEvent, type Door } from './_door';

/** The page's own words for a refused monogram colour (`mono-error-copy.ts`; a sentence the action wrote is shown as is). */
const INVITATION_WORDS: StayWords = {
  within: [eventScreen('invitation')],
  refuse: (q) => {
    const code = q.get('mono_error');
    return code ? (MONO_ERROR_COPY[code] ?? plainRefusal(code, NOTHING_CHANGED)) : null;
  },
};
const invitation = kind(INVITATION_WORDS, 'invitations');

export const INVITATION: Readonly<Record<InvitationStayDoor, Door>> = {
  'invitation.updateMonogram': invitation(onEvent(updateMonogram)),
};
