/**
 * The inspiration-slot vocabulary — `event_inspiration_assets.slot_key`.
 *
 * EXTRACTED from `app/dashboard/[eventId]/wizard-actions.ts` (MB2, 2026-09-03)
 * with no change to its contents. It moved for one reason: `wizard-actions.ts`
 * is a `'use server'` module, and the render-part registry
 * (`lib/moodboard-render-parts.ts`) has to DERIVE the place parts from this
 * list rather than restate them. A second hand-kept copy of these keys is
 * exactly the staleness the registry exists to prevent — the moment somebody
 * adds a slot, one copy would grow it and the other would not, and the failure
 * would be silent (a part the couple designed, with no way to render it).
 *
 * wizard-actions.ts now imports from here, so there is still one list.
 *
 * ⚠ THE DATABASE HOLDS THE SAME ALLOWLIST as a CHECK constraint
 * (`event_inspiration_assets_slot_key_check`, last widened by
 * `20271198640000_moodboard_inspiration_slot_cake.sql`). That pair predates
 * this file and is NOT collapsed here — a CHECK cannot read TypeScript. They
 * agree today; widen both together, and the DB is the one that fails loudly.
 */

/**
 * 18 named slots. Grouped in the UI as Location feel (11) · Palette (1) ·
 * Dress codes (6) — see `_components/inspiration-board.tsx`.
 *
 * ⚠ `venue` is NOT renamed to `ceremony_venue`. Real rows carry that key from
 * onboarding Card 15 (migration 20260627000000) and a rename orphans every one.
 */
export const MOODBOARD_SLOT_KEYS = [
  'venue',
  'reception_venue',
  'backdrop',
  'tunnel',
  'stage',
  'table',
  'ceiling',
  'flowers',
  'cocktail',
  'cake',
  'overall',
  'palette',
  'groom',
  'bride',
  'principal_sponsor',
  'entourage',
  'parents',
  'guests',
] as const;

export type MoodboardSlotKey = (typeof MOODBOARD_SLOT_KEYS)[number];

/**
 * The inspiration slot that belongs to each reception-design part — the bridge
 * that lets the couple see the photo they uploaded beside the zone they are
 * dressing.
 *
 * ⚠ FIVE OF TEN PARTS, NOT ALL OF THEM. The two vocabularies were written for
 * different jobs and only partly overlap: `walls`, `photo_wall`,
 * `welcome_signage`, `entrance` and `people` have no inspiration slot, and
 * `venue`, `reception_venue`, `flowers`, `cocktail`, `cake`, `overall`,
 * `palette` and the six attire slots have no design part. An absent entry is
 * the honest answer for those — the alternative is guessing a couple's cake
 * photo describes their ceiling.
 *
 * ⚠ `table` IS SINGULAR AND THE PART IS PLURAL. That mismatch is the entire
 * reason this map is explicit rather than `slot === part`. Renaming either side
 * to make them match would orphan live rows (`MOODBOARD_SLOT_KEYS` above says
 * why `venue` was never renamed) — so the bridge absorbs it instead.
 */
export const INSPIRATION_SLOT_FOR_PART: Readonly<Record<string, MoodboardSlotKey>> = {
  ceiling: 'ceiling',
  backdrop: 'backdrop',
  stage: 'stage',
  tunnel: 'tunnel',
  tables: 'table',
};

/** The inspiration slot for a design part, or null when the part has none. */
export function inspirationSlotForPart(partId: string): MoodboardSlotKey | null {
  return INSPIRATION_SLOT_FOR_PART[partId] ?? null;
}

export function isMoodboardSlotKey(value: unknown): value is MoodboardSlotKey {
  return (
    typeof value === 'string' && (MOODBOARD_SLOT_KEYS as readonly string[]).includes(value)
  );
}
