/**
 * lib/maker-stage-room.ts — 📏 THE STAGES PANEL'S ROOM ON A PHONE (the new Maker,
 * `makerStagesStudioEnabled`; `launch/_components/stage-tools.tsx`).
 *
 * Owner, 2026-10-09 (`TOOLBAR-SPEC-2026-10-09.md`, the approved prototype `studio-head-prototype.html`): the
 * toolbar is ONE FIXED HEIGHT — "330 px it is" on a tall phone — a handle, "You're editing · Stage › Page ›
 * Part", the selector Edit | Style | Background | Animate with ▶, and FOUR ROWS. (It was one row that rose to
 * half the screen when a part was picked — 2026-10-06 — and was dragged between the two.) Every control in it
 * is at least Apple's 44 px (DECISION_LOG "ONE HEIGHT: 44").
 *
 * The class strings live here, not in the component, so the guards
 * (`lib/the-stage-panel-fits-a-phone.test.ts`, `lib/the-toolbar-is-four-rows.test.ts`) measure the SAME strings
 * the toolbar draws (`phoneHeightPx`, `lib/maker-phone-room.ts`). Pure; imported only by the lazy Stages panel
 * and the tests.
 */

/**
 * 🎨 THE PROTOTYPE'S OWN COLOURS (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `:root`), set once on the Maker shell while the Stages panel is drawn (`stage-tools.tsx`)
 * and read by every string below as `var(--sp-…)` — the panel is the prototype's, not a
 * reinterpretation (DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE").
 *
 * 🎯 WHAT IS ON, PICKED OR TAPPABLE IS THE APP'S ACCENT — NOT A COLOUR WRITTEN HERE (owner 2026-10-08: *"if we change
 * our color to blue, it will be easy to change the button colors"*, `INTERACTION_RULES.md` § 9). `--sp-cta` and its
 * wash READ `--sn-accent` (`globals.css`), and `--sp-bad` reads the house danger token (`--color-danger`): the picked
 * card's ring, the colour circle's ring, the slider's fill and every `var(--sp-cta)` in the panel follow the one
 * setting. The thirteen left are NEUTRALS and the gold — grounds, inks and hairlines, never "on":
 * page · paper · ink · ink2 · mute · gold · gold-soft · gold-wash · line · line2 · pill · pill-on · ok.
 * Held by `lib/the-stages-panel-wears-the-accent.test.ts`.
 */
export const STAGE_PANEL_VARS =
  '--sp-page:#F3F0EA;--sp-paper:#FFFFFF;--sp-ink:#2C2A29;--sp-ink2:#5A5755;--sp-mute:#8A8580;--sp-gold:#A9834B;' +
  '--sp-gold-soft:#E6D8BE;--sp-gold-wash:#F8F3E9;--sp-cta:rgb(var(--sn-accent));--sp-cta-wash:rgb(var(--sn-accent) / .1);--sp-line:#E6E1D8;' +
  '--sp-line2:#D9D3C8;--sp-pill:#F1EEE8;--sp-pill-on:#D8D3CA;--sp-ok:#2F6B4F;--sp-bad:rgb(var(--color-danger))';

/** The selector's band — [ Edit | Style | Background | Animate ] · ▶ (prototype `.tools`: 52 px, the 44-px pill and ▶ in its middle, 10 px apart). */
export const STAGE_ROW = 'flex h-[52px] shrink-0 items-center gap-2.5';
/** ▶ — a 44 px tap; the prototype's 40 px round is its inner `STAGE_ICON_FACE`. */
export const STAGE_ICON_BUTTON = 'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--sp-ink)]';
export const STAGE_ICON_FACE =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)]';
/** The stage ▾ pill (prototype `.ddp`: caps, a gold chevron, open = gold ring). */
export const STAGE_ITEM_BUTTON =
  'sn-press inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)] px-3 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--sp-ink)] transition-[box-shadow,border-color,background-color] duration-150 aria-expanded:border-[var(--sp-gold)] aria-expanded:bg-white aria-expanded:shadow-[0_0_0_2px_var(--sp-gold-soft)]';
