import 'server-only';
import type { PhotoDeliveryStayDoor } from '@/lib/stay-doors/photoDelivery';
import { eventScreen, NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import { plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';
import {
  disconnectPhotoDelivery,
  releasePhotoDelivery,
  setPhotoDeliverySyncModeAuto,
  setPhotoDeliverySyncModeManual,
} from '@/app/dashboard/[eventId]/studio/photo-delivery/actions';
import { kind, type Door } from './_door';

/** The page shows `?release_error=` as given (a plain sentence, never a database's words) and `?sync_mode_error=`. */
const PHOTO_DELIVERY_WORDS: StayWords = {
  within: [eventScreen('studio/photo-delivery')],
  refuse: (q) => {
    const release = q.get('release_error');
    if (release) return plainRefusal(release, NOTHING_CHANGED);
    if (q.get('sync_mode_error') === 'not_a_couple') return 'Only the couple can change how photos reach your Drive.';
    return null;
  },
};
const photoDelivery = kind(PHOTO_DELIVERY_WORDS, 'photos');

export const PHOTO_DELIVERY: Readonly<Record<PhotoDeliveryStayDoor, Door>> = {
  'photoDelivery.releasePhotoDelivery': photoDelivery(releasePhotoDelivery),
  'photoDelivery.disconnectPhotoDelivery': photoDelivery(disconnectPhotoDelivery),
  'photoDelivery.setPhotoDeliverySyncModeAuto': photoDelivery(setPhotoDeliverySyncModeAuto),
  'photoDelivery.setPhotoDeliverySyncModeManual': photoDelivery(setPhotoDeliverySyncModeManual),
};
