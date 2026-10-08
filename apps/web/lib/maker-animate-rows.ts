/**
 * ✨ THE CLASSES ONLY ANIMATE'S FOUR ROWS WEAR (`animate-is-four-rows.test.ts`). They live HERE, not in
 * `lib/maker-stage-room.ts`: this module is imported by the toolbar's lazy pieces alone (`stage-panel/kit.tsx`,
 * `stage-panel/stage-animate.tsx`), so not one byte of it can reach the Maker's first-load JS (1.3 KB of headroom,
 * measured 2026-10-09).
 */

/**
 * THE TWO-LINE DROPDOWN (prototype `.fh` — its name above its value, one pill): two or three sit in one of the four
 * rows where the one-line `SP_DD` (small caps, then the value) has room for one. The whole pill is the tap: the
 * PickMenu's button fills it, 44 px, and the name lies over it, letting the tap through.
 */
export const SP_DD_STACKED = 'relative flex h-11 min-w-0 flex-1 items-stretch rounded-full bg-white ring-1 ring-inset ring-[var(--sp-line)]';
/* 🔤 The name is 12 px — the Form row's small line (`form-row.tsx` `data-form-row-where`), over a 14-px value, the Form
   row's pill (`FORM_PILL_CLASS`). It was 10.5 px, under the template's smallest type (11 px) — seen on the review
   copy, 2026-10-09: "very small above the value". 5 + 14 + 3 + 18 + 4 = the pill's 44 px. */
export const SP_DD_STACKED_LABEL = 'pointer-events-none absolute left-[14px] right-[26px] top-[5px] z-[1] truncate text-[12px] font-medium leading-[14px] text-[var(--sp-mute)]';
export const SP_DD_STACKED_BUTTON =
  'h-11 !min-h-0 min-w-0 flex-1 !items-end !justify-between !rounded-full !bg-transparent !pb-[4px] !pl-[14px] !pr-2.5 !text-[14px] !font-medium !leading-[18px] [&>svg]:self-center';
/** A half of row 3 (prototype `.fr.needs > *`): one need keeps its half, it never stretches to the row. */
export const SP_ANIMATE_HALF = 'flex min-w-0 flex-[0_0_calc(50%_-_4px)] items-center';
/**
 * ROW 2's FOUR — Fade · Blur · Move · Size are four independent on / offs, so they are the app's CHIPS (kind 11,
 * `app/_components/chips.tsx`), never segments of one track: in a track they read as a single choice with nothing
 * picked (seen on the review copy, 2026-10-09). Four even chips on ONE line: the set hugs nothing and wraps nowhere
 * — a 6-px gap leaves each chip its 84 px on a 375-px phone ((355 − 18) / 4).
 */
export const SP_ANIMATE_CHIPS = '!grid min-w-0 flex-1 !grid-cols-4 !gap-1.5';