/**
 * The Edit | Style | Background | Animate selector (prototype `.tsel`: white, 44 px, a hairline round it) — owner
 * 2026-10-09, verbatim: *"so it is just Edit | Style | Background | Animate"*. WORDS ONLY, each tool AS WIDE AS ITS
 * WORD (`flex-auto` — the row's spare room is shared out, a long word is never cut to a third), the track taking the
 * row left of ▶ (301 px of a 375 phone).
 * 🎚 A PILL SELECTOR WHOSE THUMB SLIDES (owner 2026-10-08: *"apply the same pill selector"*; DECISION_LOG "SELECTORS
 * ARE PILLS THAT SLIDE"): the track wears the app's thumb (`app/_components/pill-thumb.tsx`, `group/seg relative`),
 * so the face TRAVELS from one tool to the next — and changes WIDTH as it goes, to the word it lands on. ONE colour,
 * as every pill selector: the accent under a white word when a tool is on, grey words when off.
 */
export const STAGE_TOOL_PILL = 'group/seg relative flex h-11 min-w-0 flex-1 items-center rounded-full border border-[var(--sp-line)] bg-white';
/**
 * One of the four — 44 px tall to the thumb (`h-11`), never narrower than 44 (`min-w-11`), its pill clipped 3 px
 * inside (a transparent border — `STAGE_TOOL_INSET` tells the thumb the same 3 px). It paints the pill itself until
 * the thumb is laid, then hands the fill over (never a frame with none, never two).
 */
/* A tool with nothing to set on the picked part is GREY and still hears a tap (`aria-disabled`, never `disabled`): the tap says why. */
export const STAGE_TOOL_BUTTON =
  'sn-press relative z-[1] inline-flex h-11 min-w-11 flex-auto items-center justify-center whitespace-nowrap rounded-full border-[3px] border-transparent bg-clip-padding px-1 text-[13px] font-semibold text-[var(--sp-mute)] transition-colors duration-sn-pill ease-sn motion-reduce:transition-none aria-pressed:bg-sn-accent aria-pressed:text-sn-on-accent group-data-[seg-thumb]/seg:aria-pressed:bg-transparent aria-disabled:opacity-40';
/** The 3 px `STAGE_TOOL_BUTTON` keeps clear around its face (its `border-[3px]`) — what the thumb is laid inside. */
export const STAGE_TOOL_INSET = 3;
/** A row of the stage ▾ sheet (a stage, or one of its pages). */
export const STAGE_SHEET_ROW =
  'sn-press flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:text-ink/40';
/** A page of the guest's tab bar under the page preview (prototype `.gbar button`: words only, 44 px). */
export const STAGE_GUEST_TAB =
  'sn-press relative flex h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap px-1 text-[12px] font-semibold text-[var(--sp-mute)] aria-[current=page]:text-[var(--sp-ink)]';

/* ── 📐 THE TOOLBAR'S FRAME (owner 2026-10-09: *"make toolbar just the lower third"* → *"maybe increase it a bit more
   just enough to place 4 clean rows"* → *"330 px it is"*; `TOOLBAR-SPEC-2026-10-09.md`) ──────────────────────────────
   A FIXED height, top to bottom: the handle 14 · "You're editing · Stage › Page › Part" 20 · the selector's band 52 ·
   FOUR ROWS · the room under the last row. Rows are 48 px with 6-px gaps on a tall phone (4 × 48 + 3 × 6 = 210) and
   44 / 4 on a short one (188) — a control is 44 px either way, centred in its row. The room under the last row is the
   phone's own safe area and never under 10 px (*"make sure we have space away from the switch screen line"*):
   14 + 20 + 52 + 210 + 34 = 330 on an iPhone. Nothing here is dragged, folded or scrolled up and down. */
export const STAGE_BAR_HANDLE_PX = 14;
export const STAGE_BAR_LINE_PX = 20;
export const STAGE_BAR_BAND_PX = 52;
/** Under this many px of screen height a phone is SHORT: 44-px rows, 4-px gaps. */
export const STAGE_BAR_SHORT_PX = 740;
/** The least room kept under the last row (a phone with no home indicator). */
export const STAGE_BAR_FOOT_PX = 10;
export const STAGE_BAR_ROWS = 4;
/** A row and the gap between two, on a screen this tall. */
export function stageBarRow(viewportH: number): { row: number; gap: number } {
  return viewportH < STAGE_BAR_SHORT_PX ? { row: 44, gap: 4 } : { row: 48, gap: 6 };
}
/** The four rows and their three gaps. */
export function stageBarGridPx(viewportH: number): number {
  const { row, gap } = stageBarRow(viewportH);
  return STAGE_BAR_ROWS * row + (STAGE_BAR_ROWS - 1) * gap;
}
/** The whole toolbar, from its curved top to the screen's edge — `safeBottom`: the phone's `env(safe-area-inset-bottom)` in px. */
export function stageBarPx(viewportH: number, safeBottom: number): number {
  return STAGE_BAR_HANDLE_PX + STAGE_BAR_LINE_PX + STAGE_BAR_BAND_PX + stageBarGridPx(viewportH) + Math.max(STAGE_BAR_FOOT_PX, safeBottom);
}
/**
 * The frame's two measures as CSS (`--sp-rh` a row, `--sp-rg` a gap) — the SAME numbers as `stageBarRow`, said to the
 * stylesheet so the first paint needs no script (a short phone is a media query).
 */
