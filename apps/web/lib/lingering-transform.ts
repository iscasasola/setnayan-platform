/**
 * lingering-transform.ts — find CSS that leaves a transform applied after its
 * animation ends.
 *
 * ─── WHY ─────────────────────────────────────────────────────────────────
 * Measured on production 2026-09-18. `.sn-page-enter` — the route-transition
 * wrapper around every in-shell page — read:
 *
 *     @keyframes sn-rise-soft { from { opacity: 0; transform: translateY(8px); } }
 *     .sn-page-enter { animation: sn-rise-soft 400ms both var(--sn-ease-out); }
 *
 * `fill-mode: both` keeps the animation's properties applied AFTER it
 * finishes. The transform settles to `matrix(1, 0, 0, 1, 0, 0)` — an identity.
 * It moves nothing. It is invisible in a screenshot, in a diff, and in review.
 *
 * 🔑 AND PER CSS SPEC ANY TRANSFORM ON AN ANCESTOR BECOMES THE CONTAINING
 * BLOCK FOR `position: fixed` DESCENDANTS. So this one word silently unpinned
 * every fixed overlay in the app. The vendor coach-mark measured 636 x 2444
 * against a 1107px viewport and its card — Skip and Next included — sat 341px
 * below the fold. What the owner saw was a dimmed page and a dialog he could
 * not reach; what it looked like was a broken layout.
 *
 * ⚖ THE SHAPE IS THE POINT, NOT THIS ONE RULE. A page-level wrapper that ends
 * an animation holding a transform breaks fixed positioning for everything
 * inside it, forever, with no visual tell. That is what this detects.
 */

export type LingeringTransform = {
  /** The selector whose animation leaves a transform applied. */
  selector: string;
  /** The keyframes name it runs. */
  animation: string;
  /** `both` or `forwards` — the fill modes that persist the end state. */
  fillMode: string;
};

const PERSISTING_FILL = /\b(both|forwards)\b/;

/**
 * Which `@keyframes` blocks touch `transform`.
 *
 * ⚠ Includes the individual transform properties too (`translate`, `rotate`,
 * `scale`), which create a containing block exactly the same way and are the
 * obvious next spelling of this bug.
 */
export function keyframesTouchingTransform(css: string): Set<string> {
  const names = new Set<string>();
  const re = /@keyframes\s+([A-Za-z0-9_-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    // Walk braces from the opening one so a nested block cannot end it early.
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = css.slice(start, i + 1);
    if (/(^|[\s;{])(transform|translate|rotate|scale)\s*:/.test(body)) {
      names.add(m[1]!);
    }
  }
  return names;
}

/**
 * Every rule that runs a transform-bearing animation with a persisting fill
 * mode — i.e. that will still be holding a transform when it is done.
 *
 * ⚠ Deliberately reports ALL of them, including ones that are harmless today.
 * Harmless depends on whether anything inside is `position: fixed`, which is a
 * fact about the React tree, not the stylesheet — so the rule is stated where
 * it can be enforced and exceptions are listed by hand.
 */
export function lingeringTransforms(css: string): LingeringTransform[] {
  const transformy = keyframesTouchingTransform(css);
  const out: LingeringTransform[] = [];
  const rule = /([^{}@/]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(css))) {
    const selector = m[1]!.trim().replace(/\s+/g, ' ');
    const body = m[2]!;
    const decl = /animation\s*:\s*([^;}]+)/.exec(body);
    if (!decl) continue;
    const shorthand = decl[1]!;
    if (!PERSISTING_FILL.test(shorthand)) continue;
    for (const name of transformy) {
      if (new RegExp(`(^|[\\s,])${name}([\\s,]|$)`).test(shorthand)) {
        out.push({
          selector,
          animation: name,
          fillMode: /\bboth\b/.test(shorthand) ? 'both' : 'forwards',
        });
      }
    }
  }
  return out;
}
