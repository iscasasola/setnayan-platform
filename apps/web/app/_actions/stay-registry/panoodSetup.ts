import 'server-only';
import type { PanoodSetupStayDoor } from '@/lib/stay-doors/panoodSetup';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import {
  clearPanoodFacebookUrl,
  clearPanoodWatchUrl,
  savePanoodFacebookUrl,
  savePanoodWatchUrl,
} from '@/app/dashboard/[eventId]/studio/panood/setup/actions';
import { kind, type Door } from './_door';

/** The setup page's own words for a pasted link that is not one (`?watch_url_error=1` · `?facebook_url_error=1`). */
const PANOOD_SETUP_WORDS: StayWords = {
  within: [eventScreen('studio/panood/setup')],
  refuse: (q) =>
    q.get('watch_url_error')
      ? 'That doesn’t look like a YouTube link — paste the watch or share URL.'
      : q.get('facebook_url_error')
        ? 'That doesn’t look like a Facebook video link — open your live video on Facebook, tap Share → Copy link, and paste that.'
        : null,
};
const panoodSetup = kind(PANOOD_SETUP_WORDS, null);

export const PANOOD_SETUP: Readonly<Record<PanoodSetupStayDoor, Door>> = {
  'panoodSetup.savePanoodWatchUrl': panoodSetup(savePanoodWatchUrl),
  'panoodSetup.clearPanoodWatchUrl': panoodSetup(clearPanoodWatchUrl),
  'panoodSetup.savePanoodFacebookUrl': panoodSetup(savePanoodFacebookUrl),
  'panoodSetup.clearPanoodFacebookUrl': panoodSetup(clearPanoodFacebookUrl),
};
