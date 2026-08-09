/**
 * strip-comments.ts — the ONE string-aware comment stripper for source-scanning
 * guards.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Half the guards in this repo work by reading source text and matching a
 * pattern, so every one of them needs the same first step: remove comments, so
 * that PROSE ABOUT a banned construct is not mistaken for the construct. Three
 * separate strippers had been written for that, two of them regex-based and
 * both wrong in ways nobody could see:
 *
 *   src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
 *
 * That is not a comment stripper. It is a regex that DELETES REAL CODE:
 *
 *   • `/*` inside a STRING opens a comment that never existed. `accept="image/*"`
 *     — an ordinary file input — starts a block comment that runs to the next
 *     real `*​/`, usually the end of the next JSDoc. Measured on this codebase
 *     when `vendor-publish-guard.test.ts` shipped with the regex version:
 *     **5,104 distinct lines of real code across 1,031 files in `app/` + `lib/`**
 *     were being blanked before any scan read them (set-difference on trimmed
 *     lines, which UNDER-counts — a lost line that also appears elsewhere in the
 *     same file does not register). One such window in `lib/papic-fullres-drop.ts`
 *     is opened by the string `video/*` alone. A banned construct inside a window
 *     is invisible, and the window MOVES whenever someone adds an
 *     `accept="image/*"` — with no signal that coverage just shrank.
 *   • The `^\s*` anchor means a TRAILING `// comment` is never stripped at all,
 *     so a guard fails on a colleague's explanatory note.
 *
 * Both directions were reproduced, not theorised: the verbatim hazard line
 * `{ is_published: formData.get('is_published') === 'on' }` inserted into a
 * scanned file left that guard fully green.
 *
 * ⚠ THE FIX CANNOT BE A BETTER REGEX. Deciding whether `/` begins a comment
 * requires knowing whether you are inside a string, a template literal or an
 * escape — that is lexing, not matching. So this is a small lexer.
 *
 * ── RELATIONSHIP TO `scripts/port-controls.mjs` ─────────────────────────────
 * That file has the same lexer and got there first; its docblock records being
 * bitten by `href="https://…"`. This is a PORT, not a rewrite — behaviour must
 * stay identical, and `strip-comments.test.ts` pins the cases both care about.
 * They are separate copies for one mechanical reason: `tsconfig.json` sets
 * `allowJs: false`, and the lint scripts run under plain `node` with no TS
 * loader, so neither can import the other. If that ever changes, collapse them.
 *
 * Characters are replaced with SPACES rather than deleted, so byte offsets —
 * and therefore any line numbers a guard reports — stay true.
 */
export function stripComments(source: string): string {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  let quote: string | null = null; // "'" | '"' | '`'
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') out[i++] = ' ';
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      while (i < stop) {
        if (source[i] !== '\n') out[i] = ' ';
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return out.join('');
}
