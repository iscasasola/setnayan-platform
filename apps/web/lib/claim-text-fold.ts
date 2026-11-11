/**
 * claim-text-fold.ts — READ A DISGUISED CLAIM THE WAY A COUPLE READS IT (owner 2026-11-08).
 *
 * ⚖ DECISION_LOG 2026-11-08 "NO CLAIM WORDS IN ANY SUPPLIER-WRITTEN NAME", Build 2 item (3): *"catch disguised forms
 * (N0. 1 · b e s t · emoji · #1️⃣) by normalising before matching"*, and the same day *"0001 is still number 1."*
 *
 * A couple reads "B E S T", "b.e.s.t", "B3ST" and "#1️⃣" as "BEST" and "#1". The word list (`card_claim_words`) holds
 * the plain word once; this module turns the supplier's text into the forms a reader sees, and the matcher
 * (`findClaimWords`) asks the list against each of them. It adds NO words of its own.
 *
 * PURE — no I/O, safe on the client (the live check) and the server (the save's re-check), so both read one rule.
 *
 * 🔑 WHAT IT MUST NEVER DO: turn an honest quantity into a claim. Look-alike digits are read as letters only INSIDE a
 * word that already has letters ("b3st", "0fficial"), so "100 guests" and "1 photographer" stay numbers; spaced letters
 * are joined only when THREE or more single letters stand in a row ("b e s t"), so "Photo & Video" and "A La Carte" are
 * left as written.
 */

/** Invisible marks a reader never sees: variation selectors, the keycap, zero-width joiners and spaces. */
const INVISIBLE = /[︎️⃣​-‍⁠﻿]/g;

/** Look-alike digits and symbols, read as the letter they imitate — only inside a word that has letters. */
const AS_LETTER: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '€': 'e',
  '|': 'l',
};
/** "1" reads as "i" as often as "l" ("certif1ed" · "officia1"): the second reading. */
const ONE_AS_I: Record<string, string> = { ...AS_LETTER, '1': 'i', '|': 'i' };

const LETTER = /\p{L}/u;

/** NFKC (full-width "ＢＥＳＴ" → "BEST", "№" → "No"), accents stripped, invisible marks dropped, lower case. */
export function baseFold(s: string): string {
  return s
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** "b e s t" · "b.e.s.t" · "B-E-S-T" · "b_e_s_t" → "best". Three or more single letters in a row, never two. */
export function joinSpacedLetters(s: string): string {
  return s.replace(/(?<![\p{L}\p{N}])\p{L}(?:[\s.\-_*·•]+\p{L}(?![\p{L}\p{N}])){2,}/gu, (run) => run.replace(/[^\p{L}]/gu, ''));
}

function mapLookAlikes(s: string, table: Record<string, string>): string {
  // A "word" here = a run of letters, digits and the look-alike symbols. Only a run that ALSO has a letter is mapped.
  return s.replace(/[\p{L}\p{N}@$€|]+/gu, (word) => {
    if (!LETTER.test(word)) return word;
    if (!/[0-9@$€|]/.test(word)) return word;
    return Array.from(word, (ch) => table[ch] ?? ch).join('');
  });
}

/**
 * Every reading of `s` a claim could hide behind, the original first, duplicates removed. The matcher asks the word
 * list against each: a hit in ANY reading is a hit.
 */
export function claimReadings(s: string): string[] {
  const base = baseFold(s);
  const joined = joinSpacedLetters(base);
  const out = [s, base, joined, mapLookAlikes(joined, AS_LETTER), mapLookAlikes(joined, ONE_AS_I)];
  return Array.from(new Set(out));
}
