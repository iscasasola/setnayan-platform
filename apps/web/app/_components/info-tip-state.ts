/**
 * The InfoTip's open/close decisions, as a pure reducer — so the rules are
 * EXECUTED by `info-tip.test.ts` rather than read off the JSX.
 *
 * The brief (owner 2026-09-24, §2): secondary text is "revealed dynamically
 * via hover on desktop or a quick tap on touch viewports". Four rules follow:
 *
 *  1. HOVER OPENS ONLY FOR A MOUSE. A finger also fires `pointerenter` (with
 *     `pointerType: 'touch'`) just before its click; if that opened the tip,
 *     the click that follows would toggle it straight back shut. So the
 *     pointer TYPE decides, per event — right on a laptop with a touchscreen,
 *     where a media query would be wrong half the time.
 *  2. A CLICK/TAP PINS. Hover-open then click keeps it open (the click is the
 *     user saying "I want to read this"), and a second click closes it.
 *  3. A PINNED TIP IGNORES LEAVE AND BLUR. Tapping the popover's own text on a
 *     phone blurs the button; closing on that would snatch the text away.
 *  4. ESCAPE AND AN OUTSIDE PRESS ALWAYS CLOSE, pinned or not.
 *
 * Keyboard: focus opens (unpinned, like a tooltip); Enter/Space arrive as a
 * click and pin; Escape closes.
 */

export type TipState = { open: boolean; pinned: boolean };

export type TipEvent =
  | { type: 'pointerenter'; pointerType: string }
  | { type: 'pointerleave'; pointerType: string }
  | { type: 'click' }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'escape' }
  | { type: 'outside' };

export const TIP_CLOSED: TipState = { open: false, pinned: false };

export function tipReducer(state: TipState, event: TipEvent): TipState {
  switch (event.type) {
    case 'pointerenter':
      if (event.pointerType !== 'mouse') return state;
      return state.open ? state : { open: true, pinned: false };
    case 'pointerleave':
      if (event.pointerType !== 'mouse' || state.pinned) return state;
      return TIP_CLOSED;
    case 'click':
      return state.pinned ? TIP_CLOSED : { open: true, pinned: true };
    case 'focus':
      return state.open ? state : { open: true, pinned: false };
    case 'blur':
      return state.pinned ? state : TIP_CLOSED;
    case 'escape':
    case 'outside':
      return TIP_CLOSED;
    default:
      return state;
  }
}
