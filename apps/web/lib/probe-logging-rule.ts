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

/**
 * The OTHER family: a rejection handled on the promise, not in a `try`.
 *
 *   fetchThing().catch(() => [])
 *   builder.then((r) => r.count ?? 0, () => 0)
 *
 * 🔑 THE FIRST VERSION OF THIS GUARD COULD NOT SEE ANY OF THESE, and said the
 * page was clean while eleven of them sat in it. A guard that names a SHAPE
 * reports clean about the half it was taught to look at. That is the same
 * failure as the indentation hole one level up: there a form escaped, here a
 * whole family did.
 *
 * ⚠ It cannot see the third family at all, and that is stated rather than
 * hidden: `.then((r) => r.count ?? 0)` on a supabase builder never rejects —
 * the failure arrives through the SUCCESS path as a null that `?? 0` turns
 * into a confident zero. No handler exists to inspect. That one is caught by
 * using `SoftReadLog.count`, not by this rule, and the assertion message says
 * so rather than letting a clean run imply it was checked.
 */
export function silentPromiseHandlers(source: string): number[] {
  const src = stripComments(source);
  const out: number[] = [];

  // `.catch(` with a handler that logs nothing.
  const CATCH = /\.catch\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = CATCH.exec(src))) {
    const body = balancedParen(src, src.indexOf('(', m.index));
    if (!LOGGERS.test(body)) out.push(src.slice(0, m.index).split('\n').length);
  }

  // `.then(onOk, onErr)` — only the SECOND argument is a failure handler.
  const THEN = /\.then\s*\(/g;
  while ((m = THEN.exec(src))) {
    const args = balancedParen(src, src.indexOf('(', m.index));
    const rejectArm = splitTopLevel(args.slice(1, -1));
    if (rejectArm.length < 2) continue; // one-arg .then() handles no failure
    if (!LOGGERS.test(rejectArm[1])) out.push(src.slice(0, m.index).split('\n').length);
  }

  return [...new Set(out)].sort((a, b) => a - b);
}

/** Text of the (...) group opening at `open`, quote-aware. Fails closed. */
function balancedParen(src: string, open: number): string {
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
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

/** Split an argument list on TOP-LEVEL commas only. */
function splitTopLevel(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < args.length; i += 1) {
    const c = args[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) { out.push(args.slice(start, i)); start = i + 1; }
  }
  out.push(args.slice(start));
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
