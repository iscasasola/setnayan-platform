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
