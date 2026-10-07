/**
 * lib/maker-stage-room.ts — 📏 THE STAGES PANEL'S ROOM ON A PHONE (the new Maker,
 * `makerStagesStudioEnabled`; `launch/_components/stage-tools.tsx`).
 *
 * Owner, 2026-10-06 (the approved prototype; DECISION_LOG "ONE HEIGHT: 44"): the
 * panel is ONE row while nothing is picked — the stage ▾, Style | Text | Animate,
 * ▶ — over the strip of the page's parts, and rises to HALF the screen, never
 * more, when a part is picked (PR 1's `MAKER_LT_HALF`, `lib/maker-lt-size.ts`).
 * Every control in it is at least Apple's 44 px.
 *
 * The class strings live here, not in the component, so the guard
 * (`lib/the-stage-panel-fits-a-phone.test.ts`) measures the SAME strings the
 * panel draws (`phoneHeightPx`, `lib/maker-phone-room.ts`). Pure; imported only
 * by the lazy Stages panel and the test.
 */
import { makerLtClampPx } from './maker-lt-size';

/**
 * 🎨 THE PROTOTYPE'S OWN COLOURS (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `:root`), set once on the Maker shell while the Stages panel is drawn (`stage-tools.tsx`)
 * and read by every string below as `var(--sp-…)` — the panel is the prototype's, not a
 * reinterpretation (DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE").
 */
export const STAGE_PANEL_VARS =
  '--sp-page:#F3F0EA;--sp-paper:#FFFFFF;--sp-ink:#2C2A29;--sp-ink2:#5A5755;--sp-mute:#8A8580;--sp-gold:#A9834B;' +
  '--sp-gold-soft:#E6D8BE;--sp-gold-wash:#F8F3E9;--sp-cta:#C24E25;--sp-cta-wash:#FBEDE6;--sp-line:#E6E1D8;' +
  '--sp-line2:#D9D3C8;--sp-pill:#F1EEE8;--sp-pill-on:#D8D3CA;--sp-ok:#2F6B4F;--sp-bad:#B3261E';

/** The panel's one row — [ stage ▾ ] · [ Style | Text | Animate ] · ▶ (prototype `.row1`, 44 px, gap 6). */
export const STAGE_ROW = 'flex h-11 shrink-0 items-center gap-1.5';
/** ▶ — a 44 px tap; the prototype's 40 px round is its inner `STAGE_ICON_FACE`. */
export const STAGE_ICON_BUTTON = 'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--sp-ink)]';
export const STAGE_ICON_FACE =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)]';
/** The stage ▾ pill (prototype `.ddp`: caps, a gold chevron, open = gold ring). */
export const STAGE_ITEM_BUTTON =
  'sn-press inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-[var(--sp-pill)] px-3 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--sp-ink)] transition-[box-shadow,border-color,background-color] duration-150 aria-expanded:border-[var(--sp-gold)] aria-expanded:bg-white aria-expanded:shadow-[0_0_0_2px_var(--sp-gold-soft)]';
/** The Style | Text | Animate pill (prototype `.tpill`, white, 44 px). */
export const STAGE_TOOL_PILL = 'inline-flex h-11 shrink-0 items-center rounded-full border border-[var(--sp-line)] bg-white';
/** One of Style | Text | Animate — 44 px tall to the thumb; its 46 × 38 face (`STAGE_TOOL_FACE`) is the prototype's `.tb`. */
export const STAGE_TOOL_BUTTON = 'sn-press group inline-flex h-11 w-[46px] items-center justify-center text-[var(--sp-ink2)] disabled:opacity-30';
export const STAGE_TOOL_FACE =
  'inline-flex h-[38px] w-[46px] items-center justify-center rounded-full transition-colors duration-[240ms] group-aria-pressed:bg-[var(--sp-ink)] group-aria-pressed:text-white';
/** A part's tile in the strip (shown only when the panel is dragged taller with nothing picked — prototype `.th`). */
export const STAGE_PART_TILE =
  'sn-press flex h-[124px] w-[104px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--sp-line)] bg-[#FBF9F5] text-center text-[12.5px] text-[var(--sp-ink2)] aria-pressed:border-[var(--sp-cta)]';
/** A row of the stage ▾ sheet (a stage, or one of its pages). */
export const STAGE_SHEET_ROW =
  'sn-press flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:text-ink/40';
/**
 * Style › Look's ONE quiet dark bar (prototype `.pane>.jump`: ink, white words, 44 px) —
 * "Edit in Studio › Info · or tap the words ›", "Edit the E-Gifts · Studio ›". The
 * Suppliers line (`STAGE_QUIET_SUPPLIERS`) wears the CTA wash.
 */
export const STAGE_QUIET_ROW =
  'sn-press flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--sp-ink)] bg-[var(--sp-ink)] px-[14px] text-left text-[14px] font-semibold text-white';
export const STAGE_QUIET_SUPPLIERS =
  'sn-press flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#F0D3C7] bg-[var(--sp-cta-wash)] px-[14px] text-left text-[14px] font-semibold text-[var(--sp-ink)]';
/** A page of the guest's tab bar under the page preview (prototype `.gbar button`: words only, 44 px). */
export const STAGE_GUEST_TAB =
  'sn-press relative flex h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap px-1 text-[12px] font-semibold text-[var(--sp-mute)] aria-[current=page]:text-[var(--sp-ink)]';

/* ── the panel's body (`stage-panel/*`) — every row ONE height, 44 px (owner 2026-10-06 "keep all rows consistent in height") ── */

