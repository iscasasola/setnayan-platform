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
  const out: ProbeSite[] = [];
  const CATCH = /\}\s*catch\s*(?:\([^)]*\))?\s*\{/g;

  let m: RegExpExecArray | null;
  while ((m = CATCH.exec(src))) {
    const braceAt = src.indexOf('{', m.index + m[0].length - 1);
    const body = balancedBlock(src, braceAt);
    const tryStart = enclosingTryStart(src, m.index);
    const tryBlock = tryStart === null ? '' : src.slice(tryStart, m.index);
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      logs: LOGGERS.test(body) || LOGGERS.test(tryBlock),
    });
  }
  return out;
}

/**
 * The text of the block that opens at `open`, by BRACE COUNTING.
 *
 * 🪤 THIS REPLACED AN INDENTATION SCAN, AND THE OLD ONE SHIPPED A HOLE. It
 * found the catch body by walking forward to the next `}` at the catch's own
 * indentation — which, for a single-line `try { … } catch { … }`, is not the
 * catch's brace at all but the enclosing function's, hundreds of lines later.
 * The body then swallowed unrelated code, any `logQueryError` in it counted,
 * and a freshly added silent probe was reported as LOGGED. Caught by sabotage:
 * the multi-line form went red and the one-line form stayed green.
 *
 * Quoted regions are skipped so a brace inside a string or a className does not
 * unbalance the count. Comments are already blanked by the caller.
 * Fails CLOSED: an unbalanced block returns the rest of the file rather than
 * an empty string, so a parse failure cannot read as "no logger found" —
 * it reads as "logger found", which is the direction that surfaces a bug in
 * this rule as a passing probe rather than as a false accusation.
 */
function balancedBlock(src: string, open: number): string {
  if (open < 0) return src;
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

/** Offset of the `try` this catch belongs to — the nearest one above it. */
function enclosingTryStart(src: string, catchAt: number): number | null {
  const before = src.slice(0, catchAt);
  const i = before.lastIndexOf('try');
  return i === -1 ? null : i;
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
