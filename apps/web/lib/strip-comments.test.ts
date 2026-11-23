/**
 * strip-comments.test.ts — the cases that actually broke a guard.
 *
 * Every assertion here is a REPRODUCED failure of the regex "stripper" this
 * module replaced, not an invented edge case. See `strip-comments.ts` for the
 * measurements. The rule they add up to: a stripper must delete comments and
 * ONLY comments, in both directions — code that survives is a false positive
 * waiting to red-line someone's PR, and code that is eaten is a hole the guard
 * was written to close.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('a trailing // comment is stripped, not just a full-line one', () => {
  // The `^\s*`-anchored regex missed this entirely, so a colleague's note about
  // a banned construct counted as the construct.
  const out = stripComments(`const n = 1; // never write is_published: fd.get('x')\n`);
  assert.match(out, /const n = 1;/);
  assert.doesNotMatch(out, /is_published/);
});

test('`/*` inside a STRING does not open a comment — the 1,163-line hole', () => {
  const src = [
    'const a = <input accept="image/*" />;',
    'const hazard = { is_published: 1 };',
    '/** an ordinary docblock, whose */ used to close the fake comment */',
    'const b = 2;',
  ].join('\n');
  const out = stripComments(src);
  // The line BETWEEN the string and the next `*/` must survive.
  assert.match(out, /is_published/, 'real code between "image/*" and the next */ was eaten');
  assert.match(out, /const b = 2;/);
  assert.doesNotMatch(out, /ordinary docblock/, 'the real docblock must still go');
});

test('`//` inside a string — a URL — does not eat the rest of the line', () => {
  const out = stripComments(`const u = "https://setnayan.com"; const keep = 1;`);
  assert.match(out, /const keep = 1;/);
  assert.match(out, /https:/, 'the URL is code, not a comment');
});

test('template literals and escaped quotes do not desynchronise the lexer', () => {
  const out = stripComments(
    'const t = `a ${x} // not a comment`;\nconst e = \'it\\\'s /* fine */\';\nconst after = 3;',
  );
  assert.match(out, /not a comment/);
  assert.match(out, /fine/);
  assert.match(out, /const after = 3;/);
});

/**
 * ── 2026-11-22 · A TEMPLATE LITERAL IS NOT A FLAT STRING ────────────────────
 * The lexer used to read a template from backtick to backtick, so a `${ … }`
 * substitution — which is CODE — was lexed as text. Both tests below are shapes
 * taken from this codebase (`app/[slug]/_components/copy-my-link.tsx` and
 * `app/admin/settings/actions.ts`); each was red before the substitution stack.
 */
test('🪤 a comment INSIDE a ${ … } substitution is stripped — it is code, not text', () => {
  const src = [
    'const cls = `inline-flex ${',
    '  // a note inside a substitution',
    "  state === 'done' ? 'bg-paper' : 'bg-ink'",
    '} rounded ${/* a block note */ size}`;',
    'const after = 1;',
  ].join('\n');
  const out = stripComments(src);
  assert.doesNotMatch(out, /a note inside a substitution/, 'a // comment in a substitution survived');
  assert.doesNotMatch(out, /a block note/, 'a /* */ comment in a substitution survived');
  // …and nothing else moved: the template's own text and the code around it stay.
  assert.match(out, /state === 'done' \? 'bg-paper' : 'bg-ink'/);
  assert.match(out, /`inline-flex \$\{/);
  assert.match(out, /\} rounded \$\{/);
  assert.match(out, /size\}`;/);
  assert.match(out, /const after = 1;/);
  assert.equal(out.length, src.length);
});

