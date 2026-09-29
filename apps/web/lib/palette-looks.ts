/**
 * 🎨 THE FIVE PALETTE LOOKS — how the Dress code scene draws "Our colours".
 *
 * ⚠ NOT `lib/palette-styles.ts`. That is the Mood Board's derivation engine
 * (Simple · Depth · Complex — how the couple's five colours become every
 * role's); this is only how the colours are DRAWN in one scene. The owner calls
 * these "palette styles"; the code says "look" so the two can never be mixed up.
 *
 * Owner, 2026-09-29 (DECISION_LOG "APPROVED — FIVE PALETTE STYLES, PICKED ON
 * THE TOOLBAR"), verbatim: *"palette. yes · Style on toolbar yes"* on
 * `prototypes/palette_styles_2026-09-29.html`. Five looks for the SAME colours
 * — the couple's words and colours never change with the look:
 *
 *   · tags     — today's `.pahina-swatch` tags. The DEFAULT, so a live page
 *                that never picked keeps its look.
 *   · fabric   — pinked cloth squares with a weave and a stitch.
 *   · chips    — one paint-store strip, the name ON the colour.
 *   · circles  — overlapping buttons in one row, the names under.
 *   · ribbon   — one notched band splitting into the colours.
 *
 * Every look is FREE (a pick from a dropdown — nothing typed, uploaded or
 * tuned), and every look comes with its own CSS entrance that plays once when
 * the palette scrolls into view (globals.css, "THE FIVE PALETTE LOOKS").
 *
 * ── WHERE A PICK LIVES ──────────────────────────────────────────────────────
 * On the Dress code row, BESIDE the scene's layout pick:
 * `invitation_widgets.config_json.canvas.palette` next to `canvas.style`, the
 * same sanitiser shape (`sanitizeSceneStyleId`), drafted and applied by the
 * one canvas draft door like `canvas.style`. ABSENT = `tags` ("Auto is an
 * absence", `lib/hub-canvas.ts`). An id this version does not draw also reads
 * as `tags`, so a stray value can never blank the colours.
 *
 * Not offered on the Mood Board: the Mood Board is the colours' SOURCE, and the
 * look is one pick, in the scene.
 *
 * Pure. No I/O. Client-safe (the Maker's Palette row reads the list).
 */

import { sanitizeSceneStyleId } from '@/lib/scene-style-id';

export const PALETTE_LOOK_IDS = ['tags', 'fabric', 'chips', 'circles', 'ribbon'] as const;
export type PaletteLookId = (typeof PALETTE_LOOK_IDS)[number];

/** Absent = this. Today's look — a live page that never picked does not change. */
export const PALETTE_LOOK_DEFAULT: PaletteLookId = 'tags';

export type PaletteLook = {
  id: PaletteLookId;
  /** The dropdown's word for it. */
  name: string;
  /** One line under the name: what it looks like. */
  line: string;
};

/** In the dropdown's order — the prototype's A to E. */
export const PALETTE_LOOKS: readonly PaletteLook[] = [
  { id: 'tags', name: 'Tags', line: 'Tall tags on a pin, the name under each' },
  { id: 'fabric', name: 'Fabric swatches', line: 'Cloth squares with a weave and a stitch' },
  { id: 'chips', name: 'Paint chips', line: 'One strip, the name on the colour' },
  { id: 'circles', name: 'Circles', line: 'Buttons in a row, the names under' },
  { id: 'ribbon', name: 'Ribbon', line: 'One band splitting into the colours' },
];

export function isPaletteLookId(v: unknown): v is PaletteLookId {
  return typeof v === 'string' && (PALETTE_LOOK_IDS as readonly string[]).includes(v);
}

/**
 * THE LOOK THE PALETTE IS DRAWN IN — the pick when it is one of the five, else
 * Tags. One resolver for the guest page and the Maker's dropdown, so the two
 * can never disagree about what an absent pick means.
 */
export function resolvePaletteLook(picked: unknown): PaletteLookId {
  const id = sanitizeSceneStyleId(picked);
  return isPaletteLookId(id) ? id : PALETTE_LOOK_DEFAULT;
}

/**
 * Is "Our colours" drawn in the look, under this Dress code LAYOUT (the scene's
 * resolved `canvas.style`)? "The palette" and "The line" layouts draw the
 * colours their own way (bands, one strip), so offering the look there would be
 * a pick that changes nothing on the couple's canvas — the "failure that renders
 * like success" disease. Null = a stage with no layouts, which draws the shipped
 * Colours and roles. The Maker's Palette row shows only where this is true.
 */
export function layoutDrawsPaletteLook(layout: string | null | undefined): boolean {
  return layout == null || layout === 'colours-and-roles';
}
