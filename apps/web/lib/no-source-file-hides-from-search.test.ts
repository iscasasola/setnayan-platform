/**
 * no-source-file-hides-from-search.test.ts — S1.
 *
 * A single NUL byte in a source file makes that whole file INVISIBLE to the
 * project's default search tool, silently.
 *
 * ── THE MECHANISM, MEASURED ────────────────────────────────────────────────────
 * `grep` in a Claude Code session is not `/usr/bin/grep`. `type grep` resolves to a
 * shell function that execs the claude binary as **ugrep** with `-I` — ignore
 * binary files — and ugrep calls a file binary if it contains one NUL. Measured on
 * `app/[slug]/_components/editorial/data.ts` before this landed:
 *
 *     grep  -c export <file>          ->  (nothing)   exit 1
 *     grep  -ac export <file>         ->  45          exit 0     (force text)
 *     /usr/bin/grep -c export <file>  ->  45          exit 0
 *     grep  -rc <its directory>       ->  every sibling listed, THIS FILE ABSENT
 *
 * No warning. No "Binary file matches" line. It reads exactly like *0 matches*, and
 * a recursive sweep simply does not mention the file.
 *
 * 🔑 THE COST IS NOT THE SEARCH, IT IS EVERY ABSENCE EVER CONCLUDED FROM ONE. That
 * file is the editorial resolver for the guest page — timeline, gallery, photo wall,
 * Pakanta song, vendor media. Any "nothing reads X" or "nothing writes X" claim made
 * with a bare sweep had never looked at it. This repo decides things on exactly that
 * kind of claim.
 *
 * ── WHY THE FIX IS SAFE ────────────────────────────────────────────────────────
 * Every NUL here was DELIBERATE — two sort sentinels and three test fixtures that
 * assert NUL input is rejected — and each is now written `\u0000` instead of as a raw
 * byte. That is the identical runtime string in a literal and in a template literal,
 * so nothing about behaviour, sorting or the assertions changes. Only the file's
 * classification does.
 *
 * ── WHAT THIS GUARD DOES ───────────────────────────────────────────────────────
 * Walks the REPOSITORY ROOT with `readdirSync` and fails if any source file carries a
 * raw NUL - changelog fragments, migrations and workflows included.
 *
 * ⚠ DELIBERATELY NOT `grep`. A grep-based version of this test could never fail: the
 * tool cannot see the files it is looking for. That is the joke at the centre of this
 * whole row, and it is the reason the walk is in node.
 *
 * ⚠ SOURCE EXTENSIONS ONLY, AND THAT FILTER IS LOAD-BEARING. Fonts, images and other
 * binaries are FULL of NULs and must never be touched. The first cut of the repair
 * script walked without a filter and rewrote 944 `.woff2` files before git restored
 * them. When a working check is re-implemented somewhere new, the filter is the first
 * thing that goes missing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/*
 * THE REPOSITORY ROOT, NOT `apps/web`, AND THE FIRST VERSION OF THIS GUARD GOT IT
 * WRONG IN THE MOST INSTRUCTIVE WAY AVAILABLE.
 *
 * It walked `apps/web` only. The PR that introduced it added a raw NUL to its own
 * `changelog.d/` fragment - at the repo root, outside the walk - and the guard went
 * GREEN on a branch that shipped exactly the thing it exists to forbid. It could not
 * see its own PR.
 *
 * Also outside `apps/web`: `supabase/migrations/`, root `scripts/`, every `.github`
 * workflow, and every changelog fragment. A guard against invisible files must not
 * have a blind spot of its own.
 */
// lib -> apps/web -> apps -> the repository root. THREE levels: the first attempt
// used two, which lands back on `apps/web` and walked 5,982 files instead of the
// whole tree - a widening that looked done and changed nothing.
const ROOT = join(HERE, '..', '..', '..');

/** Text we author. Anything else may legitimately be binary. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|md|sql|ya?ml|txt|svg|html)$/;
const SKIP = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  'coverage',
  'playwright-report',
  'dist',
  'build',
  'target',
]);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (SOURCE.test(e.name)) out.push(full);
    }
  };
  walk(ROOT);
  return out;
}

test('no source file in the repository carries a raw NUL byte', () => {
  const files = sourceFiles();
  console.log(`  source files walked: ${files.length}`);
  /*
   * A floor, because a walk that silently matched nothing would report a
   * perfectly clean sweep — 0 of 0 — which is the same shape of false green this
   * guard exists to end.
   */
  /*
   * THE FLOOR IS SET ABOVE WHAT `apps/web` ALONE CONTAINS (5,982), NOT ABOVE ZERO.
   * A floor of 3,000 was the first version, and it would have passed silently when
   * the root was accidentally two levels up instead of three - a widening that
   * looked done, walked the same subtree, and changed nothing. A floor only earns
   * its place if it fails the mistake actually made.
   */
  assert.ok(
    files.length > 8000,
    `floor: expected 8000+ source files across the repo, walked ${files.length} - ` +
      'that is roughly `apps/web` alone, so ROOT is pointing at the wrong level',
  );

  const hiding: string[] = [];
  for (const f of files) {
    const buf = readFileSync(f);
    const at = buf.indexOf(0);
    if (at >= 0) {
      const line = buf.subarray(0, at).toString('utf8').split('\n').length;
      hiding.push(`${f.slice(ROOT.length + 1)}:${line}`);
    }
  }
  console.log(`  files invisible to a bare grep: ${hiding.length}`);
  assert.deepEqual(
    hiding,
    [],
    'these carry a raw NUL, so `grep` skips them SILENTLY — every absence concluded ' +
      'from a bare sweep has never seen them. Write the byte as `\\u0000`, which is the ' +
      `identical string at runtime:\n  ${hiding.join('\n  ')}`,
  );
});

test('the escaped sentinels are still exactly U+0000', () => {
  /*
   * The repair is only safe if the escape is the same string as the byte. Asserted
   * rather than assumed, because the whole change rests on it — a sort sentinel that
   * silently became the six characters `\u0000` would reorder a couple's timeline.
   */
  const sentinel = '\u0000untimed';
  console.log(`  '\\u0000untimed' length ${sentinel.length}, first code point ${sentinel.codePointAt(0)}`);
  assert.equal(sentinel.length, 'untimed'.length + 1);
  assert.equal(sentinel.codePointAt(0), 0);
  // And it still sorts before every printable character, which is what it is for.
  assert.ok(sentinel < 'a', 'the sentinel no longer sorts ahead of ordinary days');
  assert.ok(sentinel < '0', 'the sentinel no longer sorts ahead of a date string');

  const joined = `${'a'}\u0000${'b'}`;
  assert.equal(joined.split('\u0000').length, 2, 'the code-map key separator stopped splitting');
});
