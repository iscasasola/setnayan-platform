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

/** A result list, not a dataset. */
export const MAX_RESULTS = 10;
