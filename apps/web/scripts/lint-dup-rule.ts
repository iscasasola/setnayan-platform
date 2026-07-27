#!/usr/bin/env tsx
/**
 * ONE RULE, WRITTEN DOWN TWICE — the CI guard.
 *
 *   pnpm --filter @setnayan/web lint:dup-rule        # check   (exit 1 on a widening)
 *   pnpm --filter @setnayan/web dup-rule:baseline    # rewrite scripts/dup-rule.baseline.txt
 *
 * WHY THIS EXISTS. On 2026-07-27 a single day's review found the same failure
 * three separate times, in three unrelated features, written by three different
 * hands. Every one of them was a rule recorded in two places that then drifted:
 *
 *   · a fee rate hand-typed into ~11 files — one of them the vendor's BILL —
 *     which kept saying "flat 5%" for three days after the maths became a taper;
 *   · a page declaring `const keptItems`, shadowing the exported `keptItems`
 *     it already had in reach, so the receipt and the lock path disagreed about
 *     what a couple had bought;
 *   · two pages hand-typing a Supabase column list, one of them missing
 *     `item_id` (making a removal filter structurally unmatchable) and
 *     `is_required` (letting a mandatory line silently vanish).
 *
 * Two of those three are mechanically detectable, and this checks both:
 *
 *   GUARD 1 · SHADOWED EXPORTED HELPER — lib/security/shadowed-export-scan.ts
 *     A local declaration whose name is exported by a module THE SAME FILE
 *     ALREADY IMPORTS FROM. The qualifier is the design, not a detail: without
 *     it the identical scan reports 8,677 coincidental name collisions in this
 *     repo instead of 21 real ones, and a lint that cries wolf gets switched
 *     off, which is worse than no lint.
 *
 *   GUARD 2 · OMITTED CANONICAL COLUMN — lib/security/select-column-scan.ts §2
 *     A hand-typed `.select()` that is a near-copy of an exported `*_SELECT` /
 *     `*_COLUMNS` constant and drops part of it. An EXTENSION of the existing
 *     phantom-column scanner, not a rival to it: same `.from()`→`.select()`
 *     attribution, same select-list parser, same documented limits. A rival
 *     scanner would drift from that one exactly the way the two column lists
 *     drifted from each other.
 *
 * The third — prose asserting a computed number — is deliberately NOT guarded.
 * There is no way to tell "flat 5%" in a doc comment from "flat 5%" in a
 * customer-facing string from "5%" in an unrelated sentence without an
 * unacceptable false-positive rate, and a noisy guard is a deleted guard.
 *
 * Both guards are RATCHETS, not walls: today's hits are baselined in
 * scripts/dup-rule.baseline.txt, adding a line fails, removing one passes.
 * See lib/security/dup-rule-baseline.ts for why the keys are facts and not
 * line numbers.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_ROOT,
  BASELINE_PATH,
  dedupeFacts,
  diffAgainstBaseline,
  readBaseline,
  renderBaseline,
  type DupRuleFact,
} from '../lib/security/dup-rule-baseline';
import { scanShadowedExports } from '../lib/security/shadowed-export-scan';
import { scanForOmittedColumns } from '../lib/security/select-column-scan';

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

/**
 * Floors, mirroring the anti-vacuity assertions in the guards' own tests.
 * A scanner that silently stops matching (a regex drifts, a directory moves)
 * would otherwise pass forever while guarding nothing — which is exactly how
 * this bug class survived: everything downstream of it defaulted to empty.
 */
const MIN_FILES_SCANNED = 2000;
const MIN_LITERAL_SELECT_SITES = 2000;
const MIN_BOUND_CONSTANTS = 10;

const write = process.argv.includes('--write');

/* ── collect ────────────────────────────────────────────────────────────────*/

const shadow = scanShadowedExports(APP_ROOT);
const omit = scanForOmittedColumns(APP_ROOT);

const boundConstants = new Set(omit.constantSites.map((s) => s.constant)).size;

const vacuity: string[] = [];
if (shadow.filesScanned < MIN_FILES_SCANNED) {
  vacuity.push(
    `only ${shadow.filesScanned} source files walked (expected >= ${MIN_FILES_SCANNED}) — ` +
      'the file walk is broken, so GUARD 1 is guarding nothing.',
  );
}
if (omit.literalSites.length < MIN_LITERAL_SELECT_SITES) {
  vacuity.push(
    `only ${omit.literalSites.length} literal .select() sites found (expected >= ${MIN_LITERAL_SELECT_SITES}) — ` +
      'the select scanner is broken, so GUARD 2 is guarding nothing.',
  );
}
if (boundConstants < MIN_BOUND_CONSTANTS) {
  vacuity.push(
    `only ${boundConstants} canonical *_SELECT/*_COLUMNS constants resolved to a table ` +
      `(expected >= ${MIN_BOUND_CONSTANTS}) — GUARD 2 has nothing to compare against.`,
  );
}

const facts: DupRuleFact[] = [
  ...shadow.qualified.map((h): DupRuleFact => ({ kind: 'shadow', key: h.key })),
  ...omit.omissions.map((o): DupRuleFact => ({ kind: 'omit', key: o.key })),
];

