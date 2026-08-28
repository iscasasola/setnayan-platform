/**
 * GUARD — the four facts never invent a number.
 *
 * `WhereYouStand` answers the first question a person asks on opening Papic:
 * where do I stand? It reads three counts and a credit balance. **Every one of
 * them must fail to an em dash, never to `0`.**
 *
 * 🚨 WHY THIS IS THE RULE AND NOT A PREFERENCE. A failed read that renders
 * "Empty — yours to start" tells a couple their wedding photographs are gone.
 * It is the most alarming sentence this strip can produce, and a network blip
 * is enough to produce it. There is no user-visible difference between "we
 * could not read it" and "there is nothing there" unless the code makes one.
 *
 * 🔑 SUPABASE DOES NOT THROW ON A FAILED READ — it resolves with `{ error }`.
 * So a `try/catch` around one of these is decoration, and the only real check
 * is an explicit `.error` test per read.
 *
 * 🔑 `{ count }` IS A DIFFERENT SHAPE FROM `{ data }`. A guard written for
 * `data` cannot see a count read fail. In this repo an invented zero has
 * already triggered a WRITE; here it would only mislead, which is bad enough.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = join(PAPIC_DIR, 'page.tsx');

// ⚠ THE READS AND THE RENDER LIVE IN TWO FILES NOW, AND THE RULES FOLLOWED THEM
// RATHER THAN BEING RELAXED. On 2026-08-28 the four facts moved onto the dark
// stage, and the counts behind them moved into one shared reader because the
// stage needs the same answer ("is the library empty?") that the strip reports.
// Two components counting the same thing is a definition twice.
//
// So: the READ rules below are asserted against the reader, and the RENDER rules
// against the stage. Neither was dropped — check both files before concluding
// this guard got easier.
const READER = join(PAPIC_DIR, '..', '..', '..', '..', '..', 'lib', 'papic-standings.ts');
const STAGE = join(PAPIC_DIR, '_components/papic-stage.tsx');
const READS = readFileSync(READER, 'utf8');
const SRC = readFileSync(STAGE, 'utf8');

/** The reads this strip makes, derived from the source rather than typed here. */
function countReads(): string[] {
  return [...READS.matchAll(/(\w+)\s*=\s*await Promise\.all|from\('([a-z_]+)'\)/g)]
    .map((m) => m[2])
    .filter((t): t is string => !!t);
}

test('the strip still makes its reads — otherwise every rule below is vacuous', () => {
  const tables = countReads();
  assert.ok(
    tables.length >= 3,
    `expected at least 3 table reads in the facts strip, found ${tables.length}: ${tables.join(', ')}`,
  );
});

test('🚨 every count read checks its own error explicitly', () => {
  // One `if (xRes.error)` per read result. A catch cannot see a Supabase
  // rejection, so this is the only check that exists.
  const results = /const \[([^\]]+)\]\s*=\s*await Promise\.all/.exec(READS)?.[1];
  assert.ok(results, 'the Promise.all destructure is gone — the reads were restructured');
  const names = results
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.endsWith('Res'));
  assert.ok(names.length >= 3, `expected 3+ *Res results, found ${names.join(', ') || 'none'}`);
  const unchecked = names.filter((n) => !new RegExp(`if \\(${n}\\.error\\)`).test(READS));
  assert.deepEqual(unchecked, [], `these reads never check their error: ${unchecked.join(', ')}`);
});

test('🚨 a failed read resolves to null, never to a number', () => {
  for (const [value, guard] of [
    ['cameras', 'seatRes.error'],
    ['inLibrary', 'photoRes.error || guestRes.error'],
  ] as const) {
    // ⚠ MATCH THE RULE, NOT ONE SYNTAX. These were `const cameras = …;` while
    // the strip did its own reads; the shared reader returns them as fields of
    // one object (`cameras: …,`). Same rule, same fallback, different
    // expression — a guard that only knows one spelling reports a defect that
    // is not there, which this repo has paid for more than once.
    const line =
      new RegExp(`const ${value}\\s*=[\\s\\S]{0,160}?;`).exec(READS)?.[0] ??
      new RegExp(`\\b${value}:[\\s\\S]{0,160}?,\\n`).exec(READS)?.[0] ??
      '';
    assert.ok(line.includes(guard), `${value} no longer branches on ${guard}`);
    assert.ok(
      /\?\s*null/.test(line),
      `${value} falls back to something other than null on a failed read — a number here is a lie a couple will believe`,
    );
  }
  assert.ok(
    /\bcredits\s*[:=][\s\S]{0,140}?pool\.ok[\s\S]{0,140}?:\s*null/.test(READS),
    'credits no longer resolves to null when the pool read fails',
  );
});

test('🚨 an unmeasured fact renders a dash, and 0 is only ever a real 0', () => {
  assert.ok(SRC.includes('function Unmeasured()'), 'the Unmeasured fallback is gone');
  const uses = SRC.split('<Unmeasured />').length - 1;
  assert.ok(uses >= 3, `only ${uses} facts fall back to a dash — every read needs one`);
  // The empty-library sentence must sit behind an explicit `=== 0`, never behind
  // a falsy check that a null would also satisfy.
  assert.ok(
    /inLibrary === 0 \?/.test(SRC),
    '"Empty — yours to start" is no longer gated on an exact 0 — a null would render it, telling a couple their photographs are gone',
  );
});

test('the strip comes before anything that asks the couple to decide', () => {
  // ⚠ THIS USED TO READ "above the rooms". The rooms were deleted on
  // 2026-08-27 (one page, four ways in), which made `indexOf` return -1 and the
  // comparison pass or fail for reasons that had nothing to do with the rule.
  // The rule itself never mentioned tabs: a person is told the state of their
  // own celebration BEFORE anything asks them for a decision. Reversing that is
  // how this screen came to open on a look picker.
  const page = readFileSync(PAGE, 'utf8');
  const mount = page.indexOf('<PapicStage');
  assert.ok(mount > 0, 'the stage is not mounted');

  for (const [what, needle] of [
    ['the one next step', 'Do this first · then the library fills itself'],
    ['the four ways in', 'Four ways into your library'],
    ['the set-once rows', 'Set once, change any time'],
  ] as const) {
    const at = page.indexOf(needle);
    assert.ok(at > 0, `"${needle}" is gone — this guard has lost the anchor for ${what}`);
    assert.ok(
      mount < at,
      `the facts strip now renders AFTER ${what} — a person is asked to decide something before being told where they stand`,
    );
  }
});

test('the attention colour is the one that passes in BOTH themes', () => {
  assert.ok(!SRC.includes('mulberry-700'), 'mulberry-700 is 3.05:1 on a dark panel — a fail a light-only check waves through');
});
