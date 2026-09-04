/**
 * lib/moodboard-finalization.ts — MB12's PURE core.
 *
 * "A part the vendor has agreed to build stops moving." Three questions this
 * module answers, and nothing else:
 *
 *   1. WHO may be asked about this part?      → `canonicalServicesForPart`
 *   2. WHAT does agreeing freeze?             → `paletteKeysFrozenBy` /
 *                                               `dressingFieldsFrozenBy`
 *   3. WHAT exactly is being agreed to?       → `buildDesignSnapshot`
 *
 * Pure + DOM-free + no Supabase import, so it runs in a server action, a client
 * component and a `tsx --test` unit test identically — the same contract
 * `lib/moodboard-render-parts.ts` and `lib/moodboard-gallery.ts` keep.
 *
 * ── EVERYTHING HERE IS DERIVED. THERE IS NO SECOND MAP. ────────────────────
 * MB10 already answers "which trades supply this slot"
 * (`MOODBOARD_SLOT_TRADES`), and MB2 already answers "which slots feed this
 * part" (`inspirationSlotsForPart`). A part's trades are the composition of the
 * two. A hand-written part → trade table would be a THIRD opinion about one
 * fact, and the first time a slot's trades changed the two would disagree
 * silently — nobody would be shown a wrong supplier, they would simply be shown
 * a shorter list, which looks exactly like "no shop does this".
 *
 * ✅ THE EIGHT PARTS THAT HAD NO TRADE NOW HAVE ONE (MB16, owner-decided
 * 2026-09-04). `room:entrance`, `room:walls`, `room:photo_wall`,
 * `room:welcome_signage`, `people:muslim_principals`,
 * `people:secondary_sponsors`, `people:bearers_flower_girl` and
 * `people:officiants` alias no inspiration slot, so the composition above has
 * nothing to compose for them and they were permanently un-finalizable.
 *
 * 🛑 AND THE FIX THIS DOCBLOCK USED TO PRESCRIBE WAS IMPOSSIBLE. It said to
 * *"give those slots a trade in `MOODBOARD_SLOT_TRADES`"*. Those parts have no
 * slot to give a trade TO — that is the whole reason they were orphaned — and
 * `MOODBOARD_SLOT_TRADES` is typed `Record<MoodboardSlotKey, …>`, so `walls`
 * does not even compile as a key. The sentence read as a plan for a year and
 * could never have been carried out.
 *
 * The real answer is `MOODBOARD_PART_TRADES` in `lib/moodboard-slots.ts`, a
 * sibling of `INSPIRATION_SLOT_FOR_PART`: a part → trade map for exactly the
 * parts with no slot, composed in below. It is NOT a second opinion — the
 * module-load assertion refuses a key that names a part the slot join already
 * answers, so the two maps cannot both speak about one part.
 *
 * ⚠ AN EMPTY TRADE LIST IS STILL AN ANSWER for anything that gains neither.
 * Guessing a trade is worse than silence — it is MB10's own rule.
 * `moodboard-finalization.test.ts` pins the set, so it can only change visibly.
 */

import {
  DERIVABLE_PALETTE_KEYS,
  PALETTE_LIMITS,
  isWeddingPartyFineKey,
  resolveRoomDressing,
  type PaletteKey,
  type RolePalette,
  type RoomDressing,
} from './mood-board';
import {
  RENDER_PARTS,
  inspirationSlotsForPart,
  renderPartById,
  type RenderPart,
} from './moodboard-render-parts';
import { canonicalServicesForSlot, tradesForSlot } from './moodboard-gallery';
import { canonicalServicesForTile } from './vendor-counts';
import { MOODBOARD_PART_TRADES, orphanPartTrades } from './moodboard-slots';
import { WEDDING_TILE_LABEL, type WeddingTile } from './taxonomy';
import { displayColorsFor } from './mood-board-derive';
import type { Board } from './palette-styles';
import type { ReceptionDesign } from './reception-scene';

