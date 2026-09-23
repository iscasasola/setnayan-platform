/**
 * probe-logging-rule.ts
 *
 * "This read failed" and "there was nothing to read" must not be the same
 * event. A pure rule, so the guard beside it can EXECUTE it rather than
 * re-implement a regex that then drifts from what is enforced.
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * My Shop wraps each optional read in a `try/catch` that degrades to an empty
 * value. Twelve of them; six logged, six said nothing. The six silent ones fell
 * back to `{}` / `[]` / `null` — byte-identical to a supplier who has no logo,
 * no reviews and no Instagram — so the page told them their shop was empty and
 * left no trace anywhere that it had failed.
 *
 * `logQueryError`'s own docblock already asks for this: "Use this in every
 * graceful-degrade catch so the silent fallback still leaves a trail." The rule
 * below is that sentence, made checkable.
 *
 * ─── COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT A DETAIL ──────────────────
 * Half the prose in these files NAMES `logQueryError` while explaining the
 * hazard — including the comment you are reading. Matching raw source would
 * mark a silent catch as logged because the paragraph above it discusses
 * logging. Stripped with the repo's ONE stripper (`lib/strip-comments`), never
 * a private regex: a `.replace()` pair strips block comments first and a line
 * comment containing `video/*` then eats everything to the next `*​/`.
 */
import { stripComments } from './strip-comments';

export type ProbeSite = {
  /** 1-indexed line of the `catch` in the ORIGINAL source. */
  line: number;
  /** Does this probe leave a trail when it swallows? */
  logs: boolean;
};

const LOGGERS = /\blogQueryError\s*\(|\bconsole\.(?:error|warn)\s*\(|\bcaptureException\s*\(/;

/**
 * Every graceful-degrade `catch` in `source`, and whether it records anything.
 *
 * A probe counts as logging if the logger appears in its `catch` BODY or
 * anywhere in the `try` it belongs to — a read that already logged the Supabase
 * `error` object before degrading has left its trail, and demanding a second
 * call in the catch would be a phrasing rule rather than a behaviour one.
 */
export function probeSites(source: string): ProbeSite[] {
  const src = stripComments(source);
  const lines = src.split('\n');
  const out: ProbeSite[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!/\}\s*catch\s*(?:\([^)]*\))?\s*\{/.test(lines[i])) continue;

    // Walk back to this catch's own `try {`. Nested probes: the nearest
    // unmatched `try` above is the right one, and a `try` on the same line as
    // the catch (single-line form) still counts.
    let j = i;
    while (j > 0 && !/\btry\s*\{/.test(lines[j])) j -= 1;

    // The catch body runs to the closing brace at the catch's own indentation.
    const indent = lines[i].length - lines[i].trimStart().length;
    let k = i + 1;
    while (k < lines.length) {
      const l = lines[k];
      if (l.trim() === '}' && l.length - l.trimStart().length === indent) break;
      k += 1;
    }

    const tryBlock = lines.slice(j, i + 1).join('\n');
    const catchBody = lines.slice(i, Math.min(k + 1, lines.length)).join('\n');
    out.push({ line: i + 1, logs: LOGGERS.test(tryBlock) || LOGGERS.test(catchBody) });
  }
  return out;
}

/** Just the ones that swallow without a word. */
export function silentProbes(source: string): number[] {
  return probeSites(source).filter((p) => !p.logs).map((p) => p.line);
}

/** Parse a baseline file: one `path:line` reason-carrying entry per line. */
export function parseProbeBaseline(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/)[0]);
}
