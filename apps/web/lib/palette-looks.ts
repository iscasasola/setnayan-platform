/**
 * 🎨 THE PALETTE LOOKS — how the Dress code scene draws "Our colours" (five shipped 2026-09-30, three more
 * 2026-10-15; the globals.css block keeps its first name, "THE FIVE PALETTE LOOKS", as its anchor).
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
 *   · fabric   — pinked cloth. REDRAWN 2026-10-15 as the silk swatch (a tall
 *                pinked rectangle with silk folds, the name above) — same id,
 *                so a page that picked it keeps its pick.
 *   · chips    — one paint-store strip, the name ON the colour.
 *   · circles  — overlapping buttons in one row, the names under.
 *   · ribbon   — one notched band splitting into the colours.
 *
 * Owner, 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS" (2)) on
 * `prototypes/palette_styles_2026-10-15_fable.html`: *"palette keep Watercolour,
 * Arch tabs, Paint strokes, redraw Fabric as Silk, drop Script circles, no hex"*:
 *
 *   · arch        — tall tabs rounded at the foot, edge to edge, a sprig, the
 *                   name at the foot in spaced caps. NO hex (the 2026-09-30
 *                   "a colour is said by name" rule stands).
 *   · watercolour — painted dots with a roughened edge, the name under each in
 *                   the page's own ink.
 *   · strokes     — glossy paint strokes cascading down the page, the name on
 *                   each stroke's left end.
 *
 * Every look is FREE (a pick from a dropdown — nothing typed, uploaded or
 * tuned) and STILL: the design's per-look entrances were cut by the owner on
 * 2026-09-30 (DECISION_LOG "THE MAKER RE-PLAN IS CUT TO ITS CORE" — "palette
 * animation" removed).
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

export const PALETTE_LOOK_IDS = ['tags', 'fabric', 'chips', 'circles', 'ribbon', 'arch', 'watercolour', 'strokes'] as const;
export type PaletteLookId = (typeof PALETTE_LOOK_IDS)[number];

/**
 * 🖼 THE PALETTE LOOK'S MINIATURE (owner 08 Oct: *"palette should show the actual previews like the other
 * styles"*). A look card is the guest page asked for one scene in one style (`?style=<type>:<id>`,
 * `app/[slug]/_lib/style-preview.ts`); the palette look is not the scene's `canvas.style` but its
 * `canvas.palette`, so its cards ask under THIS type and the page lays the id on `canvas.palette`. Host canvas
 * only, nothing written. Not a registry type — no scene is ever stored under it.
 */
export const PALETTE_LOOK_PREVIEW_TYPE = 'dress_code_palette';
/** The block of the Dress code scene a palette look's card is fitted on — "Our colours" (`dress-code-widget.tsx`). */
export const PALETTE_LOOK_CARD_FOCUS = '[data-dress-code="ours"]';

/** Absent = this. Today's look — a live page that never picked does not change. */
export const PALETTE_LOOK_DEFAULT: PaletteLookId = 'tags';

export type PaletteLook = {
  id: PaletteLookId;
  /** The dropdown's word for it. */
  name: string;
  /** One line under the name: what it looks like. */
  line: string;
};

/** In the dropdown's order — the 2026-09-29 prototype's A to E, then the 2026-10-15 three (its "Delta to build" order). */
export const PALETTE_LOOKS: readonly PaletteLook[] = [
  { id: 'tags', name: 'Tags', line: 'Tall tags on a pin, the name under each' },
  { id: 'fabric', name: 'Silk swatches', line: 'Pinked silk, the name above each' },
  { id: 'chips', name: 'Paint chips', line: 'One strip, the name on the colour' },
  { id: 'circles', name: 'Circles', line: 'Buttons in a row, the names under' },
  { id: 'ribbon', name: 'Ribbon', line: 'One band splitting into the colours' },
  { id: 'arch', name: 'Arch tabs', line: 'Tall tabs, the name at the foot' },
  { id: 'watercolour', name: 'Watercolour dots', line: 'Painted dots, the names under' },
  { id: 'strokes', name: 'Paint strokes', line: 'Glossy strokes down the page (best up to six colours)' },
];

export function isPaletteLookId(v: unknown): v is PaletteLookId {
  return typeof v === 'string' && (PALETTE_LOOK_IDS as readonly string[]).includes(v);
}

/**
 * THE LOOK THE PALETTE IS DRAWN IN — the pick when it is one of the looks, else
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
