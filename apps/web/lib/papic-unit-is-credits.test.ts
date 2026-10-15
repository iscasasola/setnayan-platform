/**
 * GUARD — ONE unit word on every Papic surface: "credits" (owner 2026-10-13,
 * "Add all" — tester item 4: "today credits / shots / points"). A shot is still
 * a photo someone takes ("That shot didn't save"); what is COUNTED, bought, left
 * or run out of is a credit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SURFACES = [
  'app/dashboard/[eventId]/studio/papic/_components/credit-stepper.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/guest-contributions-card.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/papic-stage.tsx',
  'app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx',
  'app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx',
  'app/papic/guest/_components/papic-guest-capture.tsx',
  'app/papic/seat/[token]/_components/papic-seat-capture.tsx',
  'app/papic/order/[token]/page.tsx',
  'app/papic/_components/papic-buy-shell.tsx',
  'app/papic/demo/[token]/_components/demo-join-flow.tsx',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx',
  'lib/papic-crew-roster.ts',
  'lib/papic-exhaustion-truth.ts',
  'lib/papic-guest-buy.ts',
  // 2026-10-15: the onboarding Papic card printed "50 pts / +3,000 pts" and the
  // supplier's on-the-day badge "Papic Lite · 1,000 pts". Neither file was on
  // this list, and the rule below only knew the spelled-out words.
  'app/onboarding/_shared/services-step.tsx',
  'lib/vendor-papic-tier.ts',
];

/** The unit, counted: N shots / points left · out of shots · adds N shots · added points … */
const UNIT = /\b(?:shots?|points?) (?:left|are live|ran out|remain)|out of (?:shots|points)|adds [^'"`]{0,40}\bshots\b|added (?:points|[^'"`]{0,40}\bshots\b)|\bshots (?:are bought|into the)|Capture points/i;

for (const rel of SURFACES) {
  test(`${rel}: the unit is credits`, () => {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const hit = src.match(UNIT);
    assert.equal(hit, null, `${rel} counts in shots/points again: "${hit?.[0]}"`);
  });
}

/**
 * 🔤 THE ABBREVIATION, COUNTED — "50 pts", `${n} pts`. Why the list above missed it
 * (2026-10-15): it is a HAND-PICKED list of files, and its rule only matched the
 * spelled-out phrasings ("shots left", "out of points"). The onboarding card's
 * `${n} pts` helper and the supplier badge were in neither. So this half is a
 * property of the whole shipped tree, not of a list: no code (comments stripped)
 * may put a number in front of "pts". A variable NAMED pts is fine — only a
 * number or an interpolation followed by the word counts.
 */
const PTS = /(?:\d|\})\s?pts\b/;
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('no shipped code counts in "pts" — the unit a person reads is credits', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `only ${files.length} files scanned — the walk is blind`);
  const offenders = files
    .map((f) => [f.slice(WEB.length + 1), stripComments(readFileSync(f, 'utf8')).match(PTS)?.[0]] as const)
    .filter(([, hit]) => hit)
    .map(([f, hit]) => `${f}: "${hit}"`);
  assert.deepEqual(offenders, [], 'a number is labelled "pts" — say credits');
});