/** A tool's column (prototype `.pane`): rows 8 px apart, scrolls only when a tool is longer than half the screen. */
export const SP_PANE = 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-[10px] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/** The segmented control (Look | Background | Arrange · Build in | Action | Build out) — prototype `.sub.phases`. */
export const SP_PHASES = 'flex h-11 w-full shrink-0 rounded-[10px] bg-[rgba(44,42,41,.07)] ring-1 ring-inset ring-[var(--sp-line2)]';
/** One segment: 44 px to the thumb, its white face clipped 3 px inside (the prototype's 2 px padding). */
export const SP_PHASE =
  'sn-press flex h-11 min-w-0 flex-1 items-center justify-center rounded-[11px] border-[3px] border-transparent bg-clip-padding text-[13px] font-semibold text-[var(--sp-ink2)] transition-colors duration-[240ms] aria-pressed:bg-white aria-pressed:text-[var(--sp-ink)] aria-pressed:shadow-[inset_0_0_0_1px_rgba(0,0,0,.04)]';
/** A labelled dropdown row (prototype `.dd`: white pill, the small caps label, the value, a gold chevron). */
export const SP_DD = 'relative flex h-11 min-w-0 flex-1 items-center rounded-full bg-white pl-[14px] ring-1 ring-inset ring-[var(--sp-line)]';
/** The small caps word before a dropdown's value (prototype `.dd small`). */
export const SP_DD_LABEL = 'max-w-[48%] shrink-0 truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]';
/** The shipped PickMenu inside `SP_DD` — transparent, the whole pill its tap. */
export const SP_DD_BUTTON =
  'h-11 !min-h-0 min-w-0 flex-1 !justify-between !rounded-full !bg-transparent !pl-1.5 !pr-3 !text-[14px] !font-medium [&>svg]:!text-[var(--sp-gold)]';
/** A row of one label and its control (prototype `.r` / `.ar`). */
export const SP_ROW = 'flex h-11 shrink-0 items-center gap-2.5';
export const SP_ROW_LABEL = 'w-[70px] shrink-0 text-[13px] font-semibold text-[var(--sp-ink2)]';
/** An on / off switch (prototype `.sw`, 54 × 32 face) on a 44 px tap. */
export const SP_SWITCH = 'sn-press relative inline-flex h-11 w-[54px] shrink-0 items-center';
/** A direction (← → ↓ ↑) — prototype `.dir`, 40 × 38 face on a 44 px tap. */
export const SP_DIR = 'sn-press inline-flex h-11 w-10 items-center justify-center';
/** A colour swatch — prototype `.swatch`, 36 px face on a 44 px tap. */
export const SP_SWATCH = 'sn-press inline-flex h-11 min-w-0 max-w-[44px] flex-1 items-center justify-center';
/** A layout card (prototype `.lcard`: 62% wide, the real miniature 104 px, its name 18 px). */
export const SP_LAYOUT_CARD = 'sn-press flex h-32 w-[62%] shrink-0 snap-center flex-col items-stretch gap-1.5 text-left';
/** A pill in Background's third row (Gallery ▸ · Upload ◆) — a `.dd` that opens a sheet. */
export const SP_PILL_BUTTON =
  'sn-press flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-white pl-[14px] pr-3 text-left text-[14px] font-medium text-[var(--sp-ink)]';
/** ‹ › beside a row (Order) — prototype `.r2 .nb`. */
export const SP_STEP_BUTTON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--sp-line)] bg-white text-[var(--sp-ink)] disabled:opacity-35';
/** The keyboard's bar while typing on the page (prototype `#kbd .kbar`): "Typing · Names" · Done. */
export const SP_KEY_BAR = 'flex h-11 shrink-0 items-center justify-between border-t border-[var(--sp-line)] bg-white pl-[14px] pr-2 text-[13px] font-semibold text-[var(--sp-ink2)]';
export const SP_KEY_DONE = 'sn-press inline-flex h-11 items-center px-1';
/** The resize grab (prototype `.grab`): a 44 × 5 pill in a 14 px strip — the tap reaches 15 px above and below. */
export const SP_GRAB = 'relative flex !h-[14px] !min-h-0 w-full shrink-0 touch-none items-center justify-center before:absolute before:inset-x-0 before:-top-[15px] before:-bottom-[15px] before:content-[""]';

/** Every class string a tap lands on, by name — the guard walks them all. */
export const STAGE_TAP_TARGETS = {
  STAGE_ROW,
  STAGE_ICON_BUTTON,
  STAGE_ITEM_BUTTON,
  STAGE_TOOL_PILL,
  STAGE_TOOL_BUTTON,
  STAGE_PART_TILE,
  STAGE_SHEET_ROW,
  STAGE_QUIET_ROW,
  STAGE_QUIET_SUPPLIERS,
  STAGE_GUEST_TAB,
  SP_PHASES,
  SP_PHASE,
  SP_DD,
  SP_DD_BUTTON,
  SP_ROW,
  SP_SWITCH,
  SP_DIR,
  SP_SWATCH,
  SP_LAYOUT_CARD,
  SP_PILL_BUTTON,
  SP_STEP_BUTTON,
  SP_KEY_BAR,
  SP_KEY_DONE,
} as const;

/** The panel with nothing picked: the grab and the one row (prototype `.lt.min`, 62 px of an 812 phone). */
export const STAGE_PANEL_REST_PX = 62;

/** The panel picked open: the lower half of this screen — never more. */
export function stagePanelOpenPx(viewportH: number): number {
  return Math.min(Math.floor(viewportH / 2), makerLtClampPx(Number.POSITIVE_INFINITY, viewportH));
}

/** How long the panel takes to rise or fold (the prototype's 240 ms). */
export const STAGE_PANEL_MS = 240;
