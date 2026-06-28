/**
 * Chinese (Tsinoy) wedding — the shared overlay predicate.
 *
 * Owner-locked 2026-06-28 OVERLAY model (see
 * `02_Specifications/Chinese_Wedding_Traditions_Reference_2026-06-28.md` §0):
 * a Chinese wedding is a *tradition layer* on a primary church/civil rite, NOT
 * a mutually-exclusive faith. In data terms that means a couple expresses it
 * EITHER as `events.ceremony_type='chinese'` (Chinese as the primary rite —
 * e.g. a Taoist/Buddhist temple ceremony) OR, much more commonly for Tsinoy
 * couples, as a primary church/civil rite PLUS `secondary_ceremony_type='chinese'`
 * (the mixed/overlay axis from iteration 0043).
 *
 * Every Chinese-aware surface (date advisory, seating no-table-4, the
 * tea-ceremony helper, vendor routing, the BaZi birth-data capture) MUST derive
 * the flag from THIS predicate — never an inline `ceremony_type === 'chinese'`
 * check, which silently under-delivers to the majority real-world case (church
 * primary + Chinese secondary) and is exactly the kind of drift that hid the
 * Chinese traditions guide on /paperwork before PR #2312.
 *
 * Mirrors the matching layer: `buildCoupleFaithSet` in lib/taxonomy-filters.ts
 * already unions primary + secondary into the faith set, so a Chinese-secondary
 * couple already sees Chinese-tagged vendors. This helper is the UI-side twin of
 * that union so couple surfaces stay consistent with vendor routing.
 */

/** The canonical Chinese ceremony key — lowercase, matches the events CHECK. */
export const CHINESE_CEREMONY_KEY = 'chinese' as const;

/** The canonical Muslim ceremony key — lowercase, matches the events CHECK. */
export const MUSLIM_CEREMONY_KEY = 'muslim' as const;

/** Minimal shape every caller can satisfy from an `events` row select. */
export type CeremonyOverlayInput = {
  ceremony_type?: string | null;
  secondary_ceremony_type?: string | null;
};

/**
 * Generic two-column ceremony predicate: true when `faithKey` is the event's
 * primary rite OR its secondary/overlay rite. This is the single primitive every
 * overlay-aware faith check derives from, so an inline `ceremony_type === 'x'`
 * never silently under-delivers to the common church-primary + secondary-overlay
 * case (the drift that hid Chinese traditions before PR #2312).
 *
 * Use this — or one of the named wrappers below — instead of hand-rolling the
 * two-column OR at the call site. NOTE: it deliberately matches an OVERLAY on
 * EITHER axis; surfaces that need "X is specifically the PRIMARY rite" semantics
 * (e.g. the sponsors-page muslim-primary redirect) must NOT use this — they have
 * a different, primary-only contract.
 */
export function ceremonyMatches(
  event: CeremonyOverlayInput | null | undefined,
  faithKey: string,
): boolean {
  if (!event) return false;
  return event.ceremony_type === faithKey || event.secondary_ceremony_type === faithKey;
}

/**
 * True when Chinese tradition applies to the event — as the primary rite OR as
 * the secondary/overlay rite. This is the single connective spine for the
 * Chinese feature set.
 */
export function isChineseWedding(event: CeremonyOverlayInput | null | undefined): boolean {
  return ceremonyMatches(event, CHINESE_CEREMONY_KEY);
}

/**
 * True when Muslim (Nikah) tradition applies to the event — as the primary rite
 * OR as the secondary/overlay rite. The overlay twin of the inline two-column
 * `=== 'muslim'` checks that powered the Mahr budget card and the Nikah-
 * essentials card; deriving them from this predicate keeps every Muslim-aware
 * surface in lock-step with the primary-or-secondary model.
 */
export function isMuslimWedding(event: CeremonyOverlayInput | null | undefined): boolean {
  return ceremonyMatches(event, MUSLIM_CEREMONY_KEY);
}

/**
 * True when Chinese is specifically the *secondary* (overlay) rite on top of a
 * different primary — the common Tsinoy "church wedding + tea ceremony" case.
 * Useful where copy should say "alongside your {primary} ceremony".
 */
export function isChineseOverlay(event: CeremonyOverlayInput | null | undefined): boolean {
  if (!event) return false;
  return (
    event.secondary_ceremony_type === CHINESE_CEREMONY_KEY &&
    event.ceremony_type !== CHINESE_CEREMONY_KEY
  );
}
