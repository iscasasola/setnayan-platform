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

/** The panel's one row (stage ▾ · Style | Text | Animate · ▶ · ×). */
export const STAGE_ROW = 'flex h-11 shrink-0 items-center gap-2 px-1';
/** A round icon button in the row (▶, ×). */
export const STAGE_ICON_BUTTON =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink ring-1 ring-ink/10 transition-colors duration-sn-control ease-sn disabled:text-ink/30';
/** The stage ▾ pill. */
export const STAGE_ITEM_BUTTON =
  'sn-press inline-flex h-11 min-w-0 shrink items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 text-[13.5px] font-semibold text-ink ring-1 ring-ink/10 transition-colors duration-sn-control ease-sn';
/** One of Style | Text | Animate, inside its pill. */
export const STAGE_TOOL_BUTTON =
  'sn-press inline-flex h-11 w-12 items-center justify-center rounded-full text-ink/75 transition-colors duration-sn-control ease-sn aria-pressed:bg-ink aria-pressed:text-cream';
/** A part's tile in the strip. */
export const STAGE_PART_TILE =
  'sn-press flex h-[84px] w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 text-center ring-1 ring-ink/10 transition-shadow duration-sn-control ease-sn aria-pressed:ring-2 aria-pressed:ring-mulberry';
/** A row of the stage ▾ sheet (a stage, or one of its pages). */
export const STAGE_SHEET_ROW =
  'sn-press flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:text-ink/40';
/** The quiet "Edit the … ›" row at the top of Style. */
export const STAGE_QUIET_ROW =
  'sn-press flex h-11 w-full shrink-0 items-center gap-1 px-2 text-left text-[13.5px] font-semibold text-ink/75 transition-colors duration-sn-control ease-sn hover:text-ink';
/** A page of the guest's tab bar, drawn under the page preview. */
export const STAGE_GUEST_TAB =
  'sn-press flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-ink/60 transition-colors duration-sn-control ease-sn aria-current:text-ink';

/** Every class string a tap lands on, by name — the guard walks them all. */
export const STAGE_TAP_TARGETS = {
  STAGE_ROW,
  STAGE_ICON_BUTTON,
  STAGE_ITEM_BUTTON,
  STAGE_TOOL_BUTTON,
  STAGE_PART_TILE,
  STAGE_SHEET_ROW,
  STAGE_QUIET_ROW,
  STAGE_GUEST_TAB,
} as const;

/** The panel picked open: the lower half of this screen — never more. */
export function stagePanelOpenPx(viewportH: number): number {
  return Math.min(Math.floor(viewportH / 2), makerLtClampPx(Number.POSITIVE_INFINITY, viewportH));
}

/** How long the panel takes to rise or fold (the prototype's 240 ms). */
export const STAGE_PANEL_MS = 240;
