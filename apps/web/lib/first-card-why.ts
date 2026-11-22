/**
 * 🃏 WHY THE ONBOARDING'S FIRST CARD IS NOT ON THE PAGE — carried on Today's address as a KEY, never as a sentence.
 *
 * Ship review 21 Nov (#8028): the welcome drew `?card_why=` straight from the URL (≤200 chars), so anybody could put
 * their own words on a supplier's Today. The door now writes a key from this fixed set (`firstCardWhyKey`), and the
 * welcome draws the sentence that key names (`firstCardWhySentence`) — rebuilt from the shipped sentence makers
 * (the publish gate, the live-cards cap, the shop check), so the words are the same ones those screens say. A key it
 * does not know draws nothing. A sentence the door does not recognise is filed under the state's plain fallback.
 * 🔒 lib/supplier-onboarding.test.ts
 */
import { OWNER_ONLY_SHOP_EDIT, SHOP_UNREADABLE } from './active-shop';
import { LIVE_CARDS_UNREAD, liveCardsCapMessage } from './live-cards-cap';
import { PUBLISH_REQUIREMENTS, publishRefusalFor, type PublishRequirement } from './service-publish-gate';
import { FIRST_CARD_NOT_LIVE } from './supplier-onboarding';

/** Said when the maker failed with no sentence of its own. */
export const FIRST_CARD_NOT_MADE = 'Something went wrong making it. Please try again.';
/** Made, but the read that finds it again failed — so it was not put on the page. Said as that, never as "not live". */
export const FIRST_CARD_MADE_UNREAD = 'It was made, but we couldn’t find it again just now to put it on your page. Open your cards to finish.';
const SHOP_NOT_FOUND = 'Supplier profile not found.';

/** The fixed keys and the one sentence each draws. `needs-…` and `cap-…` are built below from the shipped makers. */
const FIXED: Readonly<Record<string, string>> = {
  'not-made': FIRST_CARD_NOT_MADE,
  'not-live': FIRST_CARD_NOT_LIVE,
  'made-unread': FIRST_CARD_MADE_UNREAD,
  'cards-unread': LIVE_CARDS_UNREAD,
  'shop-unread': SHOP_UNREADABLE,
  'owner-only': OWNER_ONLY_SHOP_EDIT,
  'no-shop': SHOP_NOT_FOUND,
};

/** Every non-empty set of the publish gate's requirements, in the gate's own order: "cover", "cover+inclusions", … */
function needsSets(): PublishRequirement[][] {
  const all = [...PUBLISH_REQUIREMENTS];
  const out: PublishRequirement[][] = [];
  for (let mask = 1; mask < 1 << all.length; mask++) out.push(all.filter((_, i) => mask & (1 << i)));
  return out;
}

const CAP_MAX = 999;

/** The key for a sentence the door was handed. A sentence it does not know is the state's plain fallback. */
export function firstCardWhyKey(sentence: string | null | undefined, state: 'refused' | 'draft' | 'waiting'): string | null {
  if (state === 'waiting') return null;
  const s = (sentence ?? '').trim();
  for (const [key, text] of Object.entries(FIXED)) if (s === text) return key;
  for (const set of needsSets()) if (s === publishRefusalFor(set)) return `needs-${set.join('+')}`;
  for (let n = 0; n <= CAP_MAX; n++) if (s === liveCardsCapMessage(n)) return `cap-${n}`;
  return state === 'refused' ? 'not-made' : 'not-live';
}

/** The sentence a key draws — from code, never from the address. An unknown key draws nothing. */
export function firstCardWhySentence(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key in FIXED) return FIXED[key]!;
  const needs = /^needs-([a-z+]+)$/.exec(key);
  if (needs) {
    const parts = needs[1]!.split('+');
    const set = PUBLISH_REQUIREMENTS.filter((r) => parts.includes(r));
    if (!set.length || set.length !== parts.length) return null;
    return publishRefusalFor(set);
  }
  const cap = /^cap-(\d{1,3})$/.exec(key);
  if (cap) return liveCardsCapMessage(Number(cap[1]));
  return null;
}