/**
 * Every part a supplier can be asked to agree to.
 *
 * 🔑 `whole_look` IS NOT ONE, and its absence is deliberate — see the CHECK on
 * `moodboard_part_finalizations.part_id`, which refuses it in the database too.
 * A render of the whole look is one picture; an AGREEMENT to the whole look is
 * not anybody's job. No single supplier builds the ceiling and the gowns and
 * the cake, so a signature against all of it would be a signature against work
 * they never do.
 */
export const FINALIZABLE_PARTS: readonly RenderPart[] = RENDER_PARTS;

/**
 * The part's human label — taken from the registry, never re-typed.
 *
 * An unknown id returns 'design' rather than the raw key: a supplier must never
 * be emailed "please agree to your room:welcome_signage".
 */
export function renderPartLabel(partId: string): string {
  return renderPartById(partId)?.label ?? 'design';
}

export function isFinalizablePartId(partId: string): boolean {
  return renderPartById(partId) !== undefined;
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · WHO MAY BE ASKED
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The marketplace trades that could agree to this part.
 *
 * MB10's slot → trade map composed through MB2's part → slot join, PLUS
 * MB16's `MOODBOARD_PART_TRADES` for the eight parts that alias no slot.
 *
 * 🔑 THE SUPPLEMENT IS ONLY EVER CONSULTED WHERE THE COMPOSITION IS EMPTY, and
 * `assertOrphanTradesDoNotOverlap` below refuses a key that names a part the
 * slot join already answers. So there is still exactly one answer per part, and
 * a future edit that tried to give a part a second, disagreeing trade list
 * throws at module load rather than shipping two maps nobody compares.
 */
export function tradesForPart(partId: string): WeddingTile[] {
  const out = new Set<WeddingTile>();
  for (const slot of inspirationSlotsForPart(partId)) {
    for (const tile of tradesForSlot(slot)) out.add(tile);
  }
  if (out.size === 0) {
    for (const tile of orphanPartTrades(partId)) out.add(tile);
  }
  return [...out];
}

/**
 * Every `MOODBOARD_PART_TRADES` key must name a REAL part that the slot join
 * leaves empty — checked once, at module load, exactly like
 * `assertAliasesResolve` in the registry.
 *
 * Two failures it makes impossible:
 *   · a typo'd key (`room:wall`) that silently supplies nothing, and reads as
 *     "no shop does this" — the same invisible shape MB10's own docblock warns
 *     about;
 *   · a key on a part that ALREADY has slot-derived trades, which would be a
 *     second opinion about one fact that nothing would ever compare.
 */
function assertOrphanTradesDoNotOverlap(): void {
  for (const partId of Object.keys(MOODBOARD_PART_TRADES)) {
    if (renderPartById(partId) === undefined) {
      throw new Error(
        `moodboard-finalization: MOODBOARD_PART_TRADES names "${partId}", which is not a render part`,
      );
    }
    const fromSlots = inspirationSlotsForPart(partId).flatMap((s) => [...tradesForSlot(s)]);
    if (fromSlots.length > 0) {
      throw new Error(
        `moodboard-finalization: MOODBOARD_PART_TRADES names "${partId}", which already has ` +
          `slot-derived trades (${fromSlots.join(', ')}) — two maps would answer one question`,
      );
    }
    if (MOODBOARD_PART_TRADES[partId]!.length === 0) {
      throw new Error(
        `moodboard-finalization: MOODBOARD_PART_TRADES gives "${partId}" an empty list — ` +
          'absence is how a part says it has no trade; an empty entry says the same thing twice',
      );
    }
  }
}
assertOrphanTradesDoNotOverlap();

/**
 * The canonical service keys a supplier must hold to be asked about this part.
 *
 * This is the SAME question MB11's upload gate asks — "may this shop touch this
 * slot?" — resolved through the same function, `canonicalServicesForSlot`,
 * whose docblock says the gate must read it and never its own copy.
 */
export function canonicalServicesForPart(partId: string): string[] {
  const out = new Set<string>();
  for (const slot of inspirationSlotsForPart(partId)) {
    for (const canonical of canonicalServicesForSlot(slot)) out.add(canonical);
  }
  // MB16: the eight parts with no slot resolve through the part → trade map,
  // and through the SAME tile → canonical expansion, so an orphan part's
  // eligibility test is byte-identical in shape to every other part's. A
  // second expansion here would be the drift `canonicalServicesForSlot`'s own
  // docblock exists to prevent.
  if (out.size === 0) {
    for (const tile of orphanPartTrades(partId)) {
      for (const canonical of canonicalServicesForTile(tile)) out.add(canonical);
    }
  }
  return [...out];
}

/** Human words for the trades a part needs — "a Stylist / Decorator or a
 *  Florist". Used to say what the board is WAITING FOR, never to fill a gap. */
export function tradeLabelsForPart(partId: string): string[] {
  return tradesForPart(partId).map((t) => WEDDING_TILE_LABEL[t]);
}

/** One booked supplier on this event, as the eligibility check reads it. */
export type BookedSupplier = {
  /** `event_vendors.vendor_id` — the BOOKING's primary key. */
  vendorId: string;
  name: string;
  /** The shop's `vendor_profiles.services[]`, canonical keys. Empty when the
   *  booking has no marketplace shop behind it (a couple's own supplier). */
  services: readonly string[];
};

/** TRUE when this booked supplier's trades reach this part. */
export function supplierCanAnswerPart(partId: string, supplier: BookedSupplier): boolean {
  const needed = canonicalServicesForPart(partId);
  if (needed.length === 0) return false;
  return supplier.services.some((s) => needed.includes(s));
}

/** The booked suppliers who could be asked about this part, in the order given. */
export function eligibleSuppliersForPart(
  partId: string,
  booked: readonly BookedSupplier[],
): BookedSupplier[] {
  return booked.filter((s) => supplierCanAnswerPart(partId, s));
}

/**
 * WHY THIS PART CANNOT BE FINALIZED YET — in words, never as a dead button.
 *
 * 🔑 THE BRIEF'S OWN REQUIREMENT: "the UI shows what it is waiting for, never a
 * dead button with no explanation." A disabled control with no sentence is the
 * shape this repo keeps shipping — the couple sees something they cannot press
 * and has no way to learn what would make it pressable.
 *
 * `null` means the part IS askable.
 */
export type FinalizeBlocker =
  | { code: 'no_trade'; message: string }
  | { code: 'no_booked_supplier'; message: string };

export function finalizeBlocker(
  partId: string,
  booked: readonly BookedSupplier[],
): FinalizeBlocker | null {
  const labels = tradeLabelsForPart(partId);
  if (labels.length === 0) {
    return {
      code: 'no_trade',
      message:
        'No supplier trade covers this part yet, so there is nobody to agree to it. ' +
        'It stays yours to change.',
    };
  }
  if (eligibleSuppliersForPart(partId, booked).length === 0) {
    const list =
      labels.length === 1
        ? labels[0]!
        : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]!}`;
    return {
      code: 'no_booked_supplier',
      message: `Book a ${list} first — only a supplier you have booked can agree to this part.`,
    };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · WHAT AGREEING FREEZES
   ══════════════════════════════════════════════════════════════════════════

   🔑 THE FREEZE IS MB5's `touchedRoles`, NOT A PARALLEL MECHANISM.
   `deriveBoard` already refuses to write a touched role
   (`if (touchedRoles.has(key)) continue`) and `resolveRoomDressing` already
   prefers an explicit override to the value derived from the majors. Agreeing
   makes the currently-DERIVED colour EXPLICIT — the same write a couple's own
   edit makes — so the existing stops apply with no new branch in the engine.

   What that buys: there is no second definition of "frozen" anywhere. Delete
   this module and the engine still behaves correctly for a hand-edited role;
   the only thing lost is the ability to reach that state through a handshake.
*/

/** The four wedding-party keys that FALL BACK to `wedding_party`. Derived, so a
 *  fifth cannot appear without arriving here. */
const WEDDING_PARTY_FINE: readonly PaletteKey[] = DERIVABLE_PALETTE_KEYS.filter((k) =>
  isWeddingPartyFineKey(k),
);

/**
 * Which palette roles stop deriving when this part is agreed.
 *
 * · `people:<role>` freezes that role. When the role is `wedding_party` it also
 *   freezes the four SPLIT keys, because `resolveAttirePaletteColor` resolves
 *   the specific key FIRST and falls back to `wedding_party` — so freezing only
 *   the fallback would let a change to the majors re-dress the bridesmaids in
 *   an entourage the supplier had already agreed to.
 * · `room:*` and `place:*` freeze no ROLE. A room zone's colour is the couple's
 *   majors read directly (`renderVenueSvg(design, palette.reception, …)`), and
 *   the majors are the SOURCE — the one-directional rule means they are never
 *   touchable, by a couple's edit or by an agreement. What CAN be frozen for a
 *   room is the room-dressing override layer, below.
 *
 * Keys that are not derivable at all (`officiants`) are dropped: there is
 * nothing to stop.
 */
export function paletteKeysFrozenBy(partId: string): PaletteKey[] {
  const part = renderPartById(partId);
  if (!part || part.source !== 'palette_role') return [];
  const key = part.sourceKey as PaletteKey;
  const keys = key === 'wedding_party' ? [key, ...WEDDING_PARTY_FINE] : [key];
  return keys.filter((k) => DERIVABLE_PALETTE_KEYS.includes(k));
}

/**
 * Which `room_dressing` override fields stop deriving when this part is agreed.
 *
 * ⚠ THIS IS A READING OF `resolveRoomDressing`'s OWN FIELD COMMENTS, NOT A NEW
 * OPINION. That function says, in the source: linens = "the tablecloth",
 * chairs = "Accent (r[2]) for chairs", florals = "the floral statement",
 * lighting_warmth = "the warm ambient wash". A tablecloth, its chairs and its
 * centrepiece are the TABLES zone; the ambient wash is the CEILING.
 *
 * ⚠ AND EVERY OTHER ZONE FREEZES NOTHING, WHICH IS THE HONEST ANSWER RATHER
 * THAN A CONVENIENT ONE. A backdrop, a tunnel, a stage, an entrance, a wall, a
 * photo wall and a welcome sign are all drawn from `palette.reception` directly
 * — the majors themselves. Freezing them would mean freezing the couple's five
 * main colours, which is not a thing a per-part agreement may do: the majors
 * are section 00's, they are the source every other surface follows, and
 * `touched_roles` refuses `reception` as a member by construction. So agreeing
 * to a backdrop records WHAT was agreed (the snapshot) and stops nothing.
 *
 * 🔑 That is a real limit, stated rather than papered over. `place:flowers` is
 * the one place part with a dressing field, because the florals colour is the
 * one dressing field that is not about the room's furniture.
 */
const ROOM_DRESSING_FROZEN_BY: Readonly<Record<string, readonly (keyof RoomDressing)[]>> = {
  'room:tables': ['linens', 'chairs', 'florals'],
  'room:ceiling': ['lighting_warmth'],
  'place:flowers': ['florals'],
};

export function dressingFieldsFrozenBy(partId: string): (keyof RoomDressing)[] {
  return [...(ROOM_DRESSING_FROZEN_BY[partId] ?? [])];
}

/**
 * The parts an agreement RECORDS but does not FREEZE — pinned by a test so the
 * list can only change visibly. If a future session gives one of these a
 * derived colour of its own, it belongs out of this list and into one of the
 * two maps above; discovering it by reading a rendering bug is the failure this
 * pin exists to prevent.
 */
export function partFreezesNothing(partId: string): boolean {
  return paletteKeysFrozenBy(partId).length === 0 && dressingFieldsFrozenBy(partId).length === 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · WHAT IS BEING AGREED TO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The design a supplier is answering, recorded at ASK time.
 *
 * 🔑 RECORDED, NOT RE-DERIVED LATER. The couple keeps editing while a request
 * is open — that is normal and nobody should be stopped from it. So what the
 * supplier was shown has to be stored, or "they agreed to this" would mean
 * "they agreed to whatever the board says now", which is not an agreement.
 *
 * `palette` and `room_dressing` are the halves the database freezes
 * (`reassert_part_finalization_freeze` reads exactly these two keys).
 * `reception_design` and `inspiration_slots` are the RECORD: what the zone's
 * treatments were and which reference photos were on the board. They are inert
 * to the freeze and exist so the supplier's own screen can show the thing they
 * are being asked about, and so the agreement is still readable months later.
 */
export type PartDesignSnapshot = {
  palette: Partial<Record<PaletteKey, string[]>>;
  room_dressing: Partial<Record<keyof RoomDressing, string>>;
  reception_design: ReceptionDesign;
  inspiration_slots: string[];
};

/**
 * Build the snapshot for one part from the board as it stands.
 *
 * 🔑 THE COLOURS ARE THE ONES THE COUPLE IS LOOKING AT — `displayColorsFor`,
 * the same function section 02 renders from, so what the supplier is asked
 * about is byte-identical to what is on the couple's screen. Deriving them a
 * second way here is how two surfaces come to disagree about one board.
 *
 * A role with no colours at all is OMITTED rather than written as `[]`: an
 * empty array would freeze the role at "nothing", and the couple's swatches
 * would go blank the moment the supplier agreed — a failure that renders
 * identically to a role nobody has filled in.
 */
export function buildDesignSnapshot(
  partId: string,
  palette: RolePalette,
  derived: Board | null,
  receptionDesign: ReceptionDesign,
): PartDesignSnapshot {
  const touched = new Set<PaletteKey>(palette.touched_roles ?? []);
  const out: PartDesignSnapshot = {
    palette: {},
    room_dressing: {},
    reception_design: receptionDesign,
    inspiration_slots: inspirationSlotsForPart(partId),
  };

  for (const key of paletteKeysFrozenBy(partId)) {
    const colors = displayColorsFor(key, palette, touched, derived).slice(
      0,
      PALETTE_LIMITS[key].max,
    );
    if (colors.length > 0) out.palette[key] = colors;
  }

  const resolved = resolveRoomDressing(palette);
  for (const field of dressingFieldsFrozenBy(partId)) {
    out.room_dressing[field] = resolved[field];
  }

  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   READING THE ROWS — re-exported, NOT defined here
   ══════════════════════════════════════════════════════════════════════════

   🛑 THEY LIVE IN `./moodboard-finalization-rows`, AND THE SPLIT IS THE WHOLE
   POINT. This module composes MB10's slot → trade map, which reaches
   `lib/vendor-counts.ts` → `lib/taxonomy-db.ts` → `lib/supabase/server.ts` →
   `next/headers`. A `'use client'` file that imports a VALUE from here fails
   the production build — and neither `tsc` nor `tsx --test` can see it, because
   one is not a bundler and the other resolves everything happily in node.

   MB12 shipped exactly that to CI: `palette-board-context.tsx` imported
   `frozenNow` from here, and five checks went red on
   *"You're importing a component that needs next/headers"*. The warning was
   already written down in `moodboard-gallery.ts`'s own docblock.

   ⚠ SO A CLIENT COMPONENT MUST IMPORT FROM THE ROWS MODULE DIRECTLY, never
   through this re-export — a re-export is still a value edge through this file.
   These lines exist only so a SERVER caller can take everything from one place.
   `lint-server-only-boundary.mjs` now treats `next/headers` as a boundary root
   and will say so in about a second rather than in a twenty-minute build.
*/

export {
  liveByPart,
  frozenNow,
  type PartFinalizationRecord,
} from './moodboard-finalization-rows';
