/**
 * `applicable_event_types` NULL SEMANTICS — one place, because the corpus and
 * the code disagreed until 2026-07-21.
 *
 * `canonical_service_taxonomy.applicable_event_types` (and the tile-level
 * `service_categories.applicable_event_types` it inherits from) is an
 * ALLOW-LIST. The claim written into migration
 * `20270830256997_taxonomy_ceremony_reception_venue_leaves.sql` — "NULL =
 * universal = fail-open" — is TRUE of every WRITE path and every VENDOR path,
 * and FALSE of exactly one consumer:
 *
 *   FAIL-OPEN (NULL ⇒ serves every event type)
 *     • app/vendor-dashboard/services/_components/coverage-panel.tsx — a leaf
 *       with no scope offers the vendor the full event-type checkbox set.
 *     • app/vendor-dashboard/services/coverage-actions.ts (parseEventTypes) —
 *       a NULL allow-set accepts any active vocab key the vendor submits.
 *     • app/admin/event-types/actions.ts + app/admin/taxonomy/actions.ts —
 *       "NULL/empty = universal", stated in terms and used to compute the
 *       next array when an admin toggles a type on or off.
 *
 *   FAIL-CLOSED (NULL ⇒ wedding only)
 *     • lib/leaf-suggestions-core.ts — the "what else might you need?" ranker.
 *
 * The inversion is DELIBERATE and stays. The taxonomy is wedding-first and
 * `applicable_event_types` is seeded on only 14 of 244 canonicals, so treating
 * NULL as universal in a RECOMMENDER would push a wedding coordinator at a
 * birthday. But the two rules must never again be assumed identical, because
 * the difference is not "strict vs lenient" — it flips per surface:
 *
 *   • Offering something (vendor coverage, admin scope) → fail-open. Being
 *     wrong costs a vendor an option they can simply not tick.
 *   • Volunteering something unasked (suggestions) → fail-closed. Being wrong
 *     puts a nonsense card in a couple's face.
 *
 * Owner decision 3 ("allocate services on what event they cover") would write
 * these arrays for real. When it lands, the fail-closed branch below becomes a
 * no-op — every leaf will be tagged — and this module is where to prove it.
 *
 * Pure functions, no imports: safe for `node:test`, server and client.
 */

/**
 * The CANONICAL rule (fail-open). TRUE when a leaf scoped by `allowed` serves
 * `eventType`. NULL / empty `allowed` = universal. NULL `eventType` = unknown
 * context, cannot filter, passes.
 */
export function leafServesEventType(
  allowed: readonly string[] | null | undefined,
  eventType: string | null | undefined,
): boolean {
  if (eventType == null) return true;
  if (allowed == null || allowed.length === 0) return true;
  return allowed.includes(eventType);
}

/**
 * The SUGGESTION rule (fail-closed on NULL). Same as `leafServesEventType`
 * except an untagged leaf is treated as wedding-only. Used ONLY by the leaf
 * suggestion ranker — see the module doc for why this one inverts.
 */
export function leafIsSuggestableForEventType(
  allowed: readonly string[] | null | undefined,
  eventType: string | null | undefined,
): boolean {
  if (eventType == null) return true;
  if (allowed == null || allowed.length === 0) return eventType === 'wedding';
  return allowed.includes(eventType);
}
