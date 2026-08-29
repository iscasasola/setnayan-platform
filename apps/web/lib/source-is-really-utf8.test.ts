/**
 * NO SHIPPED SOURCE FILE MAY CARRY DOUBLE-ENCODED TEXT.
 *
 * 🚨 WHAT THIS CAUGHT, AND WHY IT IS A REPO-WIDE GUARD RATHER THAN A PAGE ONE.
 * On 2026-08-28 the one payment page shipped with its peso sign rendered as
 * three junk characters, and three of its sentences carrying junk where an em
 * dash belonged — including the amount the buyer is being asked to send. The
 * whole file had been read back as latin-1 and re-saved as UTF-8 by an editing
 * pass, so every byte >= 0x80 in it became two or three characters. Nothing
 * threw, nothing failed to compile, no test noticed, and the owner found it on
 * the screen that asks him for money.
 *
 * 🔑 THE SHAPE: this is the ENCODING member of the family this repo keeps
 * paying for — the original character is simply gone and the only symptom is
 * what a person reads. TypeScript, lint, the build and every existing test are
 * completely happy: a mangled peso sign is a perfectly valid string literal.
 * A byte-level scan is the only place it can be caught.
 *
 * ⚠ IT IS NOT ENOUGH TO CHECK THE FILE THAT BROKE. The corruption comes from
 * the TOOL that wrote the file, not from the file, so the next one will be
 * somewhere else entirely. This walks the directories, never a hand-listed set
 * of files — a hand-enumerated list is a list of the files somebody thought of.
 *
 * HOW THE DETECTION WORKS — and why it cannot cry wolf on real text.
 * Double-encoding always leaves a lead character (U+00C2, U+00C3, U+00E2,
 * U+00F0 …) followed by more characters in U+0080–U+00FF. We do NOT match on
 * those characters alone: a legitimate `é` or `°` lives in that range too. We
 * re-encode each run as latin-1 and report it only when the bytes decode as
 * VALID UTF-8 that is strictly SHORTER — which is the definition of a double
 * encoding, and not something real prose does. Emoji, box drawing, em dashes,
 * curly quotes and the peso sign itself are outside latin-1 entirely, so they
 * can never be encoded and can never match.
 *
 * 🔒 THIS FILE CARRIES NO RAW MOJIBAKE OF ITS OWN. Its fixtures are built from
 * codepoints, because a self-exemption is the one hole that would hide the
 * next real offender.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = process.cwd();
const REPO = join(WEB, '..', '..');

/** Where shipped text lives. */
const ROOTS = [
  join(WEB, 'app'),
  join(WEB, 'lib'),
  join(WEB, 'components'),
  join(WEB, 'models'),
  join(REPO, 'supabase', 'migrations'),
];
const EXTENSIONS = ['.ts', '.tsx', '.sql', '.css', '.mjs', '.json'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out);
    } else if (EXTENSIONS.some((x) => e.name.endsWith(x))) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/** Every run of U+0080–U+00FF that is really a double-encoded character. */
export function doubleEncodedRuns(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/[-ÿ]{2,8}/g)) {
    const run = m[0];
    for (let end = run.length; end > 1; end--) {
      const head = run.slice(0, end);
      // latin-1 is byte-per-character, and the pattern already guarantees
      // every character in the run is <= U+00FF.
      const bytes = Buffer.from(Array.from(head, (c) => c.charCodeAt(0)));
      let decoded: string;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        continue;
      }
      if (decoded.length < head.length) {
        found.push(head);
        break;
      }
    }
  }
  return found;
}

/** The junk a real character turns into when its UTF-8 bytes are read as latin-1. */
const asLatin1 = (s: string) =>
  String.fromCharCode(...Array.from(Buffer.from(s, 'utf8')));

const FILES = ROOTS.flatMap((r) => walk(r));

test('the scan is not vacuous — it really reads the source tree', () => {
  // A guard that silently scans nothing is indistinguishable from a clean
  // result. Floored well below today's count, so an ordinary deletion does not
  // turn this into a second failing test.
  assert.ok(
    FILES.length > 3000,
    `only ${FILES.length} source files scanned — the roots have moved`,
  );
});

test('the detector actually detects — the exact bytes that shipped are caught', () => {
  const brokenPeso = asLatin1('₱'); // what '₱' became on the payment page
  assert.equal(brokenPeso.length, 3);
  assert.deepEqual(doubleEncodedRuns(brokenPeso), [brokenPeso]);

  const brokenDash = asLatin1('—'); // and what the em dashes became
  assert.deepEqual(
    doubleEncodedRuns(`bank app ${brokenDash} the amount`),
    [brokenDash],
  );
});

test('the detector does not cry wolf on real non-ASCII text', () => {
  // Everything this repo legitimately writes, plus adjacent accented letters,
  // which are the only realistic false-positive shape. A guard that fires on
  // correct text teaches you to skim past the one time it is right.
  const honest =
    '₱2,499 — “Set na ’yan.” · ⚖ \u{1f511} ⚠ ' +
    '── café · 30° · Zoë Ångström · ' +
    'àèìòù · Ñoño · Ang Lahat… ✅';
  assert.deepEqual(doubleEncodedRuns(honest), []);
});

test('no shipped source file carries double-encoded text', () => {
  const offenders: string[] = [];
  for (const file of FILES) {
    let text: string;
    try {
      if (statSync(file).size > 4_000_000) continue;
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter: the lead characters every double-encoding starts with.
    if (!/[ÂÃâðÅ]/.test(text)) continue;
    const runs = doubleEncodedRuns(text);
    if (runs.length) {
      offenders.push(
        `${relative(REPO, file)} — ${runs.length}x, first at ` +
          JSON.stringify(runs[0]),
      );
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'double-encoded text in shipped source: the file was read back as latin-1 ' +
      'and re-saved. Repair the characters in place — do not retype the ' +
      `sentence around them.\n${offenders.join('\n')}`,
  );
});
