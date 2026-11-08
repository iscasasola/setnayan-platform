import 'server-only';
import type { PatiktokStayDoor } from '@/lib/stay-doors/patiktok';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { disconnectPatiktokTiktok, savePatiktokBoothTemplates, submitPatiktokRender } from '@/app/dashboard/[eventId]/studio/patiktok/actions';
import { kind, type Door } from './_door';

/**
 * The booth's presses land where they were pressed — the studio, the booth page, or Home's Video booth card
 * (`return_to=home`). Home is safe to stay on here: every Patiktok gate THROWS its refusal ("Only people on this event
 * can set up its booth."), none bounces to Home, so a landing on Home is only ever the saved pick.
 */
const PATIKTOK_WORDS: StayWords = { within: [eventScreen(''), eventScreen('studio/patiktok'), eventScreen('studio/patiktok/booth')] };
const patiktok = kind(PATIKTOK_WORDS, 'photos');

export const PATIKTOK: Readonly<Record<PatiktokStayDoor, Door>> = {
  'patiktok.savePatiktokBoothTemplates': patiktok(savePatiktokBoothTemplates),
  'patiktok.disconnectPatiktokTiktok': patiktok(disconnectPatiktokTiktok),
  'patiktok.submitPatiktokRender': patiktok(submitPatiktokRender),
};
