/**
 * ⚠ THE UNVERIFIED SHOP'S MARKINGS — the words (v16 S6; owner 15 Nov, DECISION_LOG "AN UNVERIFIED SHOP HAS THE SAME
 * WEBSITE AS A VERIFIED ONE": the verified layout, "limited and has a lot of markings that this shop is not yet verified
 * by Setnayan" — the photo stamp, the band under the name, every photo and service card, the side card, the dock line
 * and the footer, "each opening one explain sheet"). Verbatim from the approved drawing
 * (`prototypes/shop_website_two_looks_2026-11-15/site.src.html`: `NV_TAG`, `nvExplain`, `.nvnote`, `.nvl`, `.nvd`,
 * `.nvp`, the About's "What Verified adds", the photos' sub-line). Pure words, no React.
 * 🔒 lib/the-unverified-shop-follows-v16-s6.test.ts
 */

/** The tag every marking wears (`NV_TAG`). */
export const NOT_YET_VERIFIED_TAG = 'Not yet verified';

/** The short stamp on a service card and a photo (`.nvp`). */
export const NOT_VERIFIED_STAMP = 'Not verified';

/** The ONE explain sheet every marking opens (`nvExplain`). */
export const NOT_YET_VERIFIED_EXPLAIN = {
  title: 'Not yet verified',
  lead: 'This shop signed up on Setnayan, but Setnayan has not checked it yet.',
  points: [
    { head: 'What Setnayan checks', body: 'The owner, three business papers, and their work.' },
    {
      head: 'You can still book',
      body: 'Inquire, add them to your event and book through Setnayan. Your messages and payments stay in your Setnayan account.',
    },
    { head: 'Until then', body: 'No reviews or rating are shown, and you cannot check a date against their calendar.' },
    { head: 'Once verified', body: 'The blue Verified check appears beside the name.' },
  ],
} as const;

/** Under the services (`.nvnote`). */
export const NOT_YET_VERIFIED_SERVICES_NOTE = 'Services and prices are set by the shop. Setnayan has not checked this shop’s papers yet.';

/** The photos' sub-line tail (`… photos posted by the shop · not checked by Setnayan`). */
export const NOT_YET_VERIFIED_PHOTOS_NOTE = 'Posted by the shop · not checked by Setnayan';

/** The side card's list (`.nvl`) — the dock line (`.nvd`) is its first item. */
export const NOT_YET_VERIFIED_SIDE_LIST = [
  'Papers not checked by Setnayan',
  'No reviews shown until verified',
  'Book and pay through Setnayan',
] as const;

/** The About's "What Verified adds" (`.cando.nvopen`). */
export const WHAT_VERIFIED_ADDS = {
  title: 'What Verified adds',
  points: [
    { head: 'The blue Verified check', body: 'the owner, the three business papers and the work, checked by Setnayan.' },
    { head: 'Check a date', body: 'against their real calendar.' },
    { head: 'Reviews and a rating', body: 'collected now, shown once verified.' },
  ],
} as const;

/** The Reviews section of a shop Setnayan has not checked yet (`#reviews .empty`). */
export const REVIEWS_HELD = {
  title: 'Shown once Setnayan verifies this shop',
  body: 'Reviews from couples are collected now and appear, with a rating, after verification.',
} as const;