export const STAGE_BAR_ROW_VARS =
  `html:has([data-stage-tools]){--sp-rh:${stageBarRow(STAGE_BAR_SHORT_PX).row}px;--sp-rg:${stageBarRow(STAGE_BAR_SHORT_PX).gap}px}` +
  `@media (max-height:${STAGE_BAR_SHORT_PX - 0.02}px){html:has([data-stage-tools]){--sp-rh:${stageBarRow(0).row}px;--sp-rg:${stageBarRow(0).gap}px}}`;
/** The four rows' height, in CSS. */
export const STAGE_BAR_GRID_CSS = `calc(${STAGE_BAR_ROWS} * var(--sp-rh) + ${STAGE_BAR_ROWS - 1} * var(--sp-rg))`;
/** The room under the last row, in CSS. */
export const STAGE_BAR_FOOT_CSS = `max(${STAGE_BAR_FOOT_PX}px, env(safe-area-inset-bottom))`;
/** The handle: the prototype's 40 × 4 pill in a 14 px strip. Drawn, never pressed — the toolbar is one height. */
export const STAGE_BAR_HANDLE = 'flex h-[14px] shrink-0 items-center justify-center';
/** "You're editing · Stage › Page › Part" — one line of small caps, never wrapped (prototype `.edit`). */
export const STAGE_BAR_LINE =
  'h-5 shrink-0 truncate px-2 pb-2 pt-0.5 text-center text-[9.5px] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--sp-mute)]';
/** …kept clear of the ⓘ when the picked part has one — on both sides, so its words stay in the middle. */
export const STAGE_BAR_LINE_ABOUT = '!px-11';
/** The words that open the line. */
export const STAGE_BAR_LINE_LEAD = 'You’re editing';
/**
 * ✂ THE LINE IS SHORTENED FROM THE FRONT — THE PART'S NAME IS ALWAYS WHOLE (owner's review, 2026-10-09: at 375 it
 * read "YOU'RE EDITING · INVITATION › WELCOME › N…" — the one word that matters was the one cut). `pieces` are the
 * stage, the page and the part, in that order (those there are). Level 0 is the whole line; each level after drops
 * one thing from the FRONT: first "You're editing ·", then the stage, then the page — the last piece is never
 * dropped. The toolbar steps a level down while the line does not fit (`stage-tools.tsx`).
 */
export function stageEditingLine(pieces: readonly string[], level: number): { lead: boolean; words: string } {
  const l = Math.max(0, Math.min(pieces.length, Math.floor(level)));
  return l === 0 ? { lead: true, words: pieces.join(' › ') } : { lead: false, words: pieces.slice(l - 1).join(' › ') };
}
/**
 * ⓘ The toolbar's ONE explanation: at the right end of the "You're editing" line, over the handle and the line (38 px
 * of the toolbar's top — it stops where the selector's band begins, so its tap never lies on ▶), 44 px wide.
 */
export const STAGE_BAR_ABOUT = 'absolute right-0.5 top-0 z-[2] inline-flex h-[38px] w-11 items-start justify-center';
/**
 * 🧱 THE FOUR ROWS (prototype `.g4`): a grid of exactly four rows — *"the rule is always start from the top"*: a tool
 * fills from row 1, its empty rows are at the bottom, nothing is centred up and down and nothing scrolls up and down
 * (a fifth row has no height: `auto-rows-[0]`). A cards strip may swipe sideways inside its own rows.
 */
export const SP_ROWS = 'grid min-h-0 grid-rows-[repeat(4,var(--sp-rh))] auto-rows-[0] gap-y-[var(--sp-rg)] overflow-hidden';
/** One of the four rows: its controls side by side, 44 px tall, in the row's middle. */
export const SP_ROWS_ROW = 'flex min-w-0 items-center gap-2';

