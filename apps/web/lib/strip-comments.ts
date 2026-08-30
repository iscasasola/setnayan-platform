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
 *
 * ── 🚨 2026-08-30 · THIS LEXER HAD A BIGGER HOLE THAN THE REGEX IT REPLACED ──
 * Judged by TYPESCRIPT'S OWN PARSER over the 4,735 files under app/ + lib/ +
 * components/ + tests/ — a comment stripper that removes only comments cannot
 * make a file that parses stop parsing — the score was:
 *
 *     the naive regex (what 301 guard files still use)      22 files broken
 *     THIS LEXER, as shipped                               330 files broken
 *     this lexer, with the two fixes below                    0 files broken
 *
 * Fifteen times worse than the thing it was written to replace, in the SILENT
 * direction: a guard whose subject was eaten asserts against a blank and passes.
 * Two causes, both fixed here:
 *
 *   1 · REGEX LITERALS. `/foo\//g` ends in the three characters `\`, `/`, `/`.
 *       The lexer saw the last two, called it a line comment, and blanked the
 *       rest of the line. Any file holding a pattern with an escaped slash lost
 *       everything after it — and the guards that scan for banned constructs are
 *       exactly the files most likely to contain such patterns.
 *   2 · AN UNTERMINATED `/*` NO LONGER EATS TO END OF FILE. It now strips
 *       nothing. In a file that COMPILES an unterminated block opener cannot be
 *       a real comment — the compiler would have refused it — so it is text or
 *       data, and this codebase writes it constantly: `content-type video/*`,
 *       `accept="image/*"`, and JSX prose like `(/api/v1/vendor/*)`, which is
 *       the case that survived every other fix. That last one is not inside a
 *       string, so no amount of quote-tracking can see it; refusing to treat a
 *       never-closed opener as a comment is what handles it.
 *
 * ⚖ AND THE BIAS IS DELIBERATE. Leaving a comment standing makes a guard
 * complain about PROSE — loud, and someone fixes it in minutes. Eating code
 * makes a guard pass while checking nothing. When the two trade off, this file
 * chooses the loud failure every time.
 */
/**
 * Characters that can precede a REGEX LITERAL. After any of these a `/` opens a
 * pattern; after an identifier, a number, `)` or `]` it is division.
 *
 * 🪤 `>` IS LOAD-BEARING AND `<` IS DELIBERATELY ABSENT. `=> /re/.test(x)` is
 * everywhere in this codebase, so dropping `>` re-broke three files. `<` was
 * tried and removed: it buys almost nothing (`a < /re/.test(b)` is not a thing
 * anyone writes) and in TSX it makes every closing tag `</p>` look like the
 * start of a pattern.
 */
const REGEX_MAY_FOLLOW_CHAR = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
  '+', '-', '*', '%', '~', '^', '>', '\n', '',
]);

/** Keywords after which a `/` opens a regex rather than dividing. */
const REGEX_MAY_FOLLOW_WORD = new Set([
  'return', 'typeof', 'instanceof', 'case', 'in', 'of', 'new',
  'delete', 'void', 'throw', 'do', 'else', 'yield', 'await',
]);

export function stripComments(source: string): string {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  let quote: string | null = null; // "'" | '"' | '`'
  // The last non-whitespace character, and the identifier ending at it. Together
  // they decide whether a `/` opens a pattern or divides.
  let prevChar = '';
  let prevWord = '';
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
      prevChar = c;
      prevWord = '';
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') out[i++] = ' ';
      prevChar = '\n';
      prevWord = '';
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      // NEVER CLOSED ⇒ NOT A COMMENT. See the docblock: in a file that compiles
      // this is `video/*`, `image/*` or JSX prose, and blanking to EOF here is
      // how a guard loses two thirds of its subject without a sound.
      if (end === -1) {
        prevChar = '/';
        prevWord = '';
        i += 1;
        continue;
      }
      const stop = end + 2;
      while (i < stop) {
        if (source[i] !== '\n') out[i] = ' ';
        i += 1;
      }
      continue;
    }
    if (
      c === '/' &&
      (REGEX_MAY_FOLLOW_CHAR.has(prevChar) || REGEX_MAY_FOLLOW_WORD.has(prevWord))
    ) {
      // Scan the literal to its unescaped closing `/`. A `/` inside a character
      // class does not close it: `/[/]/` is one pattern, not two.
      let k = i + 1;
      let inClass = false;
      let closed = false;
      for (; k < n; k += 1) {
        const d = source[k];
        if (d === '\\') {
          k += 1;
          continue;
        }
        if (d === '\n') break; // a pattern cannot span a line — this was division
        if (inClass) {
          if (d === ']') inClass = false;
          continue;
        }
        if (d === '[') {
          inClass = true;
          continue;
        }
        if (d === '/') {
          closed = true;
          break;
        }
      }
      if (closed) {
        i = k + 1;
        while (i < n && /[a-z]/.test(source[i] as string)) i += 1; // flags
        prevChar = '/';
        prevWord = '';
        continue;
      }
    }
    if (!/\s/.test(c as string)) {
      prevChar = c as string;
      prevWord = /[A-Za-z0-9_$]/.test(c as string) ? prevWord + c : '';
    } else if (c === '\n') {
      prevChar = '\n';
      prevWord = '';
    }
    i += 1;
  }
  return out.join('');
}
