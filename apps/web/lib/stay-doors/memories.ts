/** Memories — the photo's own sheet (`_components/memories/memories-photo-viewer.tsx`) and Papic › Moderation, which
 *  run the same actions (`studio/papic/moderation/actions.ts`, `vendor-visibility-actions.ts`). */
export const MEMORIES_STAY_DOORS = [
  'memories.setCaptureHidden',
  'memories.setSeatPhotoHidden',
  'memories.approveScreenedCapture',
  'memories.reportCapture',
  'memories.blockUploader',
  'memories.unblockUploader',
  'memories.deletePhotoForever',
  'memories.setVendorCapturesHidden',
] as const;
export type MemoriesStayDoor = (typeof MEMORIES_STAY_DOORS)[number];
