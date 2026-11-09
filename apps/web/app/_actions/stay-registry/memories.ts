import 'server-only';
import type { MemoriesStayDoor } from '@/lib/stay-doors/memories';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { memoriesNotice } from '@/lib/memories-notice';
import {
  approveScreenedCapture,
  blockUploader,
  deletePhotoForever,
  reportCapture,
  setCaptureHidden,
  setSeatPhotoHidden,
  unblockUploader,
} from '@/app/dashboard/[eventId]/studio/papic/moderation/actions';
import { setVendorCapturesHidden } from '@/app/dashboard/[eventId]/studio/papic/vendor-visibility-actions';
import { kind, onEvent, type Door } from './_door';

/**
 * The photo's sheet on Memories and Papic › Moderation. A refusal is said in Memories' own words (`memoriesNotice`'s
 * `bad` tone). A couple-only gate bounces to `/dashboard/<ev>` (Home) — outside `within`, so it navigates, never
 * "saved". `setVendorCapturesHidden` lands on Memories or Event Details (`back=memories|details`).
 */
const MEMORIES_WORDS: StayWords = {
  within: [eventScreen('memories'), eventScreen('studio/papic/moderation'), eventScreen('details')],
  refuse: (q) => {
    const n = memoriesNotice(Object.fromEntries(q));
    return n && n.tone === 'bad' ? n.text : null;
  },
};
const memories = kind(MEMORIES_WORDS, 'photos');

export const MEMORIES: Readonly<Record<MemoriesStayDoor, Door>> = {
  'memories.setCaptureHidden': memories(onEvent(setCaptureHidden)),
  'memories.setSeatPhotoHidden': memories(onEvent(setSeatPhotoHidden)),
  'memories.approveScreenedCapture': memories(onEvent(approveScreenedCapture)),
  'memories.reportCapture': memories(onEvent(reportCapture)),
  'memories.blockUploader': memories(onEvent(blockUploader)),
  'memories.unblockUploader': memories(onEvent(unblockUploader)),
  'memories.deletePhotoForever': memories(onEvent(deletePhotoForever)),
  'memories.setVendorCapturesHidden': memories(setVendorCapturesHidden),
};