test('🪤 a template NESTED in a substitution does not close the outer one — both directions', () => {
  // ① COMMENTS SURVIVE. The inner template holds an apostrophe. Read flat, the
  // OUTER template closes at the inner backtick, `couldn't` is then code, and its
  // `'` opens a string that swallows everything after it — real comments included.
  const survive = [
    "const url = `/admin?e=${enc(`it couldn't save ${logRefusal('x (y)', err)}`)}`; // a real note",
    'const keep = 1;',
    '// another real note',
    'const after = 2;',
  ].join('\n');
  const a = stripComments(survive);
  assert.doesNotMatch(a, /a real note/, 'the trailing comment after a nested template survived');
  assert.doesNotMatch(a, /another real note/, 'a comment two lines below a nested template survived');
  assert.match(a, /it couldn't save \$\{logRefusal\('x \(y\)', err\)\}/);
  assert.match(a, /const after = 2;/);

  // ② CODE IS EATEN. The inner template holds `//`. Read flat, `http:` becomes
  // code and `//…` a line comment that blanks the real code after it.
  const eaten = 'const a = `${f(`http://x.y`)}`; const keep = 1;';
  const b = stripComments(eaten);
  assert.equal(b, eaten, 'nothing in this line is a comment, so nothing may be blanked');
});

test('a `}` that closes an object or block inside a substitution does not end it', () => {
  // The stack counts braces: only the `}` at the substitution's own depth
  // returns to template text. Anything else here would desynchronise again.
  // A stack that closed on ANY `}` reads `, /* a note */ b)` as template text and
  // keeps the note; that is the sabotage this test was checked against.
  const src =
    'const s = `${ fn({ a: 1 }, /* a note */ b) } // text ${(() => { if (x) { y(); } /* another */ return `${b}`; })()} /* text */`; // gone\nconst keep = 1;';
  const out = stripComments(src);
  assert.doesNotMatch(out, /a note/, 'the `}` of `{ a: 1 }` ended the substitution early');
  assert.doesNotMatch(out, /another/, 'the `}` of a block inside an arrow body ended the substitution early');
  assert.match(out, /\) \} \/\/ text \$\{/, '`// text` is template text after the substitution closed');
  assert.match(out, /\/\* text \*\/`;/, '`/* text */` is template text too');
  assert.doesNotMatch(out, /gone/);
  assert.match(out, /const keep = 1;/);
  assert.equal(out.length, src.length);
});

test('🪤 `} />` — a self-closing tag after an expression attribute — is not a pattern', () => {
  // With `}` in REGEX_MAY_FOLLOW_CHAR the `/` of `/>` opened a "regex" that ran
  // to `text-ink/`, and the `"` after it opened a string that never re-synced.
  const src =
    'const el = <p><Peso id={id} /><span className="text-ink/60">x</span></p>; // gone\nconst keep = 1;';
  const out = stripComments(src);
  assert.doesNotMatch(out, /gone/, 'the lexer fell out of step at `} />`');
  assert.match(out, /<Peso id=\{id\} \/><span className="text-ink\/60">x<\/span><\/p>;/);
  assert.match(out, /const keep = 1;/);
});

test('⚖ REVERSED 2026-08-30 — an unterminated block opener strips NOTHING', () => {
  // This test used to assert the opposite: that `/*` with no `*/` ate to EOF.
  // That rule cost more than it bought, and the argument against it is the
  // compiler's. A file that COMPILES cannot contain a real unterminated block
  // comment — so every one this codebase actually holds is text or data:
  // `content-type video/*`, `accept="image/*"`, and JSX prose such as
  // `(/api/v1/vendor/*)`. Eating to EOF on those blanked two thirds of a file
  // out of the guard's sight, silently.
  const out = stripComments('const a = 1;\n/* opened and never closed\nconst b = 2;');
  assert.match(out, /const a = 1;/);
  assert.match(out, /const b = 2;/, 'code after a never-closed opener must survive');
  assert.equal(out.length, 'const a = 1;\n/* opened and never closed\nconst b = 2;'.length);
});

test('🪤 a regex literal with an escaped slash does not eat the rest of the line', () => {
  // `/foo\//g` ends `\`, `/`, `/`. The lexer read the last two as a line
  // comment. Judged by TypeScript's own parser this broke 330 files — fifteen
  // times worse than the naive regex this module was written to replace, and in
  // the silent direction.
  const out = stripComments(String.raw`const RE = /foo\//g; const survives = 1;`);
  assert.match(out, /const survives = 1;/);
  assert.match(out, /RE = /);
});

test('🪤 the naive stripper, written as source, survives being read', () => {
  // The guards most likely to contain a pattern like this are the ones that
  // scan for banned constructs — so this is the population that was worst hit.
  const out = stripComments(
    String.raw`const n = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' '); const survives = 2;`,
  );
  assert.match(out, /const survives = 2;/);
});

