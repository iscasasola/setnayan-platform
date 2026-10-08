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
export const SP_DD_STACKED_LABEL = 'pointer-events-none absolute left-[14px] right-[26px] top-[6px] z-[1] truncate text-[10.5px] font-medium leading-[1.1] text-[var(--sp-mute)]';
export const SP_DD_STACKED_BUTTON =
  'h-11 !min-h-0 min-w-0 flex-1 !items-end !justify-between !rounded-full !bg-transparent !pb-[5px] !pl-[14px] !pr-2.5 !text-[13px] !font-semibold [&>svg]:self-center';
/** A half of row 3 (prototype `.fr.needs > *`): one need keeps its half, it never stretches to the row. */
export const SP_ANIMATE_HALF = 'flex min-w-0 flex-[0_0_calc(50%_-_4px)] items-center';
