import 'server-only';
import { panoodRefusal, type PubPanoodStayDoor } from '@/lib/stay-doors/pubPanood';
import type { StayWords } from '@/lib/save-in-place';
import {
  addEventFilm,
  addRoamZone,
  clearControlFacebookUrl,
  clearControlManualAir,
  clearControlWatchUrl,
  clearMainStage,
  createChannelJoinLink,
  deleteHighlight,
  deleteRoamZone,
  markHighlight,
  reissueChannelJoinLink,
  removeEventFilm,
  renameRoamZone,
  saveControlFacebookUrl,
  saveControlWatchUrl,
  setControlManualAir,
  setFeaturedRoamZone,
} from '@/app/panood/control/[eventId]/actions';
import {
  addLiveScreen,
  reissueLiveScreenCode,
  removeLiveScreen,
  renameLiveScreen,
  setAllLiveScreensMode,
  setLiveScreenMode,
} from '@/app/panood/control/[eventId]/screens-actions';
import { kind, type Door } from './_door';

/**
 * The controller's refusals in its own words (`panoodRefusal`, the list its banners draw). Every gate's bounce lands
 * elsewhere and navigates: switched off → Studio, not a host → bare `/dashboard`, a moment without Live Studio → its
 * buy page, signed out → `/login`. Hosts only: the door refuses a limited helper (`null`), as the setup page's own
 * Panood actions already do (`studio/panood/setup/actions.ts`).
 */
const PUB_PANOOD_WORDS: StayWords = { within: [/^\/panood\/control\/[^/]+$/], refuse: (q) => panoodRefusal(q) };
const pubPanood = kind(PUB_PANOOD_WORDS, null);

export const PUB_PANOOD: Readonly<Record<PubPanoodStayDoor, Door>> = {
  'pubPanood.addRoamZone': pubPanood(addRoamZone),
  'pubPanood.renameRoamZone': pubPanood(renameRoamZone),
  'pubPanood.deleteRoamZone': pubPanood(deleteRoamZone),
  'pubPanood.setFeaturedRoamZone': pubPanood(setFeaturedRoamZone),
  'pubPanood.createChannelJoinLink': pubPanood(createChannelJoinLink),
  'pubPanood.reissueChannelJoinLink': pubPanood(reissueChannelJoinLink),
  'pubPanood.clearMainStage': pubPanood(clearMainStage),
  'pubPanood.markHighlight': pubPanood(markHighlight),
  'pubPanood.deleteHighlight': pubPanood(deleteHighlight),
  'pubPanood.saveControlWatchUrl': pubPanood(saveControlWatchUrl),
  'pubPanood.clearControlWatchUrl': pubPanood(clearControlWatchUrl),
  'pubPanood.saveControlFacebookUrl': pubPanood(saveControlFacebookUrl),
  'pubPanood.clearControlFacebookUrl': pubPanood(clearControlFacebookUrl),
  'pubPanood.addEventFilm': pubPanood(addEventFilm),
  'pubPanood.removeEventFilm': pubPanood(removeEventFilm),
  'pubPanood.setControlManualAir': pubPanood(setControlManualAir),
  'pubPanood.clearControlManualAir': pubPanood(clearControlManualAir),
  'pubPanood.addLiveScreen': pubPanood(addLiveScreen),
  'pubPanood.renameLiveScreen': pubPanood(renameLiveScreen),
  'pubPanood.removeLiveScreen': pubPanood(removeLiveScreen),
  'pubPanood.setLiveScreenMode': pubPanood(setLiveScreenMode),
  'pubPanood.setAllLiveScreensMode': pubPanood(setAllLiveScreensMode),
  'pubPanood.reissueLiveScreenCode': pubPanood(reissueLiveScreenCode),
};