test('a real trailing comment after a regex literal is still stripped', () => {
  // The other direction: fixing the false negative must not create a false one.
  const out = stripComments(String.raw`const RE = /a\//g; // a genuine note` + '\n');
  assert.match(out, /const RE = /);
  assert.doesNotMatch(out, /genuine note/);
});

test('division is not mistaken for a pattern', () => {
  const out = stripComments('const half = total / 2; const third = total / 3; const keep = 1;');
  assert.match(out, /const keep = 1;/);
  assert.match(out, /total \/ 3/);
});

test('🪤 a JSX self-close after `}` is not a regex — `x={1.9} />` then a template', () => {
  // Found 2026-11-22 merging main into PR #8018: `strokeWidth={1.9} />} … href={`…`}`
  // in app/admin/gifts/page.tsx. With `}` allowed before a pattern, ` />` opened a
  // "regex" that ran to the `/` inside the template, the leftover backtick opened
  // a template that never closed, and every comment after it survived — a "40%"
  // in a `{/* … */}` then red-lined the-gift-limit-is-one-setting.test.ts.
  const out = stripComments('icon={<S x={1.9} />} href={`/a`}\n/* PROBE */\n');
  assert.doesNotMatch(out, /PROBE/, 'a comment after a JSX self-close survived stripping');
  assert.match(out, /href=\{`\/a`\}/, 'the code itself must be left alone');
});

test('🪤 a `/` in JSX text after `}` is not a regex either', () => {
  // `{a} / {b}` — the population TypeScript calls JsxText. Read as a pattern, its
  // body runs to the next `/` — here the one in `href="/x"` — so the attribute's
  // OPENING quote is swallowed and its closing quote opens a string to EOF.
  const out = stripComments('<p>{a} / <a href="/x">b</a></p>;\n// GONE\nconst keep = 1;\n');
  assert.doesNotMatch(out, /GONE/);
  assert.match(out, /const keep = 1;/);
});

test('a regex that starts a new line after a block is still a regex', () => {
  // The other direction: removing `}` from the set must not turn a pattern on
  // the next line into division. A newline resets the lexer's previous char.
  const out = stripComments(String.raw`if (x) {}` + '\n' + String.raw`/\/\//.test(y); // NOTE` + '\nconst keep = 1;\n');
  assert.doesNotMatch(out, /NOTE/);
  assert.match(out, /const keep = 1;/);
  assert.match(out, /\.test\(y\);/, 'the escaped-slash pattern must survive intact');
});

test('offsets are preserved — line numbers stay true', () => {
  const src = 'const a = 1; /* xx */ const b = 2;\n// gone\nconst c = 3;';
  const out = stripComments(src);
  assert.equal(out.length, src.length, 'characters must be blanked, never removed');
  assert.equal(out.split('\n').length, src.split('\n').length);
});

test('empty input and comment-free input are returned intact', () => {
  assert.equal(stripComments(''), '');
  assert.equal(stripComments('const a = 1;'), 'const a = 1;');
});

/**
 * The measurement that justified the rewrite, kept as a live assertion: run the
 * OLD regex and the real lexer over the whole scanned corpus and prove they
 * still disagree. If this ever stops finding a difference the codebase has
 * changed, not the argument — but while it holds, nobody can "simplify" the
 * lexer back into a regex and see green.
 */
test('the regex it replaced still eats real code from this codebase', () => {
  const naive = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };

  let eaten = 0;
  const worst: string[] = [];
  for (const p of ['app', 'lib'].flatMap((r) => walk(join(WEB, r)))) {
    const raw = readFileSync(p, 'utf8');
    if (!raw.includes('/*')) continue;
    // Lines of REAL code (present after honest stripping) that the naive regex
    // removed. Blank and whitespace-only lines don't count.
    const honest = new Set(
      stripComments(raw)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );
    const naiveSet = new Set(
      naive(raw)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );
    const lost = [...honest].filter((l) => !naiveSet.has(l)).length;
    if (lost > 0) {
      eaten += lost;
      worst.push(`${p.slice(WEB.length + 1)} (${lost})`);
    }
  }

  assert.ok(
    eaten > 0,
    'The naive regex no longer differs from the lexer on this codebase. That is ' +
      'not permission to go back to it — re-read strip-comments.ts. Delete this ' +
      'assertion only with a note saying why the corpus changed.',
  );
});