/* ── 🎠 STYLE'S LOOK CARDS IN THE TOOLBAR (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § STYLE, the approved
   prototype's `.cr` / `.lc`: *"maximize the height … portrait"*, long one-line text up to 60 % width, the picked
   one centred with the previous and the next in view, each picture centred and scaled to fit, never cut) ──────────
   The cards strip takes the rows left to it (rows 1–3 beside Colour + Size, 1–2 over the Dress code's palette, all
   four where the part has neither) and a card is AS TALL AS THE STRIP — the one phone-shaped frame (`.sn-phone-card`,
   3 : 4) at the rows' height instead of its fixed 112 × 149. A look that draws ONE LONG LINE gets a wider card
   (60 % of the toolbar's inner width) so its words are read, not squeezed. The Reveal, the Camera, the pass and the
   Themes keep the 2026-10-08 card (`SP_LOOK_CARD`). */
/** The pane the scene's Format is laid in under Style: no scroll up and down, a row's gap between its rows. */
export const SP_STYLE_PANE = 'flex h-full min-h-0 flex-col gap-[var(--sp-rg)] overflow-hidden px-[10px]';
/**
 * The strip: edge to edge of the toolbar, swiped sideways only, a card snapping to its middle.
 * 🫧 A ROW'S GAP ABOVE THE CARDS (seen on the review copy, 2026-10-09: the cards' top edge touched the selector's
 * band and the picked card's ring and top corners were cut): the cards start one gap (`--sp-rg`) under the band, as
 * every row stands one gap from the next — `STAGE_STRIP_RING_PX` of it is the strip's own padding, which is the room
 * the ring is drawn in; below, the strip reaches the same 4 px into the gap under it. So the ring is whole all round.
 */
export const STAGE_STRIP_RING_PX = 4;
export const SP_STYLE_STRIP =
  '-mx-[10px] -mb-1 mt-[calc(var(--sp-rg)_-_4px)] flex min-h-0 min-w-0 flex-1 snap-x snap-mandatory items-stretch gap-2 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/**
 * A card: the phone-shaped frame at the strip's height (its width follows, 3 : 4), white, a hairline round it, its
 * picture over its name. Picked, it wears the picture tile's ONE ring (`SP_BG_TILE_FACE`, owner-approved: 2 px of the
 * toolbar's ground, then 2 px of the accent — 4 px in all, the room the strip keeps: `STAGE_STRIP_RING_PX`) and
 * nothing else; it was an accent hairline with a soft wash round it, a second drawing of "picked". `data-wide`: one
 * long line of words — as tall, 60 % of the toolbar's inner width.
 */
export const SP_STYLE_CARD =
  'sn-press sn-phone-card group !flex !h-full ![inline-size:auto] snap-center flex-col border border-[var(--sp-line)] bg-white text-left ' +
  'aria-checked:shadow-[0_0_0_2px_var(--sp-page),0_0_0_4px_var(--sp-cta)] ' +
  'data-[wide]:![aspect-ratio:auto] data-[wide]:![inline-size:calc((100%_-_20px)_*_0.6)]';
/** The share of the toolbar's inner width a one-line look's card takes — the spec's "up to 60 %". */
export const SP_STYLE_CARD_WIDE = 0.6;
/**
 * What a part draws — its words, its drawing — at least this many times wider than tall is ONE LONG LINE (the Title,
 * the Date, the Names in a row). Measured on what it DRAWS, not on its block: a logo stands in a block as wide as
 * the page and is no line of words (seen on the review copy, 2026-10-09: the Logo's cards came out wide).
 */
export const SP_STYLE_WIDE_ASPECT = 4;
export function styleCardIsWide(drawn: { w: number; h: number } | null | undefined): boolean {
  return Boolean(drawn && drawn.h > 0 && drawn.w / drawn.h >= SP_STYLE_WIDE_ASPECT);
}
/** The card's picture: all the card above its name. */
export const SP_STYLE_PICTURE = 'relative block min-h-0 w-full flex-1 overflow-hidden';
/** The card's name: one line in a 22 px foot (prototype `.nm`), cut with …; the picked one in the accent. */
export const SP_STYLE_NAME =
  'block h-[22px] w-full shrink-0 truncate border-t border-[var(--sp-line)] bg-[var(--sp-page)] px-1 text-center text-[10.5px] font-medium leading-[21px] text-[var(--sp-ink2)] group-aria-checked:font-semibold group-aria-checked:text-[var(--sp-cta)]';
