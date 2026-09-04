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
 * ⚠ AN EMPTY TRADE LIST IS AN ANSWER, AND EIGHT PARTS HAVE ONE.
 * `room:entrance`, `room:walls`, `room:photo_wall`, `room:welcome_signage`,
 * `people:muslim_principals`, `people:secondary_sponsors`,
 * `people:bearers_flower_girl` and `people:officiants` alias no inspiration
 * slot, so no trade supplies them and no supplier can be asked to agree to
 * them. The board says so in words rather than offering a dead button. Guessing
 * a trade would be worse than silence — it is MB10's own rule, and the fix (if
 * the owner wants those parts askable) is to give those slots a trade in
 * `MOODBOARD_SLOT_TRADES`, where every other reader would learn about it too.
 * `moodboard-finalization.test.ts` pins that list, so it can only grow visibly.
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

/** The marketplace trades that could agree to this part — MB10's map, composed
 *  through MB2's part → slot join. Empty is an answer (see the header). */
export function tradesForPart(partId: string): WeddingTile[] {
  const out = new Set<WeddingTile>();
  for (const slot of inspirationSlotsForPart(partId)) {
    for (const tile of tradesForSlot(slot)) out.add(tile);
  }
  return [...out];
}

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
   READING THE ROWS
   ══════════════════════════════════════════════════════════════════════════ */

/** One `moodboard_part_finalizations` row, as every couple-facing surface reads
 *  it. Deliberately the DB column names: this shape is what the query returns,
 *  and renaming on the way in is how a field quietly stops being read. */
export type PartFinalizationRecord = {
  finalization_id: string;
  part_id: string;
  vendor_id: string;
  state: string;
  expires_at: string | null;
  agreed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  reopen_state: string | null;
  reopen_expires_at: string | null;
  reopen_decline_reason: string | null;
  frozen_palette_keys: string[] | null;
  frozen_dressing_fields: string[] | null;
};

/** Index the live rows by part. At most one row per part can be pending or
 *  agreed — `moodboard_part_finalizations_one_live_uniq` enforces it — so this
 *  map is total, not a "last one wins". */
export function liveByPart(
  rows: readonly PartFinalizationRecord[],
): Map<string, PartFinalizationRecord> {
  const out = new Map<string, PartFinalizationRecord>();
  for (const row of rows) {
    if (row.state !== 'pending' && row.state !== 'agreed') continue;
    out.set(row.part_id, row);
  }
  return out;
}

/**
 * What is CURRENTLY frozen on this board, read from the rows themselves.
 *
 * 🔑 FROM `frozen_palette_keys`, NOT FROM `paletteKeysFrozenBy`. The row records
 * what the agreement ACTUALLY added; the map above says what an agreement
 * WOULD add today. They differ whenever the couple had already touched a role
 * by hand before finalizing — and re-deriving the answer from the map would
 * then claim their own edit as ours and release it on re-open. The database
 * releases exactly `frozen_palette_keys` for the same reason.
 */
export function frozenNow(rows: readonly PartFinalizationRecord[]): {
  paletteKeys: Set<string>;
  dressingFields: Set<string>;
} {
  const paletteKeys = new Set<string>();
  const dressingFields = new Set<string>();
  for (const row of rows) {
    if (row.state !== 'agreed') continue;
    for (const k of row.frozen_palette_keys ?? []) paletteKeys.add(k);
    for (const f of row.frozen_dressing_fields ?? []) dressingFields.add(f);
  }
  return { paletteKeys, dressingFields };
}
