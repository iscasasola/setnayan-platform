/**
 * chat-enter-to-send.ts — the ONE decision for "does this keystroke send the
 * chat message, or insert a newline?"
 *
 * Desktop / laptop convention: Enter sends, Shift+Enter inserts a newline.
 * That convention breaks on a touch keyboard — there is no Shift+Enter on a
 * phone's on-screen keyboard, so if bare Return sent the message, a person
 * typing on a phone could never write a second line. So on a coarse-pointer
 * device Return always inserts a newline; sending is only ever the button tap.
 *
 * IME COMPOSITION: Filipino, Japanese and Chinese input methods (among many
 * others) use Enter to CONFIRM the word being composed, not to submit the
 * form. `isComposing` on the KeyboardEvent is the correct signal; `keyCode
 * === 229` is the historical fallback some browsers still report during
 * composition (notably older Safari/older event replays), so both are
 * treated as "still composing" here.
 *
 * MODIFIERS: Alt/Ctrl/Meta+Enter keep their platform default (often "insert a
 * newline" in some apps, or a no-op) rather than being hijacked into sending.
 */

export type ChatEnterKeyEvent = {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export type ChatEnterEnvironment = {
  /** True on a touch keyboard (`window.matchMedia('(pointer: coarse)').matches`). */
  coarsePointer: boolean;
};

const IME_CONFIRM_KEY_CODE = 229;

/**
 * Returns true only when this keystroke should submit the chat form:
 * plain Enter, no Shift, no other modifier, not mid-IME-composition, and not
 * on a coarse-pointer (touch) device.
 */
export function shouldSendOnEnter(
  event: ChatEnterKeyEvent,
  environment: ChatEnterEnvironment,
): boolean {
  if (event.key !== 'Enter') return false;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.isComposing === true) return false;
  if (event.keyCode === IME_CONFIRM_KEY_CODE) return false;
  if (environment.coarsePointer) return false;
  return true;
}

/**
 * Reads the live pointer-precision media query. SSR-safe: `window` does not
 * exist on the server, so this defaults to "not coarse" (desktop behaviour)
 * whenever it cannot ask — a real browser always re-evaluates this at the
 * keydown that matters, so the SSR default is never actually acted on.
 */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