/** Room kept between a picture and its card's edge (the prototype's 6 px a side). */
export const SP_STYLE_PICTURE_PAD = 6;
/**
 * 🖼 A PICTURE IS CENTRED AND SCALED TO FIT — NEVER CUT (the prototype's `fitPreviews`): the part as the page draws
 * it, scaled by the smaller of what its width and its height allow (never enlarged), in the middle of the card.
 * `part` is the part's box on its page; the answer moves and scales the page so that box lands there.
 */
export function styleCardFit(
  part: { top: number; left: number; width: number; height: number },
  box: { w: number; h: number },
  pad: number = SP_STYLE_PICTURE_PAD,
): { k: number; x: number; y: number } {
  const k = Math.min((box.w - 2 * pad) / Math.max(1, part.width), (box.h - 2 * pad) / Math.max(1, part.height), 1);
  const s = Math.max(0.01, k);
  return { k: s, x: (box.w - part.width * s) / 2 - part.left * s, y: (box.h - part.height * s) / 2 - part.top * s };
}
/**
 * 🎨 THE DRESS CODE'S PALETTE ROW (owner 2026-10-09: *"row 3 is palette style"* — Tags · Fabric swatches · Paint
 * chips · Circles · Ribbon, `lib/palette-looks.ts`): five equal buttons in one row, each the couple's colours drawn
 * in that look. 44 px; the picked one wears the accent's line and ring.
 */
export const SP_PALETTE_ROW = 'flex h-[var(--sp-rh)] shrink-0 items-center gap-1.5';
export const SP_PALETTE_PICK =
  'sn-press flex h-11 min-w-0 flex-1 items-stretch justify-center overflow-hidden rounded-lg border border-[var(--sp-line)] bg-white aria-checked:border-[var(--sp-cta)] aria-checked:shadow-[0_0_0_1px_var(--sp-cta),0_0_0_3px_var(--sp-cta-wash)] ' +
  /* The picture fills the button — one frame, not the dropdown thumbnail's small box inside a second one — and its
     marks are drawn half as large again, to be read at a glance. */
  '[&>[data-palette-thumb]]:!h-auto [&>[data-palette-thumb]]:!w-full [&>[data-palette-thumb]]:!rounded-none [&>[data-palette-thumb]]:!shadow-none [&>[data-palette-thumb]>*]:scale-150';
/* ── 🖼 BACKGROUND'S FOUR ROWS (owner 2026-10-09: *"copy the background on studio look"*; `TOOLBAR-SPEC-2026-10-09.md`
   § BACKGROUND) — row 1 the source ▾, row 2 that source's choices as ONE row of small pictures (the prototype's
   `.gs` / `.gt`), row 3 the choice's one control, row 4 its shape. ── */
/** Row 2: the choices, swiped sideways, edge to edge of the toolbar. */
export const SP_BG_STRIP =
  '-mx-[10px] flex h-full min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden px-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/**
 * 🖼 ONE CHOICE — A PICTURE TILE (owner 2026-10-09: *"A- picture tiles"*, `review/bg-tiles.html`). The BUTTON is the
 * 44-px tap; what is seen is its FACE: 84 px wide at the least and 10 px shorter than the row (38 px, 34 on a short
 * phone), so the picked one's ring — 2 px of the toolbar's ground, then 2 px of the accent — sits INSIDE the row and
 * is never cut. One ring, nothing else: no inner border, no second outline.
 */
export const SP_BG_TILE = 'sn-press group/tile relative flex h-11 shrink-0 items-center justify-center rounded-xl';
export const SP_BG_TILE_RING_PX = 4;
export const SP_BG_TILE_FACE =
  'relative flex h-[calc(var(--sp-rh)_-_10px)] min-w-[84px] items-end justify-center overflow-hidden rounded-xl bg-white bg-cover bg-center px-2 pb-1 outline outline-1 -outline-offset-1 outline-[rgba(44,42,41,.12)] group-aria-pressed/tile:shadow-[0_0_0_2px_var(--sp-page),0_0_0_4px_var(--sp-cta)]';
