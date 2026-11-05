/**
 * front-page-photos.ts — where the 4 Nov 2026 marketing photos live.
 *
 * The owner's Soul 2.0 renders for the three marketing pages (DECISION_LOG 2026-11-04, "THE THREE
 * MARKETING PAGES GO TO CLOUD BUILD") sit in ONE folder, `public/marketing/2026-11-04/<key>.webp`, named
 * by the prototype's `data-p` key and already cropped to their slot. The front page, /for-suppliers and
 * /for-coordinators each copy in only the keys they draw, so the folder is shared.
 *
 * ⚠ NOT THE EVENT-TYPE PHOTOS. Those are the app's own (`public/event-types/<key>.webp`, #7271) and are
 * resolved by `eventTypePhotoSrc` — an admin upload first, else the repo render — so the front page's
 * event strip shows exactly what the create-event pickers show. One photo per type, never a second copy.
 */

/** The shared folder, as a public path. */
export const MARKETING_PHOTO_ROOT = '/marketing/2026-11-04';

/** A photo's public path from its prototype key (`hero-wedding` → `/marketing/2026-11-04/hero-wedding.webp`). */
export function marketingPhoto(key: string): string {
  return `${MARKETING_PHOTO_ROOT}/${key}.webp`;
}
