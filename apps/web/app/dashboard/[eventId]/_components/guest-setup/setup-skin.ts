/**
 * setup-skin.ts — the ONE row shape of Guests › Setup (owner 2026-10-07,
 * prototype `home_and_guests_2026-10-07_fable.html?page=guests` → Setup, its
 * `.row`): the words on the left, ONE control on the right, a hairline above,
 * no card and no box. Pure strings — the shared parts (`GuestsGetIn`,
 * `RsvpAsks`, `ReplyBy`) default to it; the Maker's Studio › RSVP hands in its
 * own row class (`lib/studio-skin.ts`), so the SAME part sits in both doors.
 */

/** `.row` — `grid 1fr auto · gap 10px · padding 12px 0 · border-top line`. */
export const SETUP_ROW = 'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-ink/10 py-3';
/** `.row` with the control under the words (`grid-template-columns: 1fr`). */
export const SETUP_ROW_STACK = 'grid min-w-0 grid-cols-1 gap-2 border-t border-ink/10 py-3';
/** `.row .t` */
export const SETUP_TITLE = 'font-medium text-ink';
/** `.row .s` */
export const SETUP_SUB = 'text-[13px] leading-snug text-ink/60';
/** `.acts` — one row of buttons. */
export const SETUP_ACTS = 'flex min-w-0 items-center gap-2';
/** `.row .sel.ctl { max-width: 52% }` — the dropdown never eats the words. */
export const SETUP_PICK = 'max-w-[52vw] sm:max-w-[320px]';
