#!/usr/bin/env node
// Detect drift between what Vercel has ACTUALLY deployed to production and
// what `origin/main` actually contains.
//
// Why this exists: on 2026-09-02, `deploy-prod` (.github/workflows/deploy-prod.yml)
// failed on every run for seven straight merges — one migration had been
// applied by hand straight to prod (`supabase migration repair --status
// reverted 20260902023553` is the fix, and it is an OWNER action; see
// CLAUDE.md's migration-prefix section for why a hand-applied migration is the
// root cause, never the workaround). Because `db push` runs BEFORE the Vercel
// deploy hook, every one of those seven merges failed the job before it ever
// reached the hook — no build was ever created, and production kept serving
// PR #5072's merge while `main` stood seven merges ahead. All seven PRs were
// green (CI never runs the deploy step) and auto-merged normally. The only
// place the truth existed was the Actions tab for `deploy-prod`, which nobody
// was watching because every PR said green.
//
// This script is the check nothing else in the repo did: compare the commit
// Vercel actually SERVES in production against `origin/main`, independent of
// whether `deploy-prod` ran, passed, or was ever triggered at all. A step
// living inside `deploy-prod` cannot catch this class of failure — the failure
// IS `deploy-prod` not reaching the deploy step, so the check has to live
// outside it (see .github/workflows/deploy-drift-monitor.yml).
//
// Two kinds of "can't tell":
//   INCONCLUSIVE  the deployed commit isn't in the fetched git history (shallow
//                 clone, or Vercel reports no commit at all) — exits 2, never
//                 reported as healthy. A check that can't verify must not say
//                 "fine".
//   DRIFT         production is behind main by more than the grace window —
//                 exits 1.
//
// Usage:
//   node scripts/deploy-drift-doctor.mjs                # CI: reads VERCEL_TOKEN etc from env
//   node scripts/deploy-drift-doctor.mjs --json
//   node scripts/deploy-drift-doctor.mjs --grace-min 20
//
// Required env (or flags): VERCEL_TOKEN. Project/org id default to the
// checked-in .vercel/project.json (this repo's actual project), overridable
// with --project-id / --org-id or $VERCEL_PROJECT_ID / $VERCEL_ORG_ID.
//
// Exit code: 0 = deployed commit is on origin/main (or only within grace);
//            1 = confirmed drift past the grace window;
//            2 = inconclusive (missing token, API error, commit not in history).

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── pure, unit-tested core ────────────────────────────────────────────────
/**
 * Decide whether a deployed-vs-main gap counts as drift.
 * @param {{behindCount:number, oldestPendingAgeSec:number|null, graceSec:number}} args
 * @returns {{drift:boolean, reason:string}}
 */
export function classifyDeployDrift({ behindCount, oldestPendingAgeSec, graceSec }) {
  if (behindCount <= 0) return { drift: false, reason: 'up-to-date' };
  if (oldestPendingAgeSec == null) return { drift: true, reason: 'behind-unknown-age' };
  if (oldestPendingAgeSec < graceSec) return { drift: false, reason: 'within-grace' };
  return { drift: true, reason: 'behind' };
}

// ── IO helpers (not unit-tested) ──────────────────────────────────────────
function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).toString().trim();
}
function shSafe(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const a = {
    json: false,
    graceMin: 20,
    token: process.env.VERCEL_TOKEN || '',
    projectId: process.env.VERCEL_PROJECT_ID || '',
    orgId: process.env.VERCEL_ORG_ID || '',
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') a.json = true;
    else if (t === '--grace-min') a.graceMin = Number(argv[++i]) || 0;
    else if (t === '--token') a.token = argv[++i] || '';
    else if (t === '--project-id') a.projectId = argv[++i] || '';
    else if (t === '--org-id') a.orgId = argv[++i] || '';
  }
  // Fall back to the committed project link — same project/org this repo has
  // always deployed to, so it's safe as a default (never a secret).
  if (!a.projectId || !a.orgId) {
    try {
      const link = JSON.parse(readFileSync(join(repoRoot, '.vercel', 'project.json'), 'utf8'));
      a.projectId ||= link.projectId;
      a.orgId ||= link.orgId;
    } catch {
      /* no committed link — flags/env are the only source then */
    }
  }
  return a;
}

