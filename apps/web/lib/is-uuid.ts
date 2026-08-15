/**
 * is-uuid.ts — "would Postgres accept this string as a `uuid`?"
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * A URL segment is whatever a stranger typed. When one is dropped straight
 * into `.eq('<a uuid column>', segment)`, a non-UUID does NOT come back as an
 * empty result — PostgREST rejects the whole query with
 * `22P02 invalid input syntax for type uuid`, which this repo's error detector
 * then files as a production fault. `/join/zzzbad` did exactly that.
 *
 * 🔑 THE SAME FAMILY AS THE PHANTOM COLUMN, THE PHANTOM ENUM VALUE, THE
 * PHANTOM RPC ARGUMENT, THE BLOCKED IFRAME AND THE UNRESOLVED `r2://`: the
 * database DECLINES, nothing throws, and the only symptom is an absence —
 * here, an absence that reads as "no such event", which happens to be the
 * right answer, so nothing ever looked wrong. What it leaves behind is a red
 * 400 in the log a real fault has to be noticed in, mintable by anyone who can
 * type a URL.
 *
 * ─── WHY A THIRD PREDICATE IS NOT A DUPLICATE ────────────────────────────
 * Two UUID regexes already ship, and NEITHER answers this question:
 *   • `lib/upload-prefix-tenancy.ts` — deliberately STRICT (version + variant
 *     nibbles), because it is deciding which segment of an R2 KEY is a tenant
 *     id. Strictness is the point there; a false positive mis-scopes a file.
 *   • `lib/honoree-dependent-link.ts` — file-local, not exported.
 * This one is deliberately LENIENT: it must match exactly what Postgres will
 * accept, and Postgres accepts any 8-4-4-4-12 hex string regardless of version
 * or variant bits. A stricter test here would refuse an id the database is
 * perfectly happy with — trading a logged 400 for a page that wrongly says
 * "not found", which is worse.
 *
 * Pure, no imports, no `server-only` — usable from either side and unit
 * testable under `tsx --test`.
 */

/**
 * 8-4-4-4-12 hex, case-insensitive. Matches Postgres's own acceptance for the
 * canonical dashed form. Postgres additionally accepts a braced/undashed form
 * (`{...}` / 32 bare hex chars); nothing in this app ever mints one, and
 * accepting them here would let a URL shape through that no id of ours has.
 */
const PG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a string Postgres will accept as a `uuid`. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && PG_UUID_RE.test(value);
}
