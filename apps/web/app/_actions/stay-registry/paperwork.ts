import 'server-only';
import type { PaperworkStayDoor } from '@/lib/stay-doors/paperwork';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import {
  markPaperworkReceived,
  markPaperworkRequested,
  seedPaperworkForEvent,
  setPaperworkNotes,
  setPaperworkStatus,
  uploadPaperworkScan,
} from '@/app/dashboard/[eventId]/paperwork/actions';
import { updateNikahDetails } from '@/app/dashboard/[eventId]/nikah-actions';
import { kind, onEvent, type Door } from './_door';

/** These actions never redirect on a refusal: they throw one plain sentence, which `saveInPlace` says under the form.
 *  Hosts only — the actions' own gate is `refuseLimitedHelper(eventId, null)`. */
const PAPERWORK_WORDS: StayWords = { within: [eventScreen('paperwork'), eventScreen('nikah')] };
const paperwork = kind(PAPERWORK_WORDS, null);

export const PAPERWORK: Readonly<Record<PaperworkStayDoor, Door>> = {
  'paperwork.seedPaperworkForEvent': paperwork(seedPaperworkForEvent),
  'paperwork.markPaperworkRequested': paperwork(markPaperworkRequested),
  'paperwork.markPaperworkReceived': paperwork(markPaperworkReceived),
  'paperwork.setPaperworkStatus': paperwork(setPaperworkStatus),
  'paperwork.uploadPaperworkScan': paperwork(uploadPaperworkScan),
  'paperwork.setPaperworkNotes': paperwork(setPaperworkNotes),
  'paperwork.updateNikahDetails': paperwork(onEvent(updateNikahDetails)),
};
