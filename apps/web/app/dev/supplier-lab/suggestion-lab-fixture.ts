/**
 * 🧪 THE SUGGESTION LAB'S FIXTURES (DEV-ONLY) — `/dev/supplier-lab?s=suggest` (the florist's side) and
 * `/dev/details-lab?look=1&studio=1&suggest=1` (the couple's side), drawn like the prototype
 * `supplier_inspiration_suggestions_2026-10-19.html`: bouquets and centrepieces painted in the board's own colours, so a
 * thumb reads as a picture with no file behind it. A made-up couple and a made-up shop — no real event, no real
 * supplier, no database.
 */

const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${body}</svg>`)}`;
const flower = (bg: string, a: string, b: string, c: string) =>
  svg(
    `<rect width="36" height="36" fill="${bg}"/><circle cx="13" cy="14" r="6" fill="${a}"/><circle cx="22" cy="12" r="5.5" fill="${b}"/><circle cx="18" cy="20" r="6" fill="${c}"/><circle cx="10" cy="22" r="4" fill="${b}"/><circle cx="26" cy="20" r="4" fill="${a}"/><path d="M18 26v10" stroke="#5f7a4a" stroke-width="2"/><path d="M14 36c1-5 3-8 4-9M22 36c-1-5-3-8-4-9" stroke="#5f7a4a" stroke-width="1.5" fill="none"/>`,
  );

export const LAB_SUGGEST_PHOTO = {
  bq1: flower('#efe9ea', '#5B4A6B', '#D9C4CF', '#F7F2EC'),
  bq2: flower('#f3eee6', '#D9C4CF', '#F7F2EC', '#7A8B6F'),
  /** The florist's — blush and plum. */
  bqS: flower('#e9e2ea', '#6b5a7e', '#efd9e2', '#ffffff'),
  cp1: svg(`<rect width="36" height="36" fill="#f1ece4"/><rect x="4" y="24" width="28" height="8" fill="#D9C4CF"/><circle cx="12" cy="18" r="5" fill="#5B4A6B"/><circle cx="20" cy="15" r="5.5" fill="#F7F2EC" stroke="#d9c4cf"/><circle cx="26" cy="19" r="4" fill="#7A8B6F"/>`),
  cp2: svg(`<rect width="36" height="36" fill="#e9e6df"/><rect x="15" y="16" width="6" height="16" fill="#A9834B"/><circle cx="18" cy="12" r="8" fill="#5B4A6B"/><circle cx="12" cy="14" r="4" fill="#D9C4CF"/><circle cx="24" cy="14" r="4" fill="#F7F2EC"/>`),
  cp3: svg(`<rect width="36" height="36" fill="#f5f1ea"/><ellipse cx="18" cy="27" rx="14" ry="4" fill="#A9834B"/><circle cx="10" cy="18" r="5" fill="#7A8B6F"/><circle cx="18" cy="15" r="6" fill="#D9C4CF"/><circle cx="27" cy="18" r="5" fill="#5B4A6B"/>`),
  cpS: svg(`<rect width="36" height="36" fill="#ece6e0"/><rect x="8" y="26" width="20" height="6" fill="#c9b79a"/><circle cx="13" cy="17" r="6" fill="#efd9e2"/><circle cx="22" cy="14" r="6" fill="#6b5a7e"/><circle cx="19" cy="22" r="4" fill="#ffffff"/>`),
} as const;

/** The lab couple and shop (made up). */
export const LAB_SUGGEST_COUPLE = 'Maria & Jose';
export const LAB_SUGGEST_SHOP = 'Bloom & Co.';

/** The prototype's five (Dusty Plum · Silver · Toffee · Cream · Sage). */
export const LAB_SUGGEST_FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

/** The swatches a kept photo writes (its own six sampled colours). */
export const LAB_SUGGEST_SWATCHES = {
  bqS: ['#6B5A7E', '#EFD9E2', '#FFFFFF', '#5F7A4A', '#E9E2EA', '#6B5A7E'],
  cpS: ['#6B5A7E', '#EFD9E2', '#C9B79A', '#FFFFFF', '#ECE6E0', '#6B5A7E'],
  own: ['#5B4A6B', '#D9C4CF', '#F7F2EC', '#7A8B6F', '#EFE9EA', '#5B4A6B'],
};

/** The lab shop's own photos for "Choose from your shop's photos" — the repo's own sample pictures (as the library lab's). */
export const LAB_SUGGEST_SHOP_PHOTOS: ReadonlyArray<{ ref: string; url: string }> = [
  { ref: '/realstories/jack-jill-g1.jpg', url: '/realstories/jack-jill-g1.jpg' },
  { ref: '/realstories/john-jane-g2.jpg', url: '/realstories/john-jane-g2.jpg' },
  { ref: '/realstories/maria-juan-g1.jpg', url: '/realstories/maria-juan-g1.jpg' },
  { ref: '/realstories/sofia-reyes-c2.jpg', url: '/realstories/sofia-reyes-c2.jpg' },
];
