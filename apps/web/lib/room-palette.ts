/**
 * lib/room-palette.ts — MB15. THE ONE PLACE THE 3D PLAN READS THE MOOD BOARD.
 *
 * The board decides colour and design. The room READS. Every 3D surface
 * (`plan3d-scene.tsx`, `guest-venue-3d.tsx`, `seating-lab-3d.tsx`) resolves
 * its materials and its people through the two functions below and through
 * nothing else, so there is exactly one answer to "what colour is this room".
 *
 * 🛑 ONE DIRECTION, ALWAYS. Nothing in this module writes. It takes a
 * `RolePalette` and returns colours. If a 3D surface ever needs to change a
 * colour, the change belongs on the mood board — two writers for one fact is
 * the defect that surfaces months later in front of a customer, and it is the
 * rule every session in this arc has held.
 *
 * ── WHAT CHANGED, AND WHY IT WAS ALLOWED TO ───────────────────────────────
 * `resolvePaletteFromRoles` (lib/seating-3d.ts) maps the couple's five majors
 * straight onto scene materials and has never known the board holds a STYLE.
 * MB5 gave the board three — *Our colours only* / *Softer room, richer people*
 * / *Room and people* — and a six-rank visibility hierarchy, and the room could
 * not see any of it: the same wedding rendered identically under all three.
 *
 * MB1 explicitly FORBADE wiring the room's chair/floral slots to the palette
 * editor's helper, because doing so "silently restyles every room already
 * sold". That prohibition was correct for MB1, which was a repair. MB15 is the
 * connection, and the owner resolved it on 2026-09-04:
 *
 *   **auto-upgrade every room, existing and new. No opt-in, no warning prompt.**
 *
 * The opt-in-with-warning recommendation was heard and declined. Do not add a
 * flag here; it was considered.
 *
 * ── WHAT MOVES, AND WHAT MAY NOT ──────────────────────────────────────────
 * Only the FOUR room-dressing surfaces are style-derived:
 *
 *     table    ← venue.room_dressing.linens           (was reception[1])
 *     ambient  ← venue.room_dressing.lighting_warmth  (was reception[0])
 *     chairs   ← venue.room_dressing.chairs           (was ABSENT unless overridden)
 *     florals  ← venue.room_dressing.florals          (was ABSENT unless overridden)
 *
 * `accent`, `floor`, `wall` and `accent2` have NO style-derived counterpart in
 * `deriveVenue`, so they are taken from `resolvePaletteFromRoles` verbatim and
 * this module never touches them. That is structural, not a promise: they are
 * spread in from `base` and never re-assigned. `the-room-reads-the-resolved-
 * board.test.ts` asserts it over all 2,600 seeded themes × 3 styles anyway,
 * because MB1's whole repair (the fifth major reaching a pixel) lives in
 * `accent2` and must not move.
 *
 * 🔑 UNDER `simple`, `deriveVenue` RETURNS THE MAJORS UNTONED — so `table` and
 * `ambient` are byte-identical to the pre-MB15 room for every board with two or
 * more majors in that style. The visible change there is `chairs`/`florals`
 * arriving where they were absent. Under `depth`/`complex` the four are lifted
 * (+0.06 L, chroma capped at 0.13) and all four move. Both are measured in the
 * diff report committed with this change.
 *
 * ⚠ AN EXPLICIT OVERRIDE STILL WINS, AND THAT IS ALSO THE FREEZE. MB12's
 * `vendor_agree_to_part` freezes a room-dressing field by writing it into
 * `role_palette.room_dressing` — the same explicit override a couple sets by
 * hand. Reading `o.<field> ?? derived` therefore honours a supplier's agreement
 * with no second branch, exactly as `resolveRoomDressing` already does.
 */

import {
  resolvePaletteFromRoles,
  type Lab3DPalette,
} from './seating-3d';
import {
  DERIVABLE_PALETTE_KEYS,
  sanitizePaletteStyle,
  type PaletteKey,
  type RolePalette,
} from './mood-board';
import { derivedBoardFor, displayColorsFor, effectiveMajors } from './mood-board-derive';
import { deriveVenue, normalizeMajors } from './palette-styles';

