/**
 * brand-words.ts — OUR PRODUCT NAMES ARE SPELLED OUR WAY, WHOEVER TYPED THEM.
 *
 * ⚖ Owner, live iPhone review 2026-10-04, on a notification an admin had typed
 * by hand: *"papic"* in a message must read **Papic**. A notification's body
 * is often a person's own words (the admin's note on a removal request is
 * sent as-is), so the fix belongs where the words are SHOWN, not in every
 * place a person can type.
 *
 * Only a whole WORD is touched. A token that looks like an address — it holds
 * any of `? = # & @ /` or `://` — is left exactly as typed, so a link in a
 * message still works (`https://x.com/?ref=papic#papic` stays byte-for-byte);
 * so is `papic` inside a longer word or a dotted host (`papic.setnayan.com`).
 *
 * ⚠ Words only — never names. A caller passes the message words the system or
 * the team wrote; a guest's, a person's or an event's NAME is never passed in
 * (`notifications-list.tsx` keeps the title, which carries names, out of it).
 */
const BRAND_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\w.-])papic(?![\w-]|\.\w)/gi, 'Papic'],
];

/** A token that is, or holds, an address. */
const URLISH = /[?=#&@/]|:\/\//;

export function brandWords(text: string): string {
  // Split keeping the whitespace, so the text round-trips exactly.
  return text
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok || /^\s+$/.test(tok) || URLISH.test(tok)) return tok;
      let out = tok;
      for (const [re, word] of BRAND_WORDS) out = out.replace(re, word);
      return out;
    })
    .join('');
}
