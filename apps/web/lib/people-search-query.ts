/**
 * people-search-query.ts — the pure half of finding somebody by name.
 *
 * Split out from `people-search.ts` for one blunt reason: that file imports
 * `server-only`, so nothing in it can be loaded by a unit test. The rule this
 * module holds is the one that has already cost this codebase real money once,
 * and it needed to be testable.
 */

/** What a search result may carry. A name, a face, a handle, and a reason. */
export type PersonHit = {
  /** `users.public_id` — the S89U-… handle. NEVER the raw user_id. */
  publicId: string;
  name: string;
  photoUrl: string | null;
  /** Their formal name ("Mr. Indalecio Sacdalan Casasola II") — only when it
   *  says something the nickname does not. Owner 2026-09-21: a result shows
   *  "all. nickname, full name and tag". */
  fullName: string | null;
  /** Their @tag — `users.slug` with its "@". */
  handle: string | null;
  /** Why you might know them. Null when there is nothing shared to say. */
  hint: string | null;
};

/**
 * 🚨 `%` and `_` are WILDCARDS in ILIKE.
 *
 * Unescaped, a typed `%` searches for EVERYBODY — the whole users table, ten
 * rows at a time — and `_` quietly matches any single character. That second
 * one is not hypothetical here: it is exactly how the admin shop-address
 * correction could move a DIFFERENT shop (2026-08-12), where `banawe_` matched
 * `banawes`. The backslash is escaped first, or it would escape the caller's
 * own closing `%`.
 */
export function escapeLikeQuery(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Below this, a query is an enumeration attempt rather than a name. */
export const MIN_QUERY_LENGTH = 2;

/** More words than this is a sentence, not a name. */
export const MAX_QUERY_TERMS = 5;

/**
 * The words a name search matches — in ANY order.
 *
 * Owner, 2026-09-21: *"Casasola Ice … this should work also"*. Filipinos write
 * surname-first as often as not, so "Casasola Ice" must find "Ice Casasola".
 * Each word is matched on its own, anywhere in the person's names — nickname,
 * full name or @tag (`users.name_search`) — and EVERY word
 * must be present — so extra words narrow the list, never widen it. Spaces and
 * commas separate words ("Casasola, Ice" is the same search), repeats collapse.
 *
 * Returns [] — no search at all — unless at least one word is MIN_QUERY_LENGTH
 * long: "a b" is two single letters, which is a crawl of the table, while an
 * initial beside a real word ("Casasola I") is a narrower search and is kept.
 *
 * The words are returned RAW — the caller still escapes each with
 * `escapeLikeQuery` before it goes anywhere near an ILIKE.
 */
export function nameSearchTerms(raw: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const part of (raw ?? '').trim().slice(0, 60).split(/[\s,]+/)) {
    // "@ice" is a search for the tag "ice" — the "@" is how it is shown, not
    // part of what is stored.
    const word = part.replace(/^@+/, '');
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue;
    seen.add(key);
    terms.push(word);
    if (terms.length === MAX_QUERY_TERMS) break;
  }
  return terms.some((t) => t.length >= MIN_QUERY_LENGTH) ? terms : [];
}

/** A result list, not a dataset. */
export const MAX_RESULTS = 10;
