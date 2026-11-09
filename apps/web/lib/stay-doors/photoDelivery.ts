/** Photo delivery — the Drive panel's Release · Disconnect and the page's sync-mode switch (`studio/photo-delivery`). */
export const PHOTO_DELIVERY_STAY_DOORS = [
  'photoDelivery.releasePhotoDelivery',
  'photoDelivery.disconnectPhotoDelivery',
  'photoDelivery.setPhotoDeliverySyncModeAuto',
  'photoDelivery.setPhotoDeliverySyncModeManual',
] as const;
export type PhotoDeliveryStayDoor = (typeof PHOTO_DELIVERY_STAY_DOORS)[number];
