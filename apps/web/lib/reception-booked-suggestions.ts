/**
 * lib/reception-booked-suggestions.ts — "you've booked them; shall I add them?"
 *
 * Owner ruling 2026-09-06 (Q9): when a couple has booked a supplier whose trade
 * reaches a reception zone, that zone SUGGESTS the treatment and ONE click
 * makes it theirs. `events.reception_design` is not touched until they click.
 * The owner's reason, in their framing: a room that changes without them
 * touching it is a room they cannot trust — the same reasoning that made every
 * celebration zone default to `none`.
 *
 * ── THE RULING IS HELD BY THE RETURN TYPE, NOT BY DISCIPLINE ───────────────
 * 🔑 THIS MODULE CANNOT PRODUCE A `ReceptionDesign`. It does not import one and
 * it never constructs one; a `BookedZoneCandidate` carries a zone, an attribute,
 * an option id and a shop's name, and nothing that could be written anywhere.
 * A later edit that decided to "just apply it" would have to change the shape
 * of this file to do it — a visible act rather than a quiet one.
 *
 * Why that is worth a type: `sel()` falls back to `DEFAULT_DESIGN` for any part
 * a stored design has no key for, so a written suggestion is INDISTINGUISHABLE
 * from a choice the couple made. They would find selections they never picked,
 * and deleting one could not stick — the next page load would put it back.
 *
 * ── AND THERE IS NO SECOND BOOKING → ZONE MAPPING ──────────────────────────
 * 🛑 "Does this booking reach this zone" is already answered, once, by
 * `eligibleSuppliersForPart` (lib/moodboard-finalization.ts), which composes
 * MB10's slot → trade map and MB16's `MOODBOARD_PART_TRADES`. This module CALLS
 * it and adds nothing to it. A second opinion about that one fact is what
 * CLAUDE.md Rule 0 · 8 forbids, and the failure would be invisible: nobody sees
 * a wrong supplier, they simply see a shorter list, which looks exactly like
 * "no shop does this".
 *
 * What this module adds is strictly FINER: given that a shop reaches the zone,
 * WHICH option in that zone's vocabulary is the shop's own trade. That question
 * has no existing answer, and RV1 wrote its raw material into
 * `lib/reception-scene.ts` as a comment beside each celebration option
 * (`// live_band`, `// mobile_bar`). Those comments are now the `Option.tile`
 * field, and `assertOptionTilesBelongToTheirZone` below refuses, at module
 * load, any option tile that the zone's own `MOODBOARD_PART_TRADES` entry does
 * not already claim. So the two vocabularies cannot drift apart silently — the
 * same module-load discipline `assertOrphanTradesDoNotOverlap` already keeps.
 *
 * ⚠ SERVER-ONLY, LIKE EVERY OTHER CALLER OF THE TRADE MAP.
 * `canonicalServicesForPart` reaches lib/vendor-counts → lib/taxonomy-db →
 * lib/supabase/server → next/headers. A `'use client'` component that imported
 * a VALUE from here fails the production build, and NOTHING ELSE CAN SEE IT —
 * `tsc` is not a bundler and `tsx --test` resolves it happily in node. MB12
 * shipped exactly that chain to CI. So the candidates are resolved in
 * `seating/lab/page.tsx` and handed to the editor as plain props, and the
 * half the editor runs on every tap — which offers to DRAW, given the room as
 * it stands — lives in `lib/reception-suggestion-chips.ts`, which imports no
 * taxonomy at all. Import the shapes from THERE in a client component, never
 * from here and never through a re-export of here: a re-export is still a
 * value edge through this file.
 */

import {
  RECEPTION_PARTS,
  venueZoneApplies,
  type Option,
  type PartId,
} from './reception-scene';
import {
  eligibleSuppliersForPart,
  type BookedSupplier,
} from './moodboard-finalization';
import { canonicalServicesForTile } from './vendor-counts';
import { MOODBOARD_PART_TRADES } from './moodboard-slots';
import { dismissKeyFor, type BookedZoneCandidate } from './reception-suggestion-chips';
import type { WeddingTile } from './taxonomy';

/** The render-part id for a reception zone — `feast` → `room:feast`. The ONE
 *  place this session spells that prefix, so the trade map is asked about the
 *  same string the registry and the freeze trigger use. */
export function renderPartIdForZone(zone: PartId): string {
  return `room:${zone}`;
}

/**
 * Every option in a zone that names a trade, in vocabulary order.
 *
 * ⚠ ORDER IS THE VOCABULARY'S, NOT THIS FILE'S. RV1 wrote each attribute
 * "most characteristic first" (a buffet line before a grazing table; a live
 * band before a choir), and that ordering is the whole basis on which one
 * option is picked for a shop that matches several. Sorting here — by label,
 * by tile, by anything — would silently replace an editorial judgment with an
 * alphabet.
 */
