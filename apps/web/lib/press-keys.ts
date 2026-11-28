import type { KeyboardEvent } from 'react';

/**
 * ⌨️ ENTER OR SPACE PRESSES IT: the keyboard half of a control that cannot be a native `<button>`
 * (an SVG node, a canvas, a table row, a row that holds block content). Pair it with `role="button"` and
 * `tabIndex={0}` on the same element; `button-a11y-keyboard.test.ts` holds the pairing.
 *
 * A key aimed at a child control (an input or a real button inside the row) is left to that child.
 */
export function onPressKeys<E extends Element = Element>(press: () => void) {
  return (e: KeyboardEvent<E>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    e.stopPropagation();
    press();
  };
}