/**
 * ── THE ORACLE ──────────────────────────────────────────────────────────────
 * Every case above is a hazard somebody already met. This one needs no
 * imagination at all, because it asks TypeScript.
 *
 * 🔑 A STRIPPER THAT REMOVES ONLY COMMENTS CANNOT MAKE A FILE THAT PARSES STOP
 * PARSING. That single property turns the whole corpus into the test set, and
 * it is how the two 2026-08-30 defects were found rather than guessed at.
 * Scored over the 4,735 files under app/ + lib/ + components/ + tests/:
 *
 *     the naive regex (still copied into 301 guard files)   22 files broken
 *     this lexer, as it shipped                            330 files broken
 *     this lexer, fixed                                      0 files broken
 *
 * ⚠ It runs in BOTH directions. `brokeSomething` catches code being eaten — the
 * silent failure. `strippedNothing` catches a lexer that got "safe" by giving
 * up: return the source untouched and you break no parses at all, and every
 * guard in the repo starts matching its own prose.
 */
test('🚨 the stripper never makes a file that parses stop parsing', async () => {
  const ts = (await import('typescript')).default;
  const errs = (name: string, text: string) =>
    (
      ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.Latest,
        true,
        name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ) as unknown as { parseDiagnostics?: unknown[] }
    ).parseDiagnostics?.length ?? 0;

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };

  const broke: string[] = [];
  let judged = 0;
  let strippedSomething = 0;
  for (const p of ['app', 'lib', 'components', 'tests'].flatMap((r) => {
    try {
      return walk(join(WEB, r));
    } catch {
      return [];
    }
  })) {
    const src = readFileSync(p, 'utf8');
    if (errs(p, src) !== 0) continue; // only judge files that parse as written
    judged += 1;
    const out = stripComments(src);
    if (out !== src) strippedSomething += 1;
    if (errs(p, out) !== 0) broke.push(p.slice(WEB.length + 1));
  }

  assert.ok(judged > 3000, `the corpus walk found only ${judged} files — it is not reading the repo`);
  assert.ok(
    strippedSomething > judged * 0.8,
    `only ${strippedSomething} of ${judged} files changed — a stripper that strips nothing ` +
      'passes the parse check trivially and blinds nothing, but every guard then matches its own prose',
  );
  assert.deepEqual(
    broke,
    [],
    'stripComments made these files stop parsing, so it ate real code. Whatever ' +
      'a guard was checking inside them, it is now asserting against a blank:\n  ' +
      broke.join('\n  '),
  );
});

/**
 * ── THE COMMENT ORACLE · A RATCHET ──────────────────────────────────────────
 * The parse oracle above sees one direction only: code that was EATEN. A
 * comment that SURVIVES stripping breaks no parse, so it is invisible there —
 * and that is how a template's `${ … }` went unread as code until 2026-11-22.
 *
 * So ask TypeScript for every comment it finds (leading and trailing ranges
 * around every node and token) and check that each one comes out blank.
 * Comment-shaped text inside a `JsxText` node is skipped: TypeScript reports a
 * range there, but `<p>a // b</p>` is prose on the page, not a comment.
 *
 * Measured over app/ + lib/ + components/ + tests/:
 *
 *     the flat-template lexer, `}` a pattern opener      217 survivors · 28 files
 *     the flat-template lexer, `}` removed                166 survivors · 17 files
 *     the template stack + `}` removed                     32 survivors ·  1 file
 *
 * 🔒 RATCHET. A file may not appear in SURVIVORS_ALLOWED, and no file may
 * exceed its count. When yours goes DOWN, lower the number (or delete the row)
 * in the same PR. Never raise one to go green: a surviving comment is a guard
 * reading prose as code, or a lexer out of step and skipping code as prose.
 */
const SURVIVORS_ALLOWED: Record<string, number> = {
  // JSX TEXT, not a template: `</span> / <span className="… text-ink/80">` —
  // after `>` the `/` opens a "pattern" that closes at `ink/`, and the `"`
  // after it opens a string that runs out of step for the rest of the file.
  'app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx': 32,
};

