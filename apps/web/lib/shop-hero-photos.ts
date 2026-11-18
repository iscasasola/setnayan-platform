/**
 * 🖼 How many photos the verified shop's hero draws (shop website v16 S2, drawing `site.src.html` `ph.slice(0,5)`): the
 * phone's slides and the desktop mosaic both show the first five; the mosaic is drawn only with a full five, never a
 * half-empty grid. A plain module so the server page and the client gallery read the SAME number.
 * 🔒 lib/the-shop-hero-follows-v16-s2.test.ts
 */
export const HERO_PHOTO_COUNT = 5;
