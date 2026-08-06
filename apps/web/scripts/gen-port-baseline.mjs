#!/usr/bin/env node
/**
 * gen-port-baseline.mjs — record every way OUT of every route, as it stands
 * BEFORE the design port rewrites the screens.
 *
 * 🔑 THE BASELINE IS GENERATED, NEVER AUTHORED. Nobody types a control name.
 * The expected value cannot drift from the real page, because it IS the real
 * page — the failure mode of a guard that compares two hand-typed things is
 * that both drift together and CI stays green (that is how llms.txt drifted for
 * three weeks). Same posture as the two baselines this repo already trusts,
 * page-masthead-baseline.json and dup-rule.baseline.txt.
 *
 *   pnpm --filter @setnayan/web port:baseline
 *
 * WHEN TO RE-RUN. Only to record a DELIBERATE removal, and then the diff is the
 * point: the removed line lands in the pull request as one readable line in
 * front of a reviewer, instead of vanishing. Never re-run "to make CI green" —
 * that converts the guard into a rubber stamp, and this file will show a large
 * unexplained diff when you do, which is the intended friction.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { buildBaseline } from './port-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const OUT = join(HERE, 'port-control-baseline.json');

let ref = 'unknown';
try {
  ref = execSync('git rev-parse --short HEAD', { cwd: WEB, encoding: 'utf8' }).trim();
} catch {
  /* not a git checkout — the ref is provenance, not a dependency */
}

const routes = buildBaseline(join(WEB, 'app'));
const routeCount = Object.keys(routes).length;
const destinations = Object.values(routes).reduce((n, r) => n + r.destinations.length, 0);
const actions = Object.values(routes).reduce((n, r) => n + r.actions.length, 0);

// A generator that silently produces an empty baseline would hand every future
// run a guard that passes on everything — the exact "cannot fail" shape this
// file exists to prevent. Refuse to write one.
if (routeCount < 300 || destinations < 400) {
  console.error(
    `REFUSING TO WRITE: extracted only ${routeCount} routes / ${destinations} destinations. ` +
      `The app has ~404 routes; this means the app root moved or the extractor broke. ` +
      `Writing this would silently disarm the guard for every route.`,
  );
  process.exit(1);
}

writeFileSync(
  OUT,
  JSON.stringify({ generatedFromRef: ref, routeCount, destinations, actions, routes }, null, 2) + '\n',
);
console.log(
  `wrote port-control-baseline.json — ${routeCount} routes · ${destinations} destinations · ${actions} actions (ref ${ref})`,
);