test('🔒 every comment TypeScript sees is stripped (ratchet: survivors may only go down)', async () => {
  const ts = (await import('typescript')).default;
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };

  const over: string[] = [];
  let judged = 0;
  let commentsSeen = 0;
  for (const p of ['app', 'lib', 'components', 'tests'].flatMap((r) => {
    try {
      return walk(join(WEB, r));
    } catch {
      return [];
    }
  })) {
    const src = readFileSync(p, 'utf8');
    if (!src.includes('//') && !src.includes('/*')) continue;
    const sf = ts.createSourceFile(
      p,
      src,
      ts.ScriptTarget.Latest,
      true,
      p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length ?? 0) !== 0) continue;
    judged += 1;

    const ranges = new Map<number, number>();
    const jsxText: Array<[number, number]> = [];
    const visit = (node: import('typescript').Node) => {
      if (node.kind === ts.SyntaxKind.JsxText) jsxText.push([node.pos, node.end]);
      for (const r of ts.getLeadingCommentRanges(src, node.pos) ?? []) ranges.set(r.pos, r.end);
      for (const r of ts.getTrailingCommentRanges(src, node.end) ?? []) ranges.set(r.pos, r.end);
      for (const child of node.getChildren(sf)) visit(child);
    };
    visit(sf);

    const out = stripComments(src);
    let survived = 0;
    let first = '';
    for (const [a, b] of ranges) {
      if (jsxText.some(([s, e]) => a >= s && a < e)) continue;
      commentsSeen += 1;
      if (/\S/.test(out.slice(a, b))) {
        survived += 1;
        if (!first) first = `line ${src.slice(0, a).split('\n').length}: ${src.slice(a, a + 70).replace(/\n/g, ' ')}`;
      }
    }
    const rel = p.slice(WEB.length + 1);
    const allowed = SURVIVORS_ALLOWED[rel] ?? 0;
    if (survived > allowed) over.push(`${rel} — ${survived} survive (allowed ${allowed}); first at ${first}`);
  }

  assert.ok(judged > 3000, `judged only ${judged} files — the walk is not reading the repo`);
  assert.ok(commentsSeen > 10000, `TypeScript reported only ${commentsSeen} comments — the oracle is not seeing them`);
  assert.deepEqual(
    over,
    [],
    'comments TypeScript can see came out of stripComments still standing. Either a ' +
      'guard is now reading prose as code, or the lexer fell out of step and is ' +
      'reading code as prose. Fix the lexer — do not raise SURVIVORS_ALLOWED:\n  ' +
      over.join('\n  '),
  );
});

/**
 * ── THE TWIN ────────────────────────────────────────────────────────────────
 * `apps/web/scripts/port-controls.mjs` carries a byte-for-byte copy of this
 * lexer, because `allowJs: false` plus lint scripts running under plain node
 * means neither file can import the other. Its docblock has always ASKED for
 * the two to stay identical. Until now nothing checked, so a fix to one could
 * silently leave the other on the old behaviour — which is exactly the shape of
 * defect this whole module exists to prevent.
 */
test('🚨 the JS twin in scripts/port-controls.mjs agrees, character for character', async () => {
  // A variable specifier keeps TypeScript from resolving a .mjs it cannot type.
  const spec = join(WEB, 'scripts', 'port-controls.mjs');
  const twin = (await import(spec)) as { stripComments: (s: string) => string };

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };

  const disagreed: string[] = [];
  let compared = 0;
  for (const p of ['lib', 'app'].flatMap((r) => walk(join(WEB, r)))) {
    const src = readFileSync(p, 'utf8');
    compared += 1;
    if (twin.stripComments(src) !== stripComments(src)) disagreed.push(p.slice(WEB.length + 1));
    if (disagreed.length > 5) break;
  }
  assert.ok(compared > 3000, `compared only ${compared} files — the walk is not reading the repo`);
  assert.deepEqual(
    disagreed,
    [],
    'the two copies of the lexer have drifted. Port the change to BOTH:\n  ' + disagreed.join('\n  '),
  );
});