/**
 * The room's materials, derived from the RESOLVED board — the couple's majors
 * AND their palette style — instead of from the flat colour list.
 *
 * A board with no usable major returns `resolvePaletteFromRoles` unchanged:
 * `normalizeMajors` throws on an empty list by design, and there is nothing to
 * derive from nothing. That path is byte-identical to the pre-MB15 room.
 */
export function resolveRoomPalette(rp: RolePalette): Lab3DPalette {
  // MB1's mapping, in full. `accent` / `floor` / `wall` / `accent2` are taken
  // from here and never recomputed below.
  const base = resolvePaletteFromRoles(rp);
  const majors = effectiveMajors(rp);
  if (majors.length === 0) return base;

  const venue = deriveVenue(normalizeMajors(majors), sanitizePaletteStyle(rp.palette_style));
  const dressed = venue.room_dressing;
  const o = rp.room_dressing ?? {};
  return {
    ...base,
    table: o.linens ?? dressed.linens,
    ambient: o.lighting_warmth ?? dressed.lighting_warmth,
    chairs: o.chairs ?? dressed.chairs,
    florals: o.florals ?? dressed.florals,
  };
}

/**
 * The palette every ATTIRE-facing surface should read: the couple's stored
 * colours with every untouched derivable role filled in from the SAME derived
 * board section 02 displays.
 *
 * ── THE DISAGREEMENT THIS CLOSES ──────────────────────────────────────────
 * 02 renders a role through `displayColorsFor`, which shows the DERIVED colour
 * for any role the couple has not touched. The room read the raw JSONB, where
 * an underived role is simply absent — so `resolveAttirePaletteColor` fell
 * through to `wedding_party`, then to the bride/groom SIDE colour, and dressed
 * a bridesmaid in a colour the board never showed anybody. Section 02 and the
 * room were two mechanisms answering one question, and each passed its own
 * tests.
 *
 * 🔑 IT IS THE SAME FUNCTION, NOT THE SAME LOGIC RE-TYPED. `displayColorsFor`
 * is 02's own resolver, imported. A second implementation here would drift the
 * first time either side changed, and the symptom would be a person wearing the
 * wrong colour in a room the couple showed their supplier.
 *
 * ⚠ A THEME TEMPLATE'S ROLE COLOURS ARE NOT "TOUCHED", AND THIS IS WHERE THAT
 * BECOMES VISIBLE. `applyMoodboardTemplate` writes a template's role colours
 * into `role_palette` and marks nothing touched, so section 02 has ALWAYS shown
 * the derived colour over them. The room used to show the stored one. After
 * this, both show the derived one — the board is the decider, so the room moves
 * to the board, never the other way.
 *
 * ⚠ NO MAJORS → THE PALETTE IS RETURNED UNCHANGED. `derivedBoardFor` returns
 * null there and `displayColorsFor` would answer `[]` for every untouched role,
 * which would DROP colours a board really holds. An honest board with no majors
 * has nothing to derive, so it is passed straight through.
 *
 * `custom_roles`, `officiants`, `reception`, `room_dressing`, `touched_roles`
 * and `palette_style` are carried across untouched — the engine derives none of
 * them, and inventing a value for a role the couple named themselves would be
 * worse than showing the one they typed.
 */
export function resolveDisplayPalette(rp: RolePalette): RolePalette {
  const majors = effectiveMajors(rp);
  const derived = derivedBoardFor(majors, sanitizePaletteStyle(rp.palette_style));
  if (!derived) return rp;

  const touched = new Set<PaletteKey>(rp.touched_roles ?? []);
  const out: RolePalette = { ...rp };
  for (const key of DERIVABLE_PALETTE_KEYS) {
    const colors = displayColorsFor(key, rp, touched, derived);
    if (colors.length > 0) out[key] = colors;
  }
  return out;
}
