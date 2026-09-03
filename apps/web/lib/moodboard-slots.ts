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

export function isMoodboardSlotKey(value: unknown): value is MoodboardSlotKey {
  return (
    typeof value === 'string' && (MOODBOARD_SLOT_KEYS as readonly string[]).includes(value)
  );
}
