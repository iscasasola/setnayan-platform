/**
 * S8 — the pure "what happens on submit" core of the own-channel stream-key
 * paste field (rendered only inside the desktop shell — see
 * app/_components/encoder-key-panel.tsx).
 *
 * Factored out of the component on purpose: the guard this session most cares
 * about — "the pasted key never sits in React state a moment longer than the
 * submit" — has to be something a plain, mutation-tested unit test can pin
 * down. The repo has no React-rendering test harness (no `.test.tsx` anywhere,
 * no jsdom/RTL wired up), so the guarantee lives here as a pure function
 * instead of an assertion against a rendered DOM: `nextFieldValue` is ALWAYS
 * `''`, never the value that was just submitted, and the component's submit
 * handler MUST apply it to the controlled input synchronously, before
 * `await`-ing the Tauri invoke. See the component for the wiring.
 */

export type PasteSubmitResult = {
  /** The trimmed key to hand to `setPastedStreamKey`. */
  send: string;
  /**
   * What the paste field's controlled value must become. Always the empty
   * string — typed as the literal `''`, not `string`, so a future edit that
   * tries to return anything else is a compile error, not just a lint nit.
   */
  nextFieldValue: '';
};

/**
 * Returns `null` for a blank/whitespace-only field (nothing to submit — the
 * caller should leave the field as-is and not call the Tauri command at all).
 */
export function pasteSubmit(currentFieldValue: string): PasteSubmitResult | null {
  const trimmed = currentFieldValue.trim();
  if (!trimmed) return null;
  return { send: trimmed, nextFieldValue: '' };
}
