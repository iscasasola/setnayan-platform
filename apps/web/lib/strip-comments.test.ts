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