function tiledOptionsForZone(
  zone: PartId,
): Array<{ attr: string; option: Option & { tile: WeddingTile } }> {
  const part = RECEPTION_PARTS.find((p) => p.id === zone);
  if (!part) return [];
  const out: Array<{ attr: string; option: Option & { tile: WeddingTile } }> = [];
  for (const attr of part.attributes) {
    for (const option of attr.options) {
      if (option.tile) out.push({ attr: attr.id, option: option as Option & { tile: WeddingTile } });
    }
  }
  return out;
}

/** Every zone that names at least one trade — derived, never listed. A fourth
 *  celebration zone arrives here by existing, not by being remembered. */
export function zonesThatSuggest(): PartId[] {
  return RECEPTION_PARTS.filter((p) => tiledOptionsForZone(p.id).length > 0).map((p) => p.id);
}

/**
 * An option may only name a trade its own zone already claims.
 *
 * Two failures this makes impossible, both of which render as SILENCE rather
 * than as an error:
 *   · a typo'd or invented tile (`live_bands`), which expands to no canonical
 *     service, matches no shop, and reads as "nobody you booked does this";
 *   · a tile that is real but belongs to a DIFFERENT zone, which would suggest
 *     a mobile bar inside the Program because somebody moved a line.
 *
 * Checked once, at module load — the same shape as
 * `assertOrphanTradesDoNotOverlap` in moodboard-finalization.ts.
 */
export function assertOptionTilesBelongToTheirZone(): void {
  for (const zone of zonesThatSuggest()) {
    const claimed = MOODBOARD_PART_TRADES[renderPartIdForZone(zone)] ?? [];
    for (const { attr, option } of tiledOptionsForZone(zone)) {
      if (!(claimed as readonly string[]).includes(option.tile)) {
        throw new Error(
          `reception-booked-suggestions: ${zone}.${attr}.${option.id} names trade ` +
            `"${option.tile}", which MOODBOARD_PART_TRADES["${renderPartIdForZone(zone)}"] ` +
            `does not claim (${claimed.join(', ') || 'nothing'}) — two vocabularies would ` +
            'answer one question',
        );
      }
    }
  }
}
assertOptionTilesBelongToTheirZone();

/**
 * The offers this event could show, before the couple's own design is consulted.
 *
 * DESIGN-INDEPENDENT ON PURPOSE. What the couple has currently selected changes
 * as they tap, in client state, between server renders; the taxonomy does not.
 * So the server resolves WHO reaches WHICH zone (the half that needs
 * `next/headers`) and the client suppresses the chips its own live design has
 * already answered (`suggestionsToShow` below). Computing the whole thing on
 * the server would leave a chip on screen offering a treatment the couple had
 * just chosen, until the next revalidation.
 *
 * @param venueSetting `events.venue_setting` — a zone this venue lacks offers
 *   nothing, through the SAME `venueZoneApplies` predicate the editor's rail
 *   and hotspots already use.
 */
export function bookedZoneCandidates(
  booked: readonly BookedSupplier[],
  venueSetting: string | null | undefined,
): BookedZoneCandidate[] {
  const out: BookedZoneCandidate[] = [];
  for (const zone of zonesThatSuggest()) {
    if (!venueZoneApplies(venueSetting, zone)) continue;
    const tiled = tiledOptionsForZone(zone);
    // 🔑 THE ZONE-REACH QUESTION IS ASKED OF THE EXISTING BRIDGE, NOT ANSWERED
    // HERE. Everything below only narrows this list.
    for (const supplier of eligibleSuppliersForPart(renderPartIdForZone(zone), booked)) {
      const services = new Set(supplier.services);
      const matchedTiles: WeddingTile[] = [];
      let first: { attr: string; option: Option & { tile: WeddingTile } } | null = null;
      for (const entry of tiled) {
        if (!canonicalServicesForTile(entry.option.tile).some((c) => services.has(c))) continue;
        if (!matchedTiles.includes(entry.option.tile)) matchedTiles.push(entry.option.tile);
        if (first === null) first = entry;
      }
      // ⚠ ELIGIBLE FOR THE ZONE, BUT NO OPTION IS THEIR TRADE — SO NO CHIP.
      // `MOODBOARD_PART_TRADES['room:program']` claims `av_production`, and no
      // program option is an AV company; `room:feast` claims `food_truck` and
      // no feast option is a truck. Those shops genuinely reach the zone (they
      // may be ASKED to agree to it, which is what that map is for) and there
      // is still nothing honest to put in the chip's blank. Silence is the
      // answer; inventing "Buffet line" for an AV company is not.
      if (first === null) continue;
      out.push({
        zone,
        vendorId: supplier.vendorId,
        vendorName: supplier.name,
        attr: first.attr,
        optionId: first.option.id,
        optionLabel: first.option.label,
        matchedTiles,
        dismissKey: dismissKeyFor(supplier.vendorId, zone),
      });
    }
  }
  return out;
}
