/**
 * lib/reception-suggestion-chips.ts — the CLIENT-SAFE half of Q9's suggestion.
 *
 * Owner ruling 2026-09-06 (Q9): a booked supplier makes their zone OFFER their
 * trade; one click makes it the couple's. `events.reception_design` is never
 * written without that click.
 *
 * 🛑 THE SPLIT FROM `reception-booked-suggestions.ts` IS THE WHOLE REASON THIS
 * FILE EXISTS, and it is the same split `moodboard-finalization-rows.ts`
 * already keeps. Deciding WHO reaches WHICH zone needs the trade map, which
 * reaches lib/vendor-counts → lib/taxonomy-db → lib/supabase/server →
 * next/headers. Deciding WHICH of those offers to draw right now needs only the
 * couple's live selections. The first is server work; the second happens on
 * every tap, in the editor, in a `'use client'` component.
 *
 * A client component that imported the server module — even for one pure
 * function, even through a re-export, because a re-export is still a value edge
 * — fails the PRODUCTION BUILD and nothing before it: `tsc` is not a bundler
 * and `tsx --test` resolves it happily in node. MB12 shipped exactly that to
 * CI and five checks went red on *"You're importing a component that needs
 * next/headers"*. So this module imports NO taxonomy at all; the candidates
 * handed to it already carry their tiles as plain strings.
 */

import type { PartId } from './reception-scene';
import type { WeddingTile } from './taxonomy';

/**
 * ONE offer: a zone, a shop the couple has booked, and the option that shop's
 * own trade IS.
 *
 * 🔑 THERE IS NO DESIGN HERE. No palette, no colours, no `ReceptionDesign` — an
 * `optionId` that the couple's own vocabulary already contains, and a shop's
 * name. Everything a caller can do with this is render a sentence or hand
 * `optionId` to the editor's existing chip handler, which is the only writer
 * and already refuses a frozen zone, an over-cap selection and an exclusive
 * collision. A later edit that wanted to "just apply it" would have to change
 * this shape to do it — a visible act rather than a quiet one.
 */
export type BookedZoneCandidate = {
  zone: PartId;
  /** `event_vendors.vendor_id` — the BOOKING's key, so a dismissal is per
   *  booking and a NEW booking of the same trade gets a fresh chip. */
  vendorId: string;
  /** The shop's real name, as the couple's own booking records it. Never a
   *  category, never "a supplier you booked". */
  vendorName: string;
  /** The attribute the option lives under (`performers`, `stations`, `kinds`). */
  attr: string;
  optionId: string;
  optionLabel: string;
  /**
   * EVERY tile in this zone this shop works in — not only the suggested one.
   *
   * This is what lets the chip ask "does the zone ALREADY reflect this shop's
   * trade?" honestly. A caterer matches `buffet`, `plated` and `family_style`;
   * a couple who chose "Plated service" has answered their caterer, and a chip
   * still offering "Buffet line" (the first option, so the suggested one)
   * would be nagging them to undo a decision they made.
   */
  matchedTiles: WeddingTile[];
  /** Stable identity of this offer for dismissal — `<vendorId>:<zone>`. */
  dismissKey: string;
};

/** `<vendorId>:<zone>` — the ONE spelling of a dismissal key, so the writer and
 *  the reader cannot disagree about it. */
export function dismissKeyFor(vendorId: string, zone: PartId): string {
  return `${vendorId}:${zone}`;
}

/**
 * The offers to actually RENDER, given the room as it stands right now.
 *
 * Pure and total. Three suppressions, each of them something the couple has
 * already said:
 *
 *   1. **They dismissed it.** Per booking, per zone, per couple.
 *   2. **The zone is frozen** — a supplier agreed to build it (MB12's
 *      handshake). A frozen part is not re-derived, and it is not re-offered
 *      either: a chip whose one button `choose()` refuses is exactly the dead
 *      control with no explanation this repo keeps writing rules against.
 *   3. **The zone already reflects that shop's trade** — tile-level, not
 *      option-level, for the caterer reason in `matchedTiles` above.
 *
 * @param selectedTilesByZone must be built from the couple's LIVE selections
 *   (the editor's `selAll` across the zone's attributes, mapped through
 *   `Option.tile`), so a chip disappears the moment its own button is pressed
 *   rather than at the next server render.
 */
export function suggestionsToShow(
  candidates: readonly BookedZoneCandidate[],
  opts: {
    dismissedKeys: readonly string[];
    frozenZones: ReadonlySet<string>;
    selectedTilesByZone: ReadonlyMap<PartId, ReadonlySet<string>>;
  },
): BookedZoneCandidate[] {
  const dismissed = new Set(opts.dismissedKeys);
  return candidates.filter((c) => {
    if (dismissed.has(c.dismissKey)) return false;
    if (opts.frozenZones.has(c.zone)) return false;
    const selected = opts.selectedTilesByZone.get(c.zone);
    if (selected && c.matchedTiles.some((t) => selected.has(t))) return false;
    return true;
  });
}

/**
 * `events.dismissed_room_suggestions` as stored → a clean list of keys.
 *
 * Total and defensive, the same contract `sanitizeReceptionDesign` keeps: an
 * arbitrary JSONB blob becomes a list of strings or an empty list, and never
 * throws.
 *
 * ⚠ AN UNRECOGNISED KEY IS KEPT, NOT DROPPED. A key naming a booking that has
 * since been removed is inert — no candidate carries it — and discarding it
 * would silently resurrect the chip if that booking ever came back.
 */
export function sanitizeDismissedSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200),
    ),
  );
}
