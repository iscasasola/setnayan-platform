// ============================================================================
// A column of their own — pure, client-safe module
// ============================================================================
//
// The story page ships thirteen sections. A couple can already HIDE any of them
// and REORDER eleven — what they cannot do is write one of their own. "The
// Groom's Dog, A Retrospective" is not a section we will ever ship, and it is
// exactly the kind of thing a story should have room for.
//
// A custom column is a title, a body, and a place in the run. It is stored in
// `draft_json.customColumns` alongside the existing `sections` / `sectionOrder`
// keys, and takes part in ordering through a namespaced key: `custom:<id>`.
//
// 🔑 WHY A NAMESPACED KEY RATHER THAN A NEW LIST.
// `resolveSectionOrder` already drops every key it does not recognise, which is
// what keeps a stale or hand-edited draft from rendering an empty block. A
// second, parallel ordering list for custom columns would mean two answers to
// "what order does this page render in", and the two would drift. One list, one
// answer; the namespace is what lets the resolver tell a shipped section from a
// couple's own without widening what it will accept.
//
// Pure + total. No network, no `server-only`, safe on the client and the render
// path — same contract as editorial-order.ts, which is why it lives beside it.
// ============================================================================

/** How many columns one couple may write. */
export const MAX_CUSTOM_COLUMNS = 6;
/** Title and body ceilings. A column is a column, not a second website. */
export const CUSTOM_COLUMN_TITLE_MAX = 80;
export const CUSTOM_COLUMN_BODY_MAX = 4000;

/** The `custom:` namespace, so an order key can never collide with a shipped one. */
export const CUSTOM_COLUMN_KEY_PREFIX = 'custom:';

export type CustomColumn = {
  /** Stable within one event. Lowercase alphanumerics only — it goes in an order key. */
  id: string;
  title: string;
  body: string;
};

/** The order key for a column. */
export function customColumnKey(id: string): string {
  return `${CUSTOM_COLUMN_KEY_PREFIX}${id}`;
}

/** The id inside an order key, or null when the key is not a custom one. */
export function customColumnId(key: string): string | null {
  if (!key.startsWith(CUSTOM_COLUMN_KEY_PREFIX)) return null;
  const id = key.slice(CUSTOM_COLUMN_KEY_PREFIX.length);
  return isLegalId(id) ? id : null;
}

/**
 * An id must be plain: it is concatenated into an order key and compared as a
 * string. Anything with a colon in it could forge a second namespace; anything
 * empty would produce the bare prefix, which matches every key.
 */
function isLegalId(id: string): boolean {
  return /^[a-z0-9]{4,24}$/.test(id);
}

/**
 * Read `draft_json.customColumns` into a validated list.
 *
 * 🔒 EVERY FIELD IS RE-VALIDATED HERE, NOT TRUSTED FROM THE JSON. `draft_json`
 * is a JSONB column: it holds whatever was last written to it, by whatever
 * version of the app, and PostgREST will hand a couple's browser the ability to
 * write it directly. A title read straight out of it lands in a heading.
 *
 * Anything malformed is DROPPED rather than repaired — a column with no title is
 * a blank heading on somebody's wedding page, and a silently truncated one is a
 * sentence we cut in half without telling them. The editor enforces the same
 * limits with a visible counter, so a drop here means the JSON was not written
 * by the editor.
 */
export function readCustomColumns(draftJson: unknown): CustomColumn[] {
  const raw = (draftJson as { customColumns?: unknown } | null)?.customColumns;
  if (!Array.isArray(raw)) return [];
  const out: CustomColumn[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, title, body } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !isLegalId(id) || seen.has(id)) continue;
    if (typeof title !== 'string' || typeof body !== 'string') continue;
    const t = title.trim();
    // A column with no title is a blank heading; with no body it is a heading
    // over nothing. Either way there is nothing to show, so it is not a column.
    if (!t || t.length > CUSTOM_COLUMN_TITLE_MAX) continue;
    if (!body.trim() || body.length > CUSTOM_COLUMN_BODY_MAX) continue;
    seen.add(id);
    out.push({ id, title: t, body });
    if (out.length >= MAX_CUSTOM_COLUMNS) break;
  }
  return out;
}

/**
 * The order to PERSIST for a save, given what the couple arranged and which
 * columns exist.
 *
 * 🔑 IT LIVES HERE, NOT IN THE SERVER ACTION, SO IT CAN BE TESTED. A `'use
 * server'` module may only export async functions, so a sanitizer defined there
 * is unreachable from a unit test — and the branch below is the one that can
 * silently throw away everything a couple arranged.
 *
 * `null` means "store nothing": the arrangement is the canonical default, and an
 * editorial that has never been rearranged should not carry a copy of the
 * default order forever.
 *
 * ⚠ A COUPLE WITH A COLUMN IS NEVER DEFAULT, and it falls out of the arithmetic
 * rather than needing a guard. Their column's position exists in exactly one
 * place — this list — so returning `null` would delete the only record of where
 * their own writing goes. An explicit `if the order carries a column, keep it`
 * WAS written here and then removed: a `custom:` key can never equal a canonical
 * one, so `isDefault` is already unreachable while a column is present. The
 * mutation run proved it — deleting that line changed no test result, which is
 * the signature of a guard that cannot fire. The test below asserts the
 * OUTCOME (their arrangement survives) instead of the dead branch.
 */
export function sectionOrderToPersist(
  input: readonly unknown[] | null,
  canonical: readonly string[],
  customIds: readonly string[],
): string[] | null {
  if (!Array.isArray(input)) return null;
  const known = new Set<string>(canonical);
  const customKeys = new Set<string>(customIds.map(customColumnKey));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string' || seen.has(raw)) continue;
    // A custom key is admitted only when its column is being saved alongside it.
    if (!known.has(raw) && !customKeys.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  if (out.length === 0) return null;
  const full = [...out, ...canonical.filter((k) => !seen.has(k))];
  const isDefault = full.every((k, i) => k === canonical[i]);
  return isDefault ? null : out;
}
