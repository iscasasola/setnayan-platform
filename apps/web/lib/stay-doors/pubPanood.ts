import { MAX_ROAM_ZONES } from '@/lib/live-studio-roam-zones';
import { VENUE_SCREENS_LOCKED_MESSAGE } from '@/lib/live-screens';

/** Panood › the live controller `/panood/control/<ev>` — its channels, join QRs, moments, links, films, Channel 1 and
 *  the venue screens (`panood/control/[eventId]/actions.ts`, `screens-actions.ts`). The five switches Home's Live card
 *  also posts (cut · monogram · lower third · event QR · guest-pick) are not doors yet. */
export const PUB_PANOOD_STAY_DOORS = [
  'pubPanood.addRoamZone',
  'pubPanood.renameRoamZone',
  'pubPanood.deleteRoamZone',
  'pubPanood.setFeaturedRoamZone',
  'pubPanood.createChannelJoinLink',
  'pubPanood.reissueChannelJoinLink',
  'pubPanood.clearMainStage',
  'pubPanood.markHighlight',
  'pubPanood.deleteHighlight',
  'pubPanood.saveControlWatchUrl',
  'pubPanood.clearControlWatchUrl',
  'pubPanood.saveControlFacebookUrl',
  'pubPanood.clearControlFacebookUrl',
  'pubPanood.addEventFilm',
  'pubPanood.removeEventFilm',
  'pubPanood.setControlManualAir',
  'pubPanood.clearControlManualAir',
  'pubPanood.addLiveScreen',
  'pubPanood.renameLiveScreen',
  'pubPanood.removeLiveScreen',
  'pubPanood.setLiveScreenMode',
  'pubPanood.setAllLiveScreensMode',
  'pubPanood.reissueLiveScreenCode',
] as const;
export type PubPanoodStayDoor = (typeof PUB_PANOOD_STAY_DOORS)[number];

/** The controller's own sentence for each refusal it lands with — the page's banners and the in-place refusal read
 *  this one list, so the two can never say different things. */
export const PANOOD_REFUSAL = {
  watchUrl: 'That doesn’t look like a YouTube link — paste the watch or share URL.',
  facebookUrl:
    'That doesn’t look like a Facebook video link — open your live video on Facebook, tap Share → Copy link, and paste that.',
  film: 'That link isn’t a YouTube or Vimeo video. Those are the two we can play.',
  zoneLabel: 'Give the channel a name first.',
  zoneCap: `You’ve reached the limit of ${MAX_ROAM_ZONES} cameras for one event.`,
  zoneSave: 'Couldn’t save that channel — please try again.',
  overlay: 'Couldn’t save that overlay — please try again.',
  highlightOffAir: 'Moments are timestamps into a broadcast — go live first, then mark them.',
  highlightSave: 'Couldn’t save that moment — please try again.',
  cameraBind: 'Couldn’t make a join QR for that channel — please try again.',
  cameraReissue: 'Couldn’t make a new join QR — please try again.',
  screenCap: 'That is the most screens one event can hold.',
  screenMissing: 'That screen is no longer connected to this event. Reload to see the current list.',
  screenLocked: `${VENUE_SCREENS_LOCKED_MESSAGE} — unlock below to use them.`,
  screenSave: 'Couldn’t save that — please try again.',
} as const;

/** The refusal a controller redirect carries, in its own words — `null` when it is not a refusal. */
export function panoodRefusal(q: URLSearchParams): string | null {
  if (q.get('watch_url_error')) return PANOOD_REFUSAL.watchUrl;
  if (q.get('facebook_url_error')) return PANOOD_REFUSAL.facebookUrl;
  if (q.get('film_error')) return PANOOD_REFUSAL.film;
  const zone = q.get('zone_error');
  if (zone) return zone === 'label' ? PANOOD_REFUSAL.zoneLabel : zone === 'cap' ? PANOOD_REFUSAL.zoneCap : PANOOD_REFUSAL.zoneSave;
  if (q.get('overlay_error')) return PANOOD_REFUSAL.overlay;
  const moment = q.get('highlight_error');
  if (moment) return moment === 'offair' ? PANOOD_REFUSAL.highlightOffAir : PANOOD_REFUSAL.highlightSave;
  const camera = q.get('camera_error');
  if (camera) return camera === 'bind' ? PANOOD_REFUSAL.cameraBind : PANOOD_REFUSAL.cameraReissue;
  const screen = q.get('screen_error');
  if (screen) {
    return screen === 'cap'
      ? PANOOD_REFUSAL.screenCap
      : screen === 'missing'
        ? PANOOD_REFUSAL.screenMissing
        : screen === 'locked'
          ? PANOOD_REFUSAL.screenLocked
          : PANOOD_REFUSAL.screenSave;
  }
  return null;
}
