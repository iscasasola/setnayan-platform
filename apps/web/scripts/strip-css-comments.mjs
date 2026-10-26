/**
 * strip-css-comments.mjs — blank the comments out of a STYLESHEET, keeping every newline and
 * every column, so a guard that reports `file:line` still points at the real line.
 *
 * WHY NOT THE ONE STRIPPER (`lib/strip-comments.ts` / its twin in `port-controls.mjs`). That is a
 * JavaScript lexer: it treats `//` as a line comment. CSS has no line comments, and writes `//`
 * constantly — `url(https://…)`, `@import url(//fonts…)` — so the JS lexer would blank the rest of
 * every such line. This is the CSS grammar's one comment form, `/* … *​/`, read by a lexer that
 * skips strings (a `/*` inside `content: "/*"` is text, not a comment). It is the stylesheet
 * counterpart of the one stripper, the way `stripSqlComments` is for SQL — not a second copy of it.
 *
 * Used by lint-raw-colour.mjs and lint-font-family.mjs (brand refresh, 2026-10-26).
 */
export function stripCssComments(source) {
  const out = source.split('');
  const n = source.length;
  let quote = null;
  for (let i = 0; i < n; i++) {
    const c = source[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let j = i; j < stop; j++) if (out[j] !== '\n') out[j] = ' ';
      i = stop - 1;
    }
  }
  return out.join('');
}
