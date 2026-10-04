/**
 * brand-words.ts — OUR PRODUCT NAMES ARE SPELLED OUR WAY, WHOEVER TYPED THEM.
 *
 * ⚖ Owner, live iPhone review 2026-10-04, on a notification an admin had typed
 * by hand: *"papic"* in a message must read **Papic**. A notification's body
 * is often a person's own words (the admin's note on a removal request is
 * sent as-is), so the fix belongs where the words are SHOWN, not in every
 * place a person can type.
 *
 * Only a whole word is touched: `papic` inside an address (`/papic`,
 * `papic.setnayan.com`, `papic-seat`) or a longer word is left alone, so a link
 * in a message still works.
 */
const BRAND_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\w/.@-])papic(?![\w/@-]|\.\w)/gi, 'Papic'],
];

export function brandWords(text: string): string {
  let out = text;
  for (const [re, word] of BRAND_WORDS) out = out.replace(re, word);
  return out;
}
