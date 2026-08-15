/**
 * event-type-search.ts — "the word they typed names a KIND of celebration."
 *
 * Owner, 2026-08-15, looking at the browse page: *"they can also search by type
 * of event."*
 *
 * 🔴 WHAT WAS ACTUALLY MISSING — the sixth gate with no handle.
 * The marketplace has had a complete, admin-driven event-type filter since
 * Iteration 0041: `?event_type=<key>` is parsed, validated against the live
 * `event_type_vocab`, applied as `event_types @> [key]` on vendor_profiles,
 * mirrored in the broadened-count fallback, preserved through every form, and
 * backed by a "tell me when this opens" signup for empty kinds. All of it
 * shipped and all of it worked.
 *
 * **Nothing anywhere let a person SET it.** Grep `name="event_type"` across the
 * public app and every hit is either a hidden input PRESERVING a value that was
 * already there, or the notify-me form. The only two ways the parameter was
 * ever non-null were (a) auto-applied from a signed-in couple's own primary
 * event and (b) typed into the address bar by hand. An anonymous visitor — the
 * person standing on the browse page — could not reach it at all.
 *
 * 🔑 So this module is NOT a new search index. It is the missing half of a
 * filter that already ships: the part that turns a word a person typed into the
 * key that filter already understands.
 *
 * ⚖ WHY THE VOCABULARY IS PASSED IN, NEVER IMPORTED.
 * `event_type_vocab` is admin-managed and grows with zero deploys (16 kinds
 * today, 9 before the 2026-06-13 cutover). A hardcoded list here would be a
 * SECOND vocabulary, and a second vocabulary drifting from the admin-managed
 * one is the exact disease `editorial-event-types.ts` was written to cure — a
 * newly launched kind of celebration would be silently unsearchable while the
 * admin screen showed it live. Callers pass `getEventTypeVocab()` rows; this
 * module owns the MATCHING RULE and nothing else.
 *
 * ⚖ WHY THE MATCH IS THE SAME SHAPE AS THE SERVICE MATCH.
 * `resolveServiceKeysForToken` in the marketplace page scores a token against
 * the 192-item service taxonomy by label-substring OR key-substring. One typed
 * word must not mean two different things depending on which axis catches it,
 * so this uses the same rule rather than a cleverer one. The one deliberate
 * divergence is the length floor — see MIN_TOKEN_LENGTH.
 *
 * 🔒 WHICH DIRECTION A MISTAKE FAILS IN. The caller ORs this into a token's
 * existing group (name / tagline / city / service), so a wrong hit can only ADD
 * suppliers who serve that kind of celebration — it can never hide one. That is
 * why a loose substring rule is safe here and would not be safe on a narrowing
 * filter.
 */

/** The two fields of an event-type row this module needs. */
export type EventTypeSearchOption = {
  /** `event_type_vocab.event_type` — written verbatim into `?event_type=`. */
  key: string;
  /** Couple-facing label, e.g. `Gender Reveal`. */
  label: string;
};

/**
 * Three characters, not the two the service axis uses.
 *
 * A two-letter fragment that happens to sit inside the name of a whole CATEGORY
 * of celebration is always an accident — `at` is inside `date`, `an` is inside
 * `anniversary` — and unlike a supplier's name there is no long tail of other
 * rows to disambiguate it, so the fragment would quietly widen a great many
 * searches. Services keep their floor of two because a two-letter service
 * fragment lands inside a 192-item list where it stays rare.
 */
export const MIN_TOKEN_LENGTH = 3;

/**
 * Normalise a vocab key for comparison against a search token.
 *
 * Tokens reaching the marketplace matcher are stripped to `[a-z0-9]`, so
 * somebody typing "gender reveal" produces `gender` + `reveal` and somebody
 * typing "genderreveal" produces one run-together token. Dropping the
 * underscore lets both find `gender_reveal`; without this, only the first ever
 * matched and the run-together spelling silently found nothing.
 */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Which event-type keys does this single search token name?
 *
 * @param token  One already-lowercased, already-stripped search token.
 * @param options  The live vocabulary — pass `getEventTypeVocab()` rows.
 * @returns  Matching `event_type` keys, in the vocabulary's own order. Empty
 *   when the token is too short or names no kind of celebration.
 */
export function resolveEventTypeKeysForToken(
  token: string,
  options: ReadonlyArray<EventTypeSearchOption>,
): string[] {
  if (token.length < MIN_TOKEN_LENGTH) return [];
  const keys: string[] = [];
  for (const opt of options) {
    if (
      opt.label.toLowerCase().includes(token) ||
      normaliseKey(opt.key).includes(token)
    ) {
      keys.push(opt.key);
    }
  }
  return keys;
}
