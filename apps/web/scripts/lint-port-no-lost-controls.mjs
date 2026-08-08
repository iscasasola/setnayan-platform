#!/usr/bin/env node
/**
 * lint-port-no-lost-controls.mjs — A PORTED ROUTE MAY NOT LOSE A WAY OUT.
 *
 * The one rule: every destination and every bound server action a route offered
 * when the baseline was taken must still be offered. Nothing about layout,
 * spacing, type, colour or copy — the port is SUPPOSED to change all of that.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * On 2026-08-06 an agent deleted two real controls from the couple's guest page
 * — "Invite guests" and "Arrange the room" — on a clean origin/main. All twelve
 * existing lint scripts, typecheck and Lighthouse passed BYTE-IDENTICALLY. That
 * is not an oversight anyone can patch: this repo has NO render harness, ~14% of
 * pages are named in any test, and every other guard fires on a wrong thing
 * ADDED while a port REMOVES.
 *
 * It has already cost us once — the /panood port dropped the YouTube API
 * Services disclosure, the compliance paragraph Live Studio's Google review
 * depends on, and a manual diff caught it rather than CI.
 *
 * Those exact two controls are in the baseline. This guard would have caught it.
 *
 * ── DIRECTION, AND THE ESCAPE HATCH ─────────────────────────────────────────
 * Missing → FAIL. Added → PASS; a port may give a page more. A DELIBERATE
 * removal is legitimate and is handled by regenerating the baseline IN THE SAME
 * PR (`pnpm --filter @setnayan/web port:baseline`), which puts the removed
 * control in the diff as one readable line in front of a reviewer. That is the
 * whole mechanism: it does not forbid removing things, it forbids removing them
 * SILENTLY.
 *
 * ── DELETING THIS FILE ──────────────────────────────────────────────────────
 * It is scoped to the port. When the ~40 units are ported and the archetypes are
 * the app, delete this script and its baseline in one PR. A guard kept past its
 * purpose becomes noise, and a guard that cries wolf teaches you to skim past
 * the one time it is right.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBaseline } from './port-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const BASELINE = join(HERE, 'port-control-baseline.json');

if (!existsSync(BASELINE)) {
  console.error('❌ port-control-baseline.json is missing. Run: pnpm --filter @setnayan/web port:baseline');
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const now = buildBaseline(join(WEB, 'app'));

// ── NON-VACUITY ─────────────────────────────────────────────────────────────
// A guard that cannot fail is decoration. If the app root moved, or the
// extractor silently stopped matching, `now` goes empty and EVERY route would
// "pass" by having nothing to compare. Refuse that outcome loudly.
const nowRoutes = Object.keys(now).length;
const nowDestinations = Object.values(now).reduce((n, r) => n + r.destinations.length, 0);
const nowBlocks = Object.values(now).reduce((n, r) => n + (r.blocks?.length ?? 0), 0);
if (nowRoutes < 300 || nowDestinations < 400 || nowBlocks < 1000) {
  console.error(
    `❌ EXTRACTOR IS NOT SEEING THE APP: ${nowRoutes} routes / ${nowDestinations} destinations / ` +
      `${nowBlocks} blocks (baseline had ${base.routeCount} / ${base.destinations} / ${base.blocks ?? '?'}).\n` +
      `   This guard would pass everything in this state, so it fails instead.`,
  );
  process.exit(1);
}

const problems = [];
let checkedRoutes = 0;
let checkedControls = 0;
let checkedBlocks = 0;

for (const [route, before] of Object.entries(base.routes)) {
  const after = now[route];

  // A route that no longer exists is NOT this guard's business — deleting or
  // renaming a route is a visible, deliberate act with its own review, and the
  // repo's own redirect conventions cover bookmark continuity. Flagging it here
  // would make the guard fire on ordinary work, which is how a guard gets
  // deleted rather than heeded.
  if (!after) continue;

  checkedRoutes += 1;
  const lostDestinations = before.destinations.filter((d) => !after.destinations.includes(d));
  const lostActions = before.actions.filter((a) => !after.actions.includes(a));
  // A pre-blocks baseline has no `blocks` key. Treat that as "not recorded" and
  // check nothing, rather than reading undefined as an empty set — which would
  // report every block on every route as lost the first time anyone rebased.
  const lostBlocks = Array.isArray(before.blocks)
    ? before.blocks.filter((b) => !(after.blocks ?? []).includes(b))
    : [];
  checkedControls += before.destinations.length + before.actions.length;
  checkedBlocks += Array.isArray(before.blocks) ? before.blocks.length : 0;

  if (lostDestinations.length || lostActions.length || lostBlocks.length) {
    problems.push({ route, lostDestinations, lostActions, lostBlocks });
  }
}

if (problems.length) {
  console.error('❌ A ported route lost something it used to offer.\n');
  for (const p of problems) {
    console.error(`   ${p.route}`);
    for (const d of p.lostDestinations) console.error(`      – can no longer reach:  ${d}`);
    for (const a of p.lostActions) console.error(`      – no longer runs:        ${a}`);
    for (const b of p.lostBlocks) console.error(`      – no longer shows:       <${b}>`);
  }
  console.error(
    '\n   If a removal is DELIBERATE, regenerate the baseline in this same PR:\n' +
      '     pnpm --filter @setnayan/web port:baseline\n' +
      '   That puts each removed control in the diff as one readable line, which is the point.\n',
  );
  process.exit(1);
}

console.log(
  `✅ no route lost anything — ${checkedRoutes} routes / ${checkedControls} controls / ` +
    `${checkedBlocks} blocks checked ` +
    `(baseline ref ${base.generatedFromRef})`,
);