/** Its name, written ON the tile at its foot — 12 px semibold, one line, never on a plate of its own. */
export const SP_BG_TILE_NAME = 'relative z-[1] whitespace-nowrap text-[12px] font-semibold leading-[14px]';
/** The name's two tones (`lib/bg-tile-name.ts` decides which, per tile), each with the reference's soft shadow of the other. */
export const SP_BG_TILE_TONE = { white: 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,.45)]', ink: 'text-[var(--sp-ink)] [text-shadow:0_1px_2px_rgba(255,255,255,.55)]' } as const;
/**
 * A PHOTO's foot fade — light (35 %) and the bottom half only, so the picture stays the picture: flat under the
 * name, gone by the middle. Dark under a white name, light under an ink one. A colour tile has NONE: its swatch is
 * exactly what the page draws.
 */
export const SP_BG_TILE_FADE = {
  white: 'pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.35)_0_34%,transparent_50%)]',
  ink: 'pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,.35)_0_34%,transparent_50%)]',
} as const;
/** "None": a white tile with one thin stroke across it. */
export const SP_BG_TILE_SLASH = 'pointer-events-none absolute left-[26px] right-[26px] top-[10px] -rotate-[18deg] border-t-[1.5px] border-[var(--sp-line)]';
/** "＋ Upload" keeps the template's add look: a white face, the accent's plus, the word in ink. */
export const SP_BG_TILE_ADD = '!items-center !pb-0 gap-1 text-[13px] font-semibold text-[var(--sp-ink)]';
/** Row 3 / row 4: a label, then its control. */
export const SP_BG_ROW = 'flex h-full min-w-0 items-center gap-2';
/** A quiet line in a row ("Uses the Event Hub's own background."). */
export const SP_BG_QUIET = 'truncate px-1 text-[14px] font-medium text-[var(--sp-mute)]';

/** Style's last row: Colour (one circle) and Size (a slider) side by side — *"color and size share the same row"*. */
export const SP_LOOK_ROW = 'flex h-full min-w-0 items-center gap-2';
export const SP_LOOK_ROW_LABEL = 'shrink-0 text-[13px] font-medium text-[var(--sp-ink)]';

/* ── the panel's body (`stage-panel/*`) — every row ONE height, 44 px (owner 2026-10-06 "keep all rows consistent in height") ── */

/** A tool's column (prototype `.pane`): rows 8 px apart, scrolls only when a tool is longer than half the screen. */
export const SP_PANE = 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-[10px] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/**
 * The segmented control (Look | Background | Arrange · Build in | Action | Build out) — prototype `.sub.phases`.
 * 🎚 A FULL PILL WHOSE THUMB SLIDES (owner 2026-10-08, selecting it: *"apple the same pill selector"*; DECISION_LOG
 * "SELECTORS ARE PILLS THAT SLIDE"): the app's track shape (`group/seg relative … rounded-full p-[3px]`, as
 * `PILL_TRACK_CLASS`) on the panel's own ground, 44 px tall, with the app's thumb inside (`Phases`, `stage-panel/kit.tsx`).
 */
export const SP_PHASES = 'group/seg relative flex h-11 w-full min-w-0 shrink-0 rounded-full bg-[rgba(44,42,41,.07)] ring-1 ring-inset ring-[var(--sp-line2)]';
/**
 * One segment: 44 px to the finger (`h-11` — the panel's own rule, `the-stage-panel-fits-a-phone`), its white pill
 * clipped 3 px inside (a transparent border), so the face is the 38-px pill of the app's selector. `SP_PHASE_INSET`
 * tells the thumb the same 3 px. It paints the pill itself until the thumb is laid, then hands the fill over.
 */
export const SP_PHASE =
  'sn-press relative z-[1] flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border-[3px] border-transparent bg-clip-padding text-[13px] font-semibold text-[var(--sp-mute)] transition-colors duration-sn-pill ease-sn motion-reduce:transition-none aria-pressed:bg-sn-accent aria-pressed:text-sn-on-accent group-data-[seg-thumb]/seg:aria-pressed:bg-transparent';
/** The 3 px `SP_PHASE` keeps clear around its face (its `border-[3px]`) — what the thumb is laid inside. */
export const SP_PHASE_INSET = 3;
/** A labelled dropdown row (prototype `.dd`: white pill, the small caps label, the value, a gold chevron). */
export const SP_DD = 'relative flex h-11 min-w-0 flex-1 items-center rounded-full bg-white pl-[14px] ring-1 ring-inset ring-[var(--sp-line)]';
/** The small caps word before a dropdown's value (prototype `.dd small`). */
export const SP_DD_LABEL = 'max-w-[48%] shrink-0 truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]';
/**
 * The shipped PickMenu inside `SP_DD` — transparent, the whole pill its tap. Its ▾ is the dropdown template's own
 * (`pickArrowClass`: the accent — owner 2026-10-08 *"Dropdown — Chevron should be teracota color?"*); nothing here
 * repaints it.
 */
