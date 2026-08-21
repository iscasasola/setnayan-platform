/**
 * THE CHALLENGE CATEGORIES, AND THE WORDS A COUPLE READS FOR THEM.
 *
 * Split out of `papic-challenge-pool.ts` on purpose: the pool is a 600-row
 * array, and the SCREEN only ever needs the twelve labels. Importing the pool
 * into a page to read a chip label would pull every prompt into that route's
 * bundle for no reason.
 *
 * 🔑 THE KEYS ARE DATABASE VALUES AND NEVER CHANGE. The LABELS are copy, and
 * this is the only place they live — renaming a chip is a one-line edit here,
 * not a migration. That matters because the marketplace already learned this
 * lesson the expensive way: its category labels ARE the internal words, so the
 * live site says "Look · Feast · Documentary" at customers who would never type
 * any of them.
 */

export type ChallengeCategory =
  | 'couple_family'   // with the host / the family
  | 'food_drinks'
  | 'band_dance'
  | 'decor_booth'
  | 'meet_room'       // with other guests
  | 'fashion_candids' // what you wore, what you brought
  | 'big_moments'
  | 'stories'         // the confession box — carries {who} or {host}
  | 'stories_couple'  // the confession box, about the two of them
  | 'selfie'          // just you
  | 'anywhere'        // on the spot, wherever you are standing
  | 'greeting';       // a message to camera for the host

/** What the guest's next capture has to be. Mirrors the table's CHECK. */
export type CaptureKindKey = 'photo' | 'clip' | 'pabati';

/** Mirrors the table's CHECK. `face_verified` rows are never boarded. */
export type MissionTypeKey =
  | 'prompt'
  | 'roster'
  | 'video_greeting'
  | 'toast_or_dance'
  | 'vendor_booth'
  | 'face_verified';

/**
 * The chip a couple taps. Plain English, second person, no product words —
 * "Tell a story", not "stories_couple", and not "Confession booth" either,
 * which names a fixture nobody has at home.
 */
export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  stories: 'Tell a story',
  greeting: 'A message for them',
  anywhere: 'Wherever you are',
  couple_family: 'With the host',
  meet_room: 'With other guests',
  selfie: 'Just you',
  fashion_candids: 'What you wore',
  stories_couple: 'About the two of them',
  food_drinks: 'Food & drinks',
  decor_booth: 'The room',
  band_dance: 'Dancing & music',
  big_moments: 'The big moments',
};

/**
 * Chip order — the owner's own list first (a confession box · a greeting · an
 * on-the-spot one · one with the host · one with other people · a selfie · a
 * flex of what they wore), then the rest of the library.
 * ⚠ `Object.keys(CATEGORY_LABELS)` would ALSO produce an order, and it would be
 * whatever the last editor happened to type. This one is a decision.
 */
export const CATEGORY_ORDER: ChallengeCategory[] = [
  'stories',
  'greeting',
  'anywhere',
  'couple_family',
  'meet_room',
  'selfie',
  'fashion_candids',
  'stories_couple',
  'food_drinks',
  'decor_booth',
  'band_dance',
  'big_moments',
];

/** Every category, as a Set, for validating whatever arrives in a URL. */
export const CATEGORY_KEYS = new Set<string>(CATEGORY_ORDER);

export function isChallengeCategory(v: string | undefined | null): v is ChallengeCategory {
  return typeof v === 'string' && CATEGORY_KEYS.has(v);
}
