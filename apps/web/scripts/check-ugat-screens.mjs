#!/usr/bin/env node
/**
 * check-ugat-screens.mjs — the Screens · Doors layer of the Ugat map cannot drift.
 *
 *   node apps/web/scripts/check-ugat-screens.mjs
 *
 * Owner, 2026-10-02 (DECISION_LOG "ONE MAP OF THE APP" + "THE APP MAP STARTS
 * FRIDAY"): the map is generated from code, and its CI checks sit beside the
 * Ugat / interconnection ones. Slice 1 ships this check in REPORT MODE:
 *
 *   FAILS  only when the committed lib/ugat/screens.generated.json differs from
 *          a fresh scan — a page or a door changed and nobody re-ran
 *          `pnpm --filter @setnayan/web ugat:screens`. Same posture as
 *          admin-map-is-generated.test.ts: a generated file nobody re-checks is
 *          just a hand-maintained list that happened to be right once.
 *   PRINTS the no-door, unmapped and doors-to-nowhere counts, and any no-door
 *          screen that is NOT in today's baseline (lib/ugat/screens-no-door.baseline.txt).
 *
 * TODO(ugat slice 2, Sat 3 Oct — owner: "its CI checks switch on Saturday"):
 *   flip RATCHET_ENFORCED to true, so a NEW no-door screen (one not in the
 *   baseline) and any door to nowhere fail the build. Removing a line from the
 *   baseline is a fix and must stay silent; adding one needs a written reason.
 *   Regenerate the baseline only with `ugat:screens --baseline`.
 *
 * Sabotage (must exit 1): add a page under apps/web/app without re-running the
 * generator, or edit one line of screens.generated.json by hand.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMITTED = join(WEB, 'lib/ugat/screens.generated.json');
const BASELINE = join(WEB, 'lib/ugat/screens-no-door.baseline.txt');

/** Slice 2 turns this on. Until then the ratchet only reports. */
const RATCHET_ENFORCED = false;

const tsxBin = [join(WEB, 'node_modules/.bin/tsx'), join(WEB, '../../node_modules/.bin/tsx')].find(existsSync);
if (!tsxBin) {
  console.error('check-ugat-screens: tsx not found — run pnpm install first.');
  process.exit(2);
}

const run = spawnSync(tsxBin, [join(WEB, 'scripts/gen-ugat-screens.ts'), '--stdout'], {
  cwd: WEB,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  console.error('check-ugat-screens: the scanner itself failed (above).');
  process.exit(2);
}

const fresh = run.stdout;
const committed = existsSync(COMMITTED) ? readFileSync(COMMITTED, 'utf8') : '';
const map = JSON.parse(fresh);

const screens = map.screens;
const count = (f) => screens.filter(f).length;
const noDoor = screens.filter((s) => s.status === 'no-door');
const summary = {
  screens: screens.length,
  connected: count((s) => s.status === 'connected'),
  noDoor: noDoor.length,
  stubs: count((s) => s.status === 'stub'),
  unmapped: count((s) => s.status !== 'stub' && s.nodes.length === 0),
  brokenDoors: map.brokenDoors.length,
};

console.log('Root map (Ugat) — Screens · Doors');
console.log(
  `  ${summary.screens} screens · ${summary.connected} connected · ${summary.noDoor} no door · ` +
    `${summary.stubs} legacy stubs · ${summary.unmapped} unmapped · ${summary.brokenDoors} doors to nowhere`,
);

const baseline = new Set(
  existsSync(BASELINE)
    ? readFileSync(BASELINE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
);
const newNoDoor = noDoor.filter((s) => !baseline.has(s.route));
for (const s of newNoDoor) {
  console.log(`  ${RATCHET_ENFORCED ? '::error::' : '::warning::'}new screen with no door: ${s.route} (${s.file})`);
}
for (const b of map.brokenDoors) {
  console.log(`  ${RATCHET_ENFORCED ? '::error::' : '::warning::'}door to nowhere: ${b.to} in ${b.from}`);
}
const fixed = [...baseline].filter((r) => !noDoor.some((s) => s.route === r));
if (fixed.length) {
  console.log(`  ${fixed.length} baselined screen(s) now have a door — drop them from the baseline:`);
  for (const r of fixed) console.log(`    ${r}`);
}

let failed = false;
if (fresh !== committed) {
  failed = true;
  const freshLines = new Set(fresh.split('\n'));
  const oldLines = new Set(committed.split('\n'));
  const added = [...freshLines].filter((l) => !oldLines.has(l));
  const gone = [...oldLines].filter((l) => !freshLines.has(l));
  const routeOf = (l) => (l.match(/"route":"([^"]+)"/) ?? l.match(/"to":"([^"]+)"/) ?? [])[1] ?? l.slice(0, 80);
  console.error('');
  console.error('::error::lib/ugat/screens.generated.json is stale — a screen or a door changed.');
  console.error('Re-run:  pnpm --filter @setnayan/web ugat:screens   and commit the result.');
  const changed = [...new Set([...added, ...gone].map(routeOf))].filter(Boolean).slice(0, 25);
  if (changed.length) console.error(`Changed: ${changed.join(' · ')}`);
}
if (RATCHET_ENFORCED && (newNoDoor.length || map.brokenDoors.length)) failed = true;

if (failed) process.exit(1);
console.log('  committed map is current (report mode — the no-door ratchet switches on in slice 2).');
