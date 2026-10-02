#!/usr/bin/env node
/**
 * check-ugat-screens.mjs — the Root map's CI check (part 1 + part 2).
 *
 *   node apps/web/scripts/check-ugat-screens.mjs
 *
 * Owner, 2026-10-02 (DECISION_LOG "ONE MAP OF THE APP" + "THE APP MAP STARTS
 * FRIDAY": "its CI checks switch on Saturday"). Two halves:
 *
 *   1. THE SCREENS MAP IS CURRENT. Fails when the committed
 *      lib/ugat/screens.generated.json differs from a fresh scan — a page or a
 *      door changed and nobody re-ran `pnpm --filter @setnayan/web ugat:screens`.
 *      Same posture as admin-map-is-generated.test.ts.
 *   2. THE RATCHET (part 2 — RATCHET_ENFORCED is ON). `scripts/root-map.ts
 *      --check` runs every Root map check — no-door screens, doors to nowhere
 *      and missing #sections, one fact two homes, event answers outside Your
 *      info, filled-but-dropped fields, typed live numbers, the same fact shown
 *      twice — and fails on any finding NOT in lib/ugat/baselines/*. The
 *      judgement checks (door words, retarget, saved-but-never-used,
 *      sanitisers) warn instead. A fixed finding passes silently and asks to
 *      be dropped; `pnpm --filter @setnayan/web root-map --baseline` is the
 *      only writer of the baselines.
 *
 * Sabotage (must exit 1): add a page under apps/web/app without re-running the
 * generator; or type "190 days to go" into any screen; or add a form input its
 * action never reads.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMITTED = join(WEB, 'lib/ugat/screens.generated.json');

/** Part 2 (Sat 3 Oct) turned this on: new findings of an enforced kind fail the build. */
const RATCHET_ENFORCED = true;

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
console.log('Root map — Screens · Doors');
console.log(
  `  ${screens.length} screens · ${count((s) => s.status === 'connected')} connected · ` +
    `${count((s) => s.status === 'no-door')} no door · ${count((s) => s.status === 'stub')} legacy stubs · ` +
    `${count((s) => s.status !== 'stub' && s.nodes.length === 0)} unmapped · ${map.brokenDoors.length} doors to nowhere`,
);

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

/* ── part 2: every check, ratcheted against lib/ugat/baselines/* ── */
// Reads the COMMITTED screens map (half 1 above already fails if it is stale)
// and scans the code fresh for everything else.
const checkArgs = [join(WEB, 'scripts/root-map.ts'), '--check'];
const ratchet = spawnSync(tsxBin, checkArgs, {
  cwd: WEB,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
process.stdout.write(ratchet.stdout ?? '');
process.stderr.write(ratchet.stderr ?? '');
if (ratchet.status === 2 || ratchet.status === null) {
  console.error('check-ugat-screens: the Root map checks themselves failed (above).');
  process.exit(2);
}
if (ratchet.status !== 0 && RATCHET_ENFORCED) failed = true;

if (failed) process.exit(1);
console.log('  Root map is current and nothing new broke (ratchet ON).');