export const SP_DD_BUTTON = 'h-11 !min-h-0 min-w-0 flex-1 !justify-between !rounded-full !bg-transparent !pl-1.5 !pr-3 !text-[14px] !font-medium';
/** A row of one label and its control (prototype `.r` / `.ar`). */
export const SP_ROW = 'flex h-11 shrink-0 items-center gap-2.5';
export const SP_ROW_LABEL = 'w-[70px] shrink-0 text-[13px] font-semibold text-[var(--sp-ink2)]';
/** An on / off switch — the app's ONE drawing (`SwitchTrack`, 50 × 30) on a 44 px tap. */
export const SP_SWITCH = 'sn-press relative inline-flex h-11 w-[50px] shrink-0 items-center';
/**
 * A colour CIRCLE (the approved gallery's kind 21, "the five colour circles" — owner 2026-10-08): a 32 px circle on a
 * 44 px tap. Picked, it wears the accent's ring with a gap of the panel's ground (`SP_SWATCH_ON`).
 */
export const SP_SWATCH = 'sn-press inline-flex h-11 min-w-0 max-w-[44px] flex-1 items-center justify-center';
/** The circle itself — `sn-press-ring` so a press rings it like every other template. */
export const SP_SWATCH_FACE = 'sn-press-ring relative block h-8 w-8 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_var(--sp-line2)]';
/** The picked circle: a gap of the panel's ground, then the accent (never a colour written here). */
export const SP_SWATCH_ON = '!shadow-[0_0_0_2px_var(--sp-page),0_0_0_4px_rgb(var(--sn-accent))]';
/** "+" — any colour: a dashed circle, its mark in the accent (the mark that says "you can tap this"). */
export const SP_SWATCH_MORE = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--sp-line2)] bg-white text-[16px] font-semibold leading-none text-sn-accent';
/** A layout card (prototype `.lcard`: 62% wide, the real miniature 104 px, its name 18 px). */
export const SP_LAYOUT_CARD = 'sn-press flex h-32 w-[62%] shrink-0 snap-center flex-col items-stretch gap-1.5 text-left';
/** The picture's height in a look card (`h-[104px]`). */
export const SP_CARD_PICTURE_PX = 104;
/**
 * A look card's WIDTH follows its picture (owner 2026-10-07: *"should not extend the element. it should just be the
 * size in proportion to the height"*): the row's fixed height × the picture's width/height — a portrait ticket is a
 * narrow card, a wide title a wide one, so more looks show per swipe. Null aspect (not measured yet) keeps 62 %.
 */
export function spCardWidth(aspect: number | null | undefined): { width: number } | undefined {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return undefined;
  return { width: Math.round(Math.min(280, Math.max(76, SP_CARD_PICTURE_PX * aspect + 4))) };
}
/**
 * 📱 EVERY STYLE CARD IS PHONE-SHAPED (owner 2026-10-08, DECISION_LOG "A BACKGROUND CARD IS PHONE-SHAPED",
 * widened: *"we are on mobile view, so show in mobile view, not like a header that is short and wide or at least
 * square or 4:3 or 3:4"* · *"on all style across the market hub"*). A look's picture is drawn in the ONE shared
 * frame — `globals.css` `.sn-phone-card` (3 : 4 portrait, a fixed width from `--phone-card-w`, never flexed) —
 * and the strip scrolls; a card never stretches with the panel. This supersedes the 62 % / follow-the-part card
 * (`SP_LAYOUT_CARD`, `spCardWidth`) for every look picker; `lib/every-style-card-is-phone-shaped.test.ts` walks
 * them. The frame's rule lives in the stylesheet alone — never copied here.
 */
