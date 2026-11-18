#!/usr/bin/env node
/**
 * ci-report-checks — post REQUIRED checks under their exact names from inside
 * one job (the last step of the `guards` job in .github/workflows/ci.yml).
 *
 * WHY (2026-11-18): GitHub Pro runs at most 40 jobs at once on this account,
 * and one ci.yml run used to start 24 — eight of them seconds-long jobs that
 * were each a REQUIRED check under its own name. They are steps of `guards`
 * now. Branch protection still waits for each name, so this script posts one
 * check run per name to the PR's head commit. A check run created with the
 * job's GITHUB_TOKEN belongs to the GitHub Actions app, which is the app branch
 * protection pins those names to — nothing in branch protection changes.
 *
 * Input (env):
 *   REPORT        one line per check: `<exact name>=<outcome>[,<outcome>…]`
 *   HEAD_SHA      the commit branch protection reads (PR head, not the merge commit)
 *   GITHUB_TOKEN  the job's token (needs `checks: write`)
 *   GITHUB_REPOSITORY, RUN_URL
 *
 * FAIL-CLOSED: a check is green only when every outcome on its line is exactly
 * `success` (scripts/lib/ci-shape.mjs › reportConclusions). This script exits
 * non-zero if any post is refused, so a check that could not be reported is a
 * red step in the job, never a silent "expected" on the PR.
 */

import { reportConclusions } from './lib/ci-shape.mjs';

const { REPORT, HEAD_SHA, GITHUB_TOKEN, GITHUB_REPOSITORY, RUN_URL = '' } = process.env;
const api = process.env.GITHUB_API_URL || 'https://api.github.com';

const checks = reportConclusions(REPORT);
if (checks.length === 0) {
  console.error('::error title=report required checks::REPORT is empty — no required check was posted.');
  process.exit(1);
}
if (!HEAD_SHA || !GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  console.error('::error title=report required checks::HEAD_SHA, GITHUB_TOKEN and GITHUB_REPOSITORY are all needed.');
  process.exit(1);
}

let refused = 0;
for (const c of checks) {
  const ok = c.conclusion === 'success';
  const summary = ok
    ? `Passed — every step it stands for succeeded (${c.outcomes.join(', ')}).`
    : `Failed — step outcomes: ${c.outcomes.join(', ')}. Open the "guards" job of the CI run for the step's own message.`;
  const res = await fetch(`${api}/repos/${GITHUB_REPOSITORY}/check-runs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: c.name,
      head_sha: HEAD_SHA,
      status: 'completed',
      conclusion: c.conclusion,
      ...(RUN_URL ? { details_url: RUN_URL } : {}),
      output: { title: ok ? `${c.name}: passed` : `${c.name}: FAILED`, summary: `${summary}\n\nReported by the guards job${RUN_URL ? `: ${RUN_URL}` : ''}.` },
    }),
  });
  if (!res.ok) {
    refused++;
    console.error(`::error title=report ${c.name}::GitHub refused the check run (${res.status}): ${(await res.text()).slice(0, 300)}`);
    continue;
  }
  const body = await res.json();
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}  → check run ${body.id} (app ${body.app?.slug ?? '?'} #${body.app?.id ?? '?'}) on ${HEAD_SHA.slice(0, 9)}`);
}
if (refused) process.exit(1);
console.log(`\nPosted ${checks.length} required check(s) by name.`);
