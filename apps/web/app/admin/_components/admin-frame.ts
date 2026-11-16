/**
 * THE ADMIN FRAME — one white card, read from the frame tokens (owner 16 Nov 2026, DECISION_LOG
 * "THE CLEAN WARM LOOK IS APPROVED" + "PAGE BACKGROUND = NEUTRAL #F7F5F4; FRAMES = WHITE #FFFFFF").
 *
 * Fill, corner and lift are the three `--sn-frame-*` tokens in `globals.css`, the same ones
 * Admin › Colours writes at runtime (`lib/app-colours.ts`). No 1 px border: the frame floats on the
 * page by its lift, so a hand-typed `border border-ink/10 rounded-2xl bg-cream` is replaced by this
 * and nothing else. Padding, gaps and layout stay with the caller.
 *
 * Only for containers. A button is `ActionButton`; a field keeps its field look.
 */
export const ADMIN_FRAME =
  'bg-[rgb(var(--sn-frame-bg))] rounded-[var(--sn-frame-radius)] shadow-[var(--sn-frame-shadow)]';
