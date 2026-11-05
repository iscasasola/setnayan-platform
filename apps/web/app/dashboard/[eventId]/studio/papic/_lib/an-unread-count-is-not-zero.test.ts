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
const READS = readFileSync(READER, 'utf8');
// 📍 The dark stage that DREW the facts (`papic-stage.tsx`) is deleted (2026-10-24): it was mounted nowhere once the
// library moved to Memories (`tests/db/ugat-both-ends` found it). Its two render rules went with it — the honest count
// is now Memories' own (`memories/the-memories-tab-is-this-events-memories.test.ts`) and Home's card says "—" through
// `papicGlance`. The READ rules below stay: the shared reader still feeds the band and the card.

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

test('a person is told where they stand before anything asks them to decide', () => {
  // 📷 2026-10-23 (owner): the Papic page is the camera only, in ONE order — the phase map that re-ordered the files is
  // gone with the files (Memories). So DOM order IS visual order again, and the property is asserted on it directly:
  // the running balance (the credits band — where they stand) comes before the camera settings (what they decide).
  // 📷 2026-10-24 (owner: ONE Papic card): the balance is the card's controller — the counter, inside the camera
  // settings, comes before the first decision (the Settings heading).
  // 📷 2026-10-26 (owner: "the count of the total, taken, remaining and a button to add more"; the Papic page removed):
  // the balance is on the card's FACE — Total · Taken · Remaining — drawn before the settings region it opens.
  const page = readFileSync(join(PAPIC_DIR, '..', '..', 'page.tsx'), 'utf8');
  assert.match(page, /counts: \{ total: papicNow\.total, left: papicNow\.count \}/, 'Home hands the card no balance — it tells nobody where they stand');
  const card = readFileSync(join(PAPIC_DIR, '..', '..', '_components', 'papic-home-card.tsx'), 'utf8');
  const face = card.indexOf('data-papic-card-face=""');
  const settings = card.indexOf('data-papic-home-settings=');
  assert.ok(face > 0, 'the counts are not drawn — the card tells nobody where they stand');
  assert.ok(settings > 0, 'the camera settings are not drawn');
  assert.ok(face < settings, 'the camera settings ask for decisions before the balance says where the couple stands');
  assert.doesNotMatch(page, /\bBLOCK_ORDER\b/, 'a phase map is back — DOM order would stop being visual order');
});