export const SP_PHONE_CARD = 'sn-phone-card';
/** The frame as a look card's picture: the shared class, clipped, the page's ground behind it. */
export const SP_PHONE_PICTURE = `${SP_PHONE_CARD} relative block overflow-hidden rounded-lg bg-[var(--sp-page)]`;
/** A look card: the frame over its one-line name — exactly as wide as the frame (`w-min`), never a share of the row. */
export const SP_LOOK_CARD = 'sn-press flex min-h-11 w-min shrink-0 snap-center flex-col items-stretch gap-1.5 text-left';
/** The card's name under the frame: one line, cut to the frame's width (it never widens the card). */
export const SP_LOOK_NAME = 'block h-[18px] w-0 min-w-full truncate text-center text-[13px] font-semibold leading-[18px]';
/**
 * A card's name that must READ WHOLE (the Reveal's openings — "Four-flap envelope" is wider than the 112-px frame, and
 * with its ◆ Pro mark beside it the words were cut from BOTH ends: "r-flap envelope ◆ PR"; controller 2026-10-09:
 * *"the name must read whole … never clip a word"*). It takes a second line at a space or a hyphen, never mid-word
 * and never cut; it still never widens the card (`w-0 min-w-full`). The mark goes on its own line (`SP_LOOK_MARK`).
 */
export const SP_LOOK_NAME_WHOLE = 'block w-0 min-w-full whitespace-normal text-center text-[13px] font-semibold leading-[18px] [overflow-wrap:normal]';
/** The line under such a name that holds the card's mark (◆ Pro) — centred, as wide as the frame, 18 px. */
export const SP_LOOK_MARK = 'flex h-[18px] w-0 min-w-full items-center justify-center';

/** A pill in Background's third row (Gallery ▸ · Upload ◆) — a `.dd` that opens a sheet. */
export const SP_PILL_BUTTON =
  'sn-press flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-white pl-[14px] pr-3 text-left text-[14px] font-medium text-[var(--sp-ink)]';
/** ‹ › beside a row (Order) — prototype `.r2 .nb`. */
export const SP_STEP_BUTTON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--sp-line)] bg-white text-[var(--sp-ink)] disabled:opacity-35';
/** The keyboard's bar while typing on the page (prototype `#kbd .kbar`): "Typing · Names" · Done. */
export const SP_KEY_BAR = 'flex h-11 shrink-0 items-center justify-between border-t border-[var(--sp-line)] bg-white pl-[14px] pr-2 text-[13px] font-semibold text-[var(--sp-ink2)]';
export const SP_KEY_DONE = 'sn-press inline-flex h-11 items-center px-1';

/** Every class string a tap lands on, by name — the guard walks them all. */
export const STAGE_TAP_TARGETS = {
  STAGE_ROW,
  STAGE_ICON_BUTTON,
  STAGE_ITEM_BUTTON,
  STAGE_TOOL_PILL,
  STAGE_TOOL_BUTTON,
  STAGE_SHEET_ROW,
  STAGE_GUEST_TAB,
  SP_PHASES,
  SP_PHASE,
  SP_DD,
  SP_DD_BUTTON,
  SP_ROW,
  SP_SWITCH,
  SP_SWATCH,
  SP_LAYOUT_CARD,
  SP_PILL_BUTTON,
  SP_PALETTE_PICK,
  SP_BG_TILE,
  SP_STEP_BUTTON,
  SP_KEY_BAR,
  SP_KEY_DONE,
} as const;

/** How long the toolbar takes to slide away for ▶ and typing, and back (the prototype's 240 ms). */
export const STAGE_PANEL_MS = 240;

/**
 * 🖼 THE PICKED PART'S FRAME, BETWEEN ITS NEIGHBOURS (owner 2026-10-07: the Logo's frame and ＋ sat ON "TOGETHER WITH
 * THEIR FAMILIES" — "the frame hugs its part's real box, the ＋ sits in the gap BETWEEN parts and never over another
 * part's content, and a tap on another part's visible text always picks that part"). Each edge sits at most `pad` px
 * out, and never past the MIDDLE of the gap to the neighbour on that side; a control on that edge is at most as tall
 * as the gap (never under 26 px, the ＋'s own face), so its tap stops where the neighbour's words begin.
 * `gapAbove` / `gapBelow` null: nothing drawn on that side (the page's own margin) — the full pad and a 44 px tap.
 */
export function partFrameEdges(
  box: { top: number; height: number },
  gapAbove: number | null,
  gapBelow: number | null,
  pad = 22,
): { top: number; bottom: number; tapAbove: number; tapBelow: number } {
  const half = (g: number | null) => (g === null ? pad : Math.max(0, Math.min(pad, g / 2)));
  const tap = (g: number | null) => (g === null ? 44 : Math.max(26, Math.min(44, g)));
  return { top: box.top - half(gapAbove), bottom: box.top + box.height + half(gapBelow), tapAbove: tap(gapAbove), tapBelow: tap(gapBelow) };
}