/** file+key → where to point a human, for the failure message only. */
const whereShadow = new Map(shadow.qualified.map((h) => [h.key, h]));
const whereOmit = new Map(omit.omissions.map((o) => [o.key, o]));

/* ── --write ────────────────────────────────────────────────────────────────*/

if (write) {
  if (vacuity.length > 0) {
    console.error(`\n${RED}✗ refusing to write a baseline from a broken scan:${RST}`);
    for (const v of vacuity) console.error(`    ${v}`);
    console.error('');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, renderBaseline(facts), 'utf8');
  const written = dedupeFacts(facts);
  console.log(
    `${GRN}✓${RST} wrote ${path.relative(APP_ROOT, BASELINE_PATH)} — ` +
      `${written.length} facts (${written.filter((f) => f.kind === 'shadow').length} shadow · ` +
      `${written.filter((f) => f.kind === 'omit').length} omit).\n` +
      '  Read your own diff before committing. Every ADDED line is one more place\n' +
      '  this repo writes the same rule down twice.',
  );
  process.exit(0);
}

/* ── check ──────────────────────────────────────────────────────────────────*/

const baseline = readBaseline(BASELINE_PATH);
const { added, removed } = diffAgainstBaseline(facts, baseline.facts);

let failed = false;

if (vacuity.length > 0) {
  failed = true;
  console.error(`\n${RED}✗ VACUOUS SCAN — the guard is not guarding anything:${RST}`);
  for (const v of vacuity) console.error(`    ${v}`);
  console.error('');
}

if (baseline.problems.length > 0) {
  failed = true;
  console.error(`\n${RED}✗ BASELINE FILE IS NOT USABLE:${RST}`);
  for (const p of baseline.problems) console.error(`    ${p}`);
  console.error('');
}

if (removed.length > 0) {
  console.log(
    `${GRN}✓${RST} ${removed.length} baselined duplication(s) are gone. ` +
      'Regenerate to lock the win in:\n' +
      '    pnpm --filter @setnayan/web dup-rule:baseline\n' +
      removed
        .slice(0, 20)
        .map((f) => `      ${f.kind}  ${f.key.replace(/\t/g, ' · ')}`)
        .join('\n') +
      (removed.length > 20 ? `\n      … and ${removed.length - 20} more` : ''),
  );
}

const addedShadow = added.filter((f) => f.kind === 'shadow');
const addedOmit = added.filter((f) => f.kind === 'omit');

if (addedShadow.length > 0) {
  failed = true;
  console.error(
    `\n${RED}✗ GUARD 1 — ${addedShadow.length} NEW local declaration(s) shadow a helper the ` +
      `file already imports the module of:${RST}`,
  );
  for (const f of addedShadow) {
    const hit = whereShadow.get(f.key);
    const [file, name, owner] = f.key.split('\t');
    console.error(
      `    ${file}:${hit?.line ?? '?'}  ${YEL}${hit?.form ?? 'const'} ${name}${RST}` +
        `  — ${owner} already exports ${YEL}${name}${RST}` +
        (hit?.kind === 'imported' ? ` (and this file IMPORTS it — the local one wins)` : ''),
    );
  }
  console.error(
    `\n  Two definitions of one rule do not stay equal. Import the exported one and\n` +
      `  delete the local copy; if it genuinely needs to differ, give it a name that\n` +
      `  says how (\`keptItemsForReceipt\`), so the difference is visible at every call\n` +
      `  site instead of hidden behind a matching identifier.\n`,
  );
}

if (addedOmit.length > 0) {
  failed = true;
  console.error(
    `\n${RED}✗ GUARD 2 — ${addedOmit.length} NEW hand-typed select(s) drop a column the ` +
      `canonical list includes:${RST}`,
  );
  for (const f of addedOmit) {
    const hit = whereOmit.get(f.key);
    const [file, table, constant, column] = f.key.split('\t');
    console.error(
      `    ${file}:${hit?.line ?? '?'}  .from('${table}')  MISSING ${YEL}${column}${RST}` +
        `  — ${constant} has it` +
        (hit ? ` (${(hit.overlap * 100).toFixed(0)}% of that list reproduced here)` : ''),
    );
  }
  console.error(
    `\n  Every name in the list is real, so nothing else catches this: PostgREST\n` +
      `  returns rows, the query "works", and the page is quietly wrong. An absent\n` +
      `  boolean reads as FALSE and an absent id can never match a filter.\n` +
      `  Use the constant (\`.select(THE_CONSTANT)\`, or \`\\\`\${THE_CONSTANT}, extra\\\`\`).\n` +
      `  If the narrow read is deliberate, say so in the pull request and regenerate:\n` +
      `    pnpm --filter @setnayan/web dup-rule:baseline\n`,
  );
}

if (failed) {
  console.error(`Background: the header of ${path.relative(APP_ROOT, BASELINE_PATH)}\n`);
  process.exit(1);
}

const held = dedupeFacts(facts);
console.log(
  `${GRN}✓${RST} no NEW duplicated rules — ` +
    `${held.filter((f) => f.kind === 'shadow').length} shadowed helper(s) + ` +
    `${held.filter((f) => f.kind === 'omit').length} omitted column(s) baselined, shrink to win.\n` +
    `  scanned ${shadow.filesScanned} files · ${omit.literalSites.length} literal selects · ` +
    `${boundConstants} canonical column lists bound to a table.`,
);
