/**
 * taxonomy-filters.ts — the SHARED couple-side taxonomy scoping predicates.
 *
 * One implementation imported by every couple-facing surface (`/vendors`
 * marketplace + the dashboard category search) so the two can never disagree —
 * the drift class that produced the faith vocab mess. Pure functions, no I/O;
 * unit-tested in taxonomy-filters.test.ts.
 *
 * Design: Taxonomy_Event_Faith_Scoping_Design_2026-06-10.md §2–§3.
 * Invariants (load-bearing — tests enforce):
 *   • NEVER-EMPTY both sides: a tile with NULL applicable_event_types is
 *     universal; an event with NULL event_type is treated as 'wedding'.
 *   • Faith bites ONLY for weddings (`events.ceremony_type` DEFAULTS to
 *     'catholic', so a corporate event carries a stale faith — guard on
 *     event_type, never on ceremony_type presence).
 *   • Faith is INCLUDE-only: untagged ("universal") services always pass.
 *   • Mixed/inter-faith = the UNION of both rites (additive — only ever
 *     ADMITS more, never excludes).
 *   • Civil is first-class: a civil couple sees universal + Civil-tagged
 *     services (civil officiants) and NO religious-tagged ones.
 */
import type { WeddingFaithKey } from './taxonomy';

/**
 * events.ceremony_type (lowercase enum) → faith_vocab key (title-case).
 * FILTERING semantics: civil maps to 'Civil' (a civil couple matches the
 * civil-officiant canonicals and excludes religious-tagged ones). This is
 * deliberately different from display mappers that render civil as "no faith".
 * 'mixed' is absent: a mixed wedding stores its real rites in ceremony_type +
 * secondary_ceremony_type; a literal 'mixed' contributes nothing (fail-open).
 */
export const CEREMONY_TYPE_TO_FAITH: Readonly<Record<string, WeddingFaithKey>> = {
  catholic: 'Catholic',
  christian: 'Christian',
  born_again: 'Born Again',
  inc: 'INC',
  muslim: 'Muslim',
  jewish: 'Jewish',
  chinese: 'Chinese',
  cultural: 'Cultural',
  civil: 'Civil',
};

/** Event-side never-empty guard: NULL/blank event_type = 'wedding'. */
export function resolveEventType(eventType: string | null | undefined): string {
  const t = typeof eventType === 'string' ? eventType.trim() : '';
  return t.length > 0 ? t : 'wedding';
}

/**
 * The couple's faith set for catalog filtering. Empty set = no faith
 * narrowing (anonymous visitors, non-wedding events, unmapped rites).
 * Wedding-guarded: any non-wedding event type returns the empty set even
 * though ceremony_type is populated (it defaults to 'catholic').
 * Mixed/inter-faith: union of primary + secondary rites.
 */
export function buildCoupleFaithSet(input: {
  eventType?: string | null;
  ceremonyType?: string | null;
  secondaryCeremonyType?: string | null;
}): Set<WeddingFaithKey> {
  const set = new Set<WeddingFaithKey>();
  if (resolveEventType(input.eventType) !== 'wedding') return set;
  for (const ct of [input.ceremonyType, input.secondaryCeremonyType]) {
    if (typeof ct !== 'string') continue;
    const faith = CEREMONY_TYPE_TO_FAITH[ct.trim()];
    if (faith) set.add(faith);
  }
  return set;
}

/**
 * INCLUDE-only faith predicate. Empty set = no narrowing (everything passes).
 * Untagged (faith-NULL) services ALWAYS pass — "untagged always delivered".
 * A tagged service passes only for a couple whose set contains its faith.
 */
export function passesFaithFilter(
  metaFaith: string | null | undefined,
  activeFaithSet: ReadonlySet<string>,
): boolean {
  if (activeFaithSet.size === 0) return true;
  if (!metaFaith) return true;
  return activeFaithSet.has(metaFaith);
}

/**
 * Multi-event applicability predicate (tile grain — the primary control).
 * NULL/empty applicable list = universal (FAIL-OPEN; serves every event).
 * Non-empty = exclusive allow-list checked against the resolved event type.
 */
export function passesEventTypeFilter(
  applicableEventTypes: ReadonlyArray<string> | null | undefined,
  coupleEventType: string | null | undefined,
): boolean {
  if (!applicableEventTypes || applicableEventTypes.length === 0) return true;
  return applicableEventTypes.includes(resolveEventType(coupleEventType));
}
