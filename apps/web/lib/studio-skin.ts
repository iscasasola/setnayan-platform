/**
 * lib/studio-skin.ts — THE STUDIO SCREENS' LOOK, TRANSLATED FROM THE APPROVED
 * PROTOTYPE (owner 2026-10-07, verbatim: *"the lower toolbar did not execute the
 * designs style we agreed on the prototype"* · *"seems like nothing was built
 * properly"*; DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE
 * PROTOTYPE…", which applies to Studio too). Prototype:
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` — its `.fhead`,
 * `.ddp`, `.fright.saved`, `.sdone`, `.autob`, `.shome`/`.stile`, `.gh`, `.grp .fr`,
 * `.gx-row`/`.gx-h`, `.sw`, `.quiet`, `.ebot-btn`, `.pr-sv`, `.pr-all`.
 *
 * ONE place for every class string the Studio screens share, so a screen never
 * re-invents a row. Values are the prototype's, on the app's own tokens (a warm
 * page = the gold ornament mixed into the page colour, so a dark theme still
 * flips): page ≈ #F3F0EA · hairline = ink 10% · pill ≈ #F1EEE8 · ✓ = success.
 *
 * 🚫 NO CARDS (owner 2026-09-24; `scripts/lint-no-card.mjs`). Where the prototype
 * draws a white rounded group (`.grp`, `.gx-row`), Studio draws the SAME rows on a
 * full-width white band with hairlines — the rows, heights and words are the
 * prototype's; the box outline is the one thing not copied.
 *
 * Pure strings: no React, nothing reaches the Maker's first load on its own.
 */

/** The warm page under every Studio screen (prototype `--page` #F3F0EA). */
export const STUDIO_PAGE_BG = 'bg-[color-mix(in_srgb,rgb(var(--color-gild))_9%,rgb(var(--color-cream)))]';
/** A pill's resting fill (prototype `--pill` #F1EEE8). */
export const STUDIO_PILL_BG = 'bg-[color-mix(in_srgb,rgb(var(--color-gild))_8%,rgb(var(--color-cream)))]';

/** `.fhead` — the slim row under the top nav: Tool ▾ · (✨ Auto) · ✓ Saved, or ✓ Done. */
export const STUDIO_HEAD_ROW =
  'absolute inset-x-0 top-0 z-40 flex h-[52px] items-center gap-2 border-b border-ink/10 bg-cream px-2.5 lg:hidden';
/** `.ddp` — the Tool ▾ pill: the whole row's width, capitals, a gold chevron. */
export const STUDIO_TOOL_PILL = `!min-h-10 !h-10 flex-1 justify-center !gap-1.5 !rounded-full !bg-[color-mix(in_srgb,rgb(var(--color-gild))_8%,rgb(var(--color-cream)))] hover:!bg-[color-mix(in_srgb,rgb(var(--color-gild))_8%,rgb(var(--color-cream)))] !px-3.5 !text-[11.5px] !font-bold uppercase !tracking-[0.1em] ring-1 ring-ink/10 [&>svg]:text-gild`;
/** `.fright.saved` — ✓ Saved (green words on the pill). */
export const STUDIO_SAVED_PILL = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full ${STUDIO_PILL_BG} px-3 text-[12.5px] font-semibold ring-1 ring-ink/10`;
/** `.sdone` — ✓ Done on the two full-screen tools (Wedding March, Seat plan). */
export const STUDIO_DONE_BUTTON =
  'sn-press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-success-600 px-3.5 text-[13px] font-bold text-white hover:bg-success-700';
/** `.autob` — ✨ Auto (Mood Board only), ink, beside Saved. */
export const STUDIO_AUTO_BUTTON = 'sn-press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-[12.5px] font-bold text-cream';

/** `.gh` — a group's small-capital heading, its line on the right. */
export const STUDIO_GROUP_HEAD = 'flex items-baseline gap-2 px-1.5 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55';
export const STUDIO_GROUP_HEAD_LINE = 'ml-auto text-[11px] font-medium normal-case tracking-normal text-ink/50';
/** `.grp` — the white band a group's rows sit on (hairlines, never a box). */
export const STUDIO_GROUP = 'mb-2.5 flex flex-col border-y border-ink/10 bg-cream -mx-4 px-4';
/** `.grp .fr` — one row: the name (and its small line) left, the control right; 48 px, a hairline between rows. */
export const STUDIO_ROW = 'flex min-h-12 items-center gap-2.5 border-t border-ink/10 py-1.5 text-[14px] text-ink first:border-t-0';
export const STUDIO_ROW_LABEL = 'min-w-0 flex-1';
export const STUDIO_ROW_SUB = 'mt-px block text-[11px] text-ink/50';
/** `.grp .fr.col` — a row whose field takes the full width under a small-capital label. */
export const STUDIO_ROW_COL = 'flex flex-col gap-0.5 border-t border-ink/10 py-2.5 first:border-t-0';
export const STUDIO_ROW_COL_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50';

/** `.sw` — the switch: green when on (46×28, a 22 px knob). */
export const STUDIO_SWITCH_TRACK =
  "relative h-7 w-[46px] shrink-0 rounded-full bg-ink/20 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[22px] after:w-[22px] after:rounded-full after:bg-white after:shadow after:transition-[left] after:content-[''] peer-checked:bg-success-600 peer-checked:after:left-[21px] peer-focus-visible:ring-2 peer-focus-visible:ring-success-600/40 peer-disabled:opacity-40";

/** `.quiet` — the form's quiet rows at the very bottom (Restore · Reset · About). */
export const STUDIO_QUIET_ROW = 'flex min-h-11 items-center justify-between gap-2.5 px-1.5 text-[13px] text-ink/50';
export const STUDIO_QUIET_BUTTON = 'sn-press inline-flex h-[34px] shrink-0 items-center rounded-full bg-cream px-3 text-[12.5px] font-semibold text-ink ring-1 ring-ink/10 disabled:opacity-40';

/** `.pr-sv` — a print's Save button; `.pr-all` / `.ebot-btn` — the one ink button at the foot. */
export const STUDIO_SAVE_CHIP = 'sn-press inline-flex h-9 items-center rounded-md bg-cream px-3 text-[12.5px] font-semibold text-ink ring-1 ring-ink/15';
export const STUDIO_FOOT_BUTTON = 'sn-press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-cream';
/** `.ebot` — the editor's own bottom: white, a hairline above. */
export const STUDIO_FOOT = 'shrink-0 border-t border-ink/10 bg-cream px-2.5 py-2';
/**
 * 🪟 A FLOATING action row is frosted glass (owner 2026-10-08, *"apply this to all glass row"*;
 * BUTTON_RULE Rule 7): the shared `.sn-glass-row` class — no opaque fill, no shadow; the buttons
 * keep their own colours. Never a second glass recipe here.
 */
export const STUDIO_GLASS_FOOT = 'sn-glass-row shrink-0 px-2.5 py-2';

/** `.dd` — a dropdown on the right of a row (white pill, gold chevron). */
export const STUDIO_ROW_PICK = '!min-h-9 !h-9 !rounded-full !bg-cream ring-1 ring-ink/10 !px-3 !text-[13px] !font-medium [&>svg]:text-gild';
