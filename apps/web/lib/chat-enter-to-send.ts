/**
 * chat-enter-to-send.ts — the ONE decision for "does this keystroke send the
 * chat message, or insert a newline?"
 *
 * ONE RULE ON EVERY DEVICE (walk 13 Nov 2026, F-W3-28): Enter sends, Shift+Enter
 * inserts a newline — in the group chat, the event chat and every other
 * composer that asks this function.
 *
 * 🔴 WHY THE PHONE RULE WENT. This used to hold Return back on a coarse-pointer
 * device (a touch screen), so the event chat read "Enter adds a line and does
 * not send" while the group chat's box sent on Enter — two composers, two
 * answers to the same key. The walk measured exactly that. The phone arm now
 * matches the chat-step cards' rule already on main ("phones send too",
 * `app/_components/chat/chat-step-card.tsx`): the send button is still there,
 * and a hardware keyboard's Shift+Enter is still a new line. `environment` is
 * kept in the signature so no caller has to change, and it no longer changes
 * the answer (`chat-enter-to-send.test.ts` holds both devices to one rule).
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
 * plain Enter, no Shift, no other modifier, not mid-IME-composition — on a
 * touch screen exactly as on a laptop.
 */
export function shouldSendOnEnter(
  event: ChatEnterKeyEvent,
  // Kept so every caller compiles unchanged; one rule for every device (see the docblock).
  _environment?: ChatEnterEnvironment,
): boolean {
  if (event.key !== 'Enter') return false;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.isComposing === true) return false;
  if (event.keyCode === IME_CONFIRM_KEY_CODE) return false;
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
