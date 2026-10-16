/**
 * HOW FAR A PRESS REACHES — the arithmetic the 44-px guards share (dark-mode PR 4, 2026-10-13).
 *
 * A painted control keeps its drawing and grows its PRESS with an invisible `::after` (`.sn-hit`, `.ab::after`,
 * `globals.css`). Given that `::after` rule's body and the control's drawn height (and border), this says how tall the
 * press is — the number a finger meets. Two shapes of rule are read:
 *   · `inset: -Npx 0` — a fixed reach: drawn + 2N;
 *   · `top / bottom: min(0px, calc((100% - Tpx) / 2))` — the shared press: the `::after`'s containing block is the
 *     control's PADDING box (drawn − 2 × border), so it spans max(padding box, T), and the press is that plus the
 *     border, or the drawn height when that is taller.
 * Also says whether it bleeds sideways (`left`/`right`/inline inset other than 0) — a fitted row reads that as overflow.
 * Pure: no imports, used by tests only.
 */
export type PressReach = { height: number; sideways: boolean };

export function pressReach(afterBody: string, drawn: number, border = 0): PressReach | null {
  if (!/content:\s*''/.test(afterBody) || !/position:\s*absolute/.test(afterBody)) return null;
  const inset = afterBody.match(/(?:^|[;\s{])inset:\s*(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)(?:px)?)?/);
  if (inset) {
    const v = -Number(inset[1]);
    const x = -Number(inset[2] ?? inset[1]);
    return { height: drawn + 2 * Math.max(0, v), sideways: x !== 0 };
  }
  const share = /min\(\s*0(?:px)?\s*,\s*calc\(\s*\(\s*100%\s*-\s*(\d+(?:\.\d+)?)px\s*\)\s*\/\s*2\s*\)\s*\)/;
  const top = afterBody.match(new RegExp(`(?:^|[;\\s{])top:\\s*${share.source}`));
  const bottom = afterBody.match(new RegExp(`(?:^|[;\\s{])bottom:\\s*${share.source}`));
  if (!top || !bottom) return null;
  const padding = drawn - 2 * border;
  const reach = (t: number) => Math.max(0, (t - padding) / 2);
  const height = drawn + reach(Number(top[1])) + reach(Number(bottom[1]));
  const left = afterBody.match(/(?:^|[;\s{])left:\s*(-?\d+(?:\.\d+)?)(?:px)?\s*[;}]?/);
  const right = afterBody.match(/(?:^|[;\s{])right:\s*(-?\d+(?:\.\d+)?)(?:px)?\s*[;}]?/);
  const sideways = !left || !right || Number(left[1]) !== 0 || Number(right[1]) !== 0;
  return { height, sideways };
}

/** The body of the first rule whose selector list is exactly `selector` (comments already stripped). */
export function ruleBody(css: string, selector: string): string | null {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[\\n}])\\s*${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1]! : null;
}