/** Fetch the most recent READY production deployment's commit sha from Vercel. */
async function fetchProductionCommit(args) {
  if (!args.token) {
    console.error('✗ No VERCEL_TOKEN — cannot ask Vercel what is actually live.');
    return null;
  }
  if (!args.projectId || !args.orgId) {
    console.error('✗ No project/org id (checked .vercel/project.json, --project-id/--org-id, $VERCEL_PROJECT_ID/$VERCEL_ORG_ID).');
    return null;
  }
  const url = new URL('https://api.vercel.com/v6/deployments');
  url.searchParams.set('projectId', args.projectId);
  url.searchParams.set('teamId', args.orgId);
  url.searchParams.set('target', 'production');
  url.searchParams.set('state', 'READY');
  url.searchParams.set('limit', '1');
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${args.token}` } });
  } catch (e) {
    console.error(`✗ Vercel API request failed: ${e.message || e}`);
    return null;
  }
  if (!res.ok) {
    console.error(`✗ Vercel API returned HTTP ${res.status} — ${await res.text().catch(() => '')}`.trim());
    return null;
  }
  const body = await res.json().catch(() => null);
  const deployment = body?.deployments?.[0];
  const sha = deployment?.meta?.githubCommitSha;
  if (!sha) {
    console.error('✗ Latest production deployment has no meta.githubCommitSha — cannot compare.');
    return null;
  }
  return { sha, id: deployment.uid, url: deployment.url, createdAt: deployment.createdAt };
}

/**
 * Seconds between a pending commit's timestamp and now.
 *
 * 🔴 `now` IS THE WALL CLOCK, AND IT USED TO BE THE GIT TIP. This read
 * `git log -1 --format=%ct origin/main` — the committer timestamp of main's
 * TIP — so the "age" it returned was the span BETWEEN TWO COMMITS, not how
 * long the change had been waiting. Measured 2026-09-06: the monitor reported
 * "merged 46 min ago" (tip 06:06:09Z minus pending 05:20) while the true age
 * was already 64 minutes, and the reported figure could never grow again.
 *
 * 🔑 WHICH DEFEATED THE HOURLY CRON, THE ONE THING ADDED TO CLOSE THE BLIND
 * WINDOW. `deploy-drift-monitor.yml`'s schedule exists because "drift beginning
 * after the last merge of the day goes unreported until the next one". But with
 * `now` frozen at the tip, the age STOPS GROWING the moment merging stops — so
 * every hourly run re-reports the same frozen figure. A deploy that fails right
 * after a merge landing five minutes behind it sits at "5 min old" forever,
 * permanently inside the 20-minute grace, and every scheduled run says
 * "within grace — normal deploy latency, not drift" while production serves
 * stale code for days. That is a monitor reporting healthy while the thing it
 * watches is broken — the exact disease it was built to catch, reproduced
 * inside the watcher.
 *
 * @param {{pendingCommitTs:number, nowTs:number}} args seconds since epoch
 * @returns {number} age in seconds, never negative (clock skew between the
 *   runner and a committer's machine must not read as "from the future" and
 *   land inside the grace window).
 */
export function pendingAgeSeconds({ pendingCommitTs, nowTs }) {
  if (!Number.isFinite(pendingCommitTs) || !Number.isFinite(nowTs)) return null;
  return Math.max(0, nowTs - pendingCommitTs);
}

/** Age in seconds of the first commit AFTER `deployedSha` on the way to origin/main; null if unknown. */
function oldestPendingAgeSeconds(deployedSha) {
  const nextSha = shSafe(`git rev-list --reverse ${deployedSha}..origin/main`).split('\n')[0];
  if (!nextSha) return null;
  const ct = Number(shSafe(`git log -1 --format=%ct ${nextSha}`));
  if (!ct) return null;
  return pendingAgeSeconds({ pendingCommitTs: ct, nowTs: Math.floor(Date.now() / 1000) });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  shSafe('git fetch --quiet origin main');
  const mainSha = shSafe('git rev-parse origin/main');
  if (!mainSha) {
    console.error('✗ Could not resolve origin/main locally.');
    process.exit(2);
  }

  const prod = await fetchProductionCommit(args);
  if (!prod) process.exit(2);

  // The deployed sha has to be present in this checkout's history to compare —
  // a fetch-depth:1 checkout would make every deploy look "unknown age", which
  // reads exactly like healthy. Fail loud instead of guessing.
  const known = shSafe(`git cat-file -e ${JSON.stringify(prod.sha)}^{commit} 2>/dev/null && echo yes`);
  if (known !== 'yes') {
    console.error(`✗ Deployed commit ${prod.sha} is not in this checkout's fetched history (need fetch-depth: 0). Cannot verify — not reporting healthy.`);
    process.exit(2);
  }

  const behindCount = Number(shSafe(`git rev-list --count ${prod.sha}..origin/main`)) || 0;
  const oldestPendingAgeSec = behindCount > 0 ? oldestPendingAgeSeconds(prod.sha) : null;
  const graceSec = args.graceMin * 60;
  const { drift, reason } = classifyDeployDrift({ behindCount, oldestPendingAgeSec, graceSec });

  if (args.json) {
    console.log(JSON.stringify({ mainSha, deployedSha: prod.sha, behindCount, oldestPendingAgeSec, drift, reason }, null, 2));
  } else {
    console.log('\nDeploy drift doctor — production (Vercel) vs origin/main');
    console.log(`  production is serving ${prod.sha}`);
    console.log(`  origin/main is at     ${mainSha}`);
    console.log(`  ${behindCount} commit(s) behind\n`);

    if (!drift) {
      console.log(behindCount === 0 ? '✓ Production matches origin/main.' : `… ${behindCount} commit(s) pending, within the ${args.graceMin}-min grace — normal deploy latency, not drift.`);
    } else {
      const mins = oldestPendingAgeSec != null ? Math.round(oldestPendingAgeSec / 60) : null;
      console.log(`✗ DRIFT — production is ${behindCount} commit(s) behind origin/main${mins != null ? `, oldest pending change merged ${mins} min ago` : ''}.`);
      console.log('  deploy-prod is not reaching production. Check its recent runs:');
      console.log('    gh run list --workflow deploy-prod.yml --limit 5');
      console.log('  A failed db push there means a migration ledger mismatch — see CLAUDE.md');
      console.log('  "NEVER APPLY A MIGRATION DIRECTLY TO PRODUCTION" and get the owner to run');
      console.log('  `supabase migration repair` (never a session — it rewrites the prod ledger).\n');
    }
  }

  process.exit(drift ? 1 : 0);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
