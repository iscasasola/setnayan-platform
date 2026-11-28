/**
 * ci-shape — the pure rules behind the required CI gate.
 *
 * Three things live here, each a place where "nothing ran" could be read as
 * "nothing failed":
 *
 *   gateVerdict     what the required "typecheck + lint" job decides from the
 *                   results of the jobs it stands for (scripts/ci-gate.mjs);
 *   shapeProblems   what must be true of the workflow TEXT for that gate to
 *                   mean anything (scripts/lint-ci-gate.mjs);
 *   summariseTap    what a test shard's log says — and whether it ran at all
 *                   (scripts/ci-test-summary.mjs).
 *
 * No I/O, no dependencies: scripts/ci-gate.test.mjs runs it with plain node.
 */

/* ── 1. the gate's verdict ──────────────────────────────────────────────────*/

/**
 * @param {string|undefined} needsJson `${{ toJSON(needs) }}`
 * @returns {{ok:boolean, rows:{job:string,result:string}[], problems:string[]}}
 *
 * FAIL-CLOSED. Only the exact string `success` passes. `failure`, `cancelled`,
 * `skipped`, a missing result, an empty list and unreadable JSON are all red.
 * `skipped` is the one that matters: it is what a mis-edited `if:` or a failed
 * upstream job produces, and GitHub itself treats a skipped check as passed.
 *
 * 📝 `prDraft` is `${{ needs.pr-state.outputs.draft }}` (env PR_DRAFT): the PR's draft flag read LIVE from GitHub by
 * the pr-state job, never the event payload (see LIVE_DRAFT_JOB). A draft PR's verdict is RED, whatever its jobs did: its
 * heavy jobs skip on a draft (LIVE_DRAFT_CLAUSE). ci-gate.mjs then holds the context PENDING instead of posting red
 * (draftHoldCheckBody, #8524) — still never green, so auto-merge (armed on new PRs) cannot merge it — and the run that
 * marking the PR ready starts completes that hold with its real verdict.
 */
export const DRAFT_PR_PROBLEM = 'Draft PR: checks not run. Mark ready to test.';
export function gateVerdict(needsJson, prDraft) {
  if (prDraft === 'true') return { ok: false, rows: [], problems: [DRAFT_PR_PROBLEM] };
  const problems = [];
  let needs;
  try {
    needs = JSON.parse(needsJson ?? '');
  } catch {
    return { ok: false, rows: [], problems: ['the list of jobs could not be read (NEEDS is not JSON) — the gate cannot vouch for anything'] };
  }
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
    return { ok: false, rows: [], problems: ['the list of jobs is not an object — the gate cannot vouch for anything'] };
  }
  const rows = Object.entries(needs).map(([job, v]) => ({ job, result: typeof v?.result === 'string' ? v.result : 'missing' }));
  if (rows.length === 0) problems.push('this gate needs NO jobs, so it would pass while standing for nothing');
  for (const r of rows) {
    if (r.result !== 'success') problems.push(`${r.job}: ${r.result}`);
  }
  return { ok: problems.length === 0, rows, problems };
}

/* ── 1b. a run cancelled because a newer run took its place ─────────────────*/

/**
 * 📝 2026-11-24 (#8252, run 45266185097). Every pull_request run of ci.yml shares the group `ci-pr-<N>` with
 * `cancel-in-progress`, so a second run on the SAME commit (`opened` + `ready_for_review` a second apart, `reopened`,
 * a re-run) cancels the first. The gate is `if: always()`, so it still runs in the cancelled run, finds its jobs
 * `cancelled`, and posts a FAILED "typecheck + lint" — in that run's own check suite, where nothing newer replaces it.
 * The PR then sits BLOCKED with every check of the newer run green.
 *
 * A cancelled run tested nothing; the run that replaced it tests the same commit and posts its own gate under the
 * same required name. So the cancelled run's gate DEFERS to it — but only when all of these hold:
 *   · the red is only "nothing finished": every job it needs is success, cancelled or skipped (never `failure`,
 *     never unreadable) — a run that found a real failure keeps it, superseded or not;
 *   · another run of this workflow is WAITING on the same head commit, same branch, pull_request event. Waiting
 *     (`queued`/`pending`/`waiting`/`requested`), never `in_progress`: the group lets ONE run of a PR be in
 *     progress at a time — this one — so a waiting run is the one queued to replace it, and its gate decides.
 *     A run that is not waiting behind this one (or a failed lookup) means no deferral: the gate stays red.
 * The chain always ends in a run nothing replaced, and that run's gate never defers to another run (a lone DRAFT
 * gate holds PENDING for the ready run that has not started yet — see draftHoldCheckBody).
 *
 * 🔒 A DEFERRING GATE NEVER SAYS SUCCESS (controller, 24 Nov, on #8285). Between the cancelled run finishing and the
 * successor creating its own check runs there is a window. In a draft run the heavy required jobs are SKIPPED, and
 * GitHub counts skipped as passed, so a green gate there could make every required context read green on a commit
 * nothing typechecked or built. So, before the cancelled run's gate job ends, it POSTS a check run of the same name,
 * "typecheck + lint", with status `in_progress` and NO conclusion (deferredCheckBody). It is required (same app, same
 * name), and GitHub counts every check run of a required name, so the context reads PENDING until someone completes it.
 * The job itself may only end 0 once that post was accepted. A job cannot end "pending": its own check run is success
 * or failure, and a failure is what stuck on #8252, #8259 and #8274. If the post is refused, the gate stays red.
 * The successor's HONEST gate then COMPLETES every pending deferred check on the commit with its own verdict
 * (completionConclusion). It PATCHes the same check run, because a newer run of the same name does not replace an
 * older one (measured on #8274: an attempt-1 failure stayed counted beside two successes). A draft-red gate leaves
 * them pending: a draft vouches for nothing either way.
 */
export const WAITING_RUN_STATUSES = ['queued', 'pending', 'waiting', 'requested'];
export const DEFERRED_EXTERNAL_ID_PREFIX = 'deferred-gate:';

/** The check run a deferring gate posts. PENDING: `in_progress`, and never a `conclusion` key. */
export function deferredCheckBody({ runId, headSha, successor }) {
  const summary = `Run ${runId} was cancelled because run ${successor?.id} is replacing it on this same commit. Nothing was tested here. This check stays PENDING until that run's own "${GATE_NAME}" finishes and completes it with its real result.`;
  return {
    name: GATE_NAME,
    head_sha: headSha,
    status: 'in_progress',
    external_id: `${DEFERRED_EXTERNAL_ID_PREFIX}${runId}`,
    ...(successor?.html_url ? { details_url: successor.html_url } : {}),
    output: { title: `Deferred to run ${successor?.id}: pending`, summary },
  };
}

/**
 * 🚨 A LONE DRAFT HOLDS THE CONTEXT PENDING, NEVER RED (#8524). A draft run whose gate FINISHES before the PR is
 * marked ready has no run waiting behind it, so it used to go red — and that red check run stayed counted on the head
 * commit for good, because a newer run of the same name does not replace it (#8274). The ready run then went fully
 * green and the PR still sat BLOCKED; "Re-run all jobs" was the only way out, and the trap is that nobody knows it.
 * So a lone draft gate posts this PENDING hold instead (same name, same external_id prefix as a deferral) and ends 0
 * only once GitHub accepted it. The context still reads PENDING — a draft still cannot merge — and the first HONEST
 * gate on the commit (the run that "Ready for review" starts) completes it with its real verdict, exactly as it
 * completes a cancelled run's deferral. If the post is refused, the gate stays red, as before.
 */
export function draftHoldCheckBody({ runId, headSha }) {
  return {
    name: GATE_NAME,
    head_sha: headSha,
    status: 'in_progress',
    external_id: `${DEFERRED_EXTERNAL_ID_PREFIX}${runId}`,
    output: {
      title: 'Draft PR: pending until it is marked ready',
      summary: `Run ${runId} read the PR as a draft, so nothing was tested here. This check stays PENDING (the PR cannot merge) until the run that "Ready for review" starts finishes its own "${GATE_NAME}" and completes it with its real result.`,
    },
  };
}

/** Deferred checks on a commit that no honest gate has completed yet. */
export function pendingDeferredChecks(checkRuns) {
  if (!Array.isArray(checkRuns)) return [];
  return checkRuns.filter((c) => c?.name === GATE_NAME && c?.status !== 'completed' && String(c?.external_id ?? '').startsWith(DEFERRED_EXTERNAL_ID_PREFIX));
}

/**
 * What an honest (non-deferring) gate writes into pending deferred checks: its own verdict, or null (leave them
 * PENDING) when it is red only because the PR is a draft. A draft run tested nothing, so it may not vouch either way.
 */
export function completionConclusion(ok, prDraft) {
  if (prDraft === 'true') return null;
  return ok ? 'success' : 'failure';
}

/** May this red be handed to a successor? Only when nothing FAILED: every needed job is success, cancelled or skipped. */
export function deferrable(needsJson) {
  let needs;
  try {
    needs = JSON.parse(needsJson ?? '');
  } catch {
    return false;
  }
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) return false;
  const results = Object.values(needs).map((v) => (typeof v?.result === 'string' ? v.result : 'missing'));
  return results.length > 0 && results.every((r) => r === 'success' || r === 'cancelled' || r === 'skipped');
}

/**
 * The run waiting to replace this one, or null.
 * @param {any[]} runs `workflow_runs` from GET /repos/{repo}/actions/workflows/{file}/runs?head_sha=…
 * @param {{runId:string|number, headSha:string, headBranch:string, prNumber?:string|number}} me
 */
export function supersedingRun(runs, me) {
  if (!Array.isArray(runs) || !me?.headSha || !me?.headBranch || me.runId == null || me.runId === '') return null;
  return (
    runs.find(
      (r) =>
        String(r?.id) !== String(me.runId) &&
        r?.event === 'pull_request' &&
        r?.head_sha === me.headSha &&
        r?.head_branch === me.headBranch &&
        WAITING_RUN_STATUSES.includes(r?.status) &&
        (!me.prNumber || !Array.isArray(r?.pull_requests) || r.pull_requests.length === 0 || r.pull_requests.some((p) => String(p?.number) === String(me.prNumber))),
    ) ?? null
  );
}

/* ── 2. the workflow's shape ────────────────────────────────────────────────*/

/**
 * The names branch protection requires. A MIRROR — a session cannot read or
 * change branch protection without the owner's token, so this is the copy the
 * repo can check itself against. Re-measure it, never trust it:
 *   gh api repos/iscasasola/setnayan-platform/branches/main/protection --jq '.required_status_checks.contexts'
 */
export const REQUIRED_CONTEXTS = [
  'typecheck + lint',
  'production build',
  'secret scan',
  'migration timestamp guard',
  'playwright e2e (chromium)',
  'bundle size check',
  'lighthouse',
  'lint nav icon source',
  'lint bottom-nav template',
  'lint entitlement gates',
  'lint guest legibility',
  'lint nested forms',
  'lint exposure baseline',
];

export const GATE_NAME = 'typecheck + lint';

/**
 * 📝 DRAFT PRs SKIP THE HEAVY JOBS (owner, 16 Nov 2026 — runners are spent on PRs that are ready).
 *
 * DRAFT_CLAUSE is the EVENT PAYLOAD's draft flag: frozen when the event fired, and replayed unchanged by every re-run.
 * e2e.yml and lighthouse.yml still use it (a skipped job there reads as passed, so it can never strand a PR red).
 * ci.yml may NOT (rule i): its gate goes RED on a draft, and a red gate built from a frozen "draft" stays on the head
 * commit after the PR is ready — measured 24 Nov on #8252, #8259 and #8261, where `opened`-as-draft and
 * `ready_for_review` ran a second apart, the draft run landed last, and re-running it failed again.
 *
 * So ci.yml reads the flag LIVE: the LIVE_DRAFT_JOB job asks GitHub's API at run time, and LIVE_DRAFT_IF is the ONE
 * job-level `if:` a gated job may carry (with `needs: pr-state`, the one `needs:` it may carry). The rules that keep it
 * from opening a hole, because GitHub counts a skipped check as passed:
 *   · the GATE never carries it (rule b: exactly `always()`), and it is never green on a draft (PR_DRAFT → gateVerdict:
 *     red, held PENDING by draftHoldCheckBody), so a draft can never merge — not by auto-merge, not by anyone;
 *   · the gate is handed PR_DRAFT from the live job (rule h) — without it a draft's skipped jobs would be its only signal;
 *   · the live job exists, runs everywhere, reads the API and is NEEDED by the gate, so a failed read is a red gate (rule i);
 *   · a workflow that skips drafts lists `ready_for_review` (rule g), so marking a PR ready RUNS every job.
 * On `push` and `workflow_dispatch` there is no pull request and the live job answers `false`: every job runs.
 */
export const DRAFT_CLAUSE = 'github.event.pull_request.draft != true';
export const LIVE_DRAFT_JOB = 'pr-state';
export const LIVE_DRAFT_CLAUSE = `needs.${LIVE_DRAFT_JOB}.outputs.draft == 'false'`;
const LIVE_DRAFT_IF = `\${{ ${LIVE_DRAFT_CLAUSE} }}`;
const PR_TYPES_NEEDED = ['opened', 'synchronize', 'reopened', 'ready_for_review'];

/**
 * What the gate stood for when it was one job. Each must still be run by a job
 * the gate needs — splitting the job must not have quietly dropped a step.
 */
export const GATED_COMMANDS = [
  ['the typecheck', /\bpnpm typecheck\b/],
  ['eslint', /^pnpm lint\b/],
  ['the unit suite', /\btest:unit\b/],
  ['the DB replay', /\btest:db:ci\b/],
  ['the duplicated-rule guards', /\blint:dup-rule\b/],
  ['the root map check', /check-ugat-screens\.mjs/],
  ['the native encoder tests', /^cargo test\b.*setnayan-encoder/],
  ['the blocking-guard aggregator', /One or more blocking guards failed/],
];

/**
 * Jobs of one workflow file. Reads only the shape these files use: job ids at
 * two spaces, job keys at four.
 * @returns {{id:string, name:string, needs:string[], if:string|null, body:string, steps:string[]}[]}
 */
export function parseJobs(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const jobs = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l) && !/^#/.test(l)) break;
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (m) {
      cur = { id: m[1], name: m[1], needs: [], if: null, lines: [] };
      jobs.push(cur);
      continue;
    }
    if (cur) cur.lines.push(l);
  }
  for (const j of jobs) {
    const body = j.lines.join('\n');
    j.body = body;
    const name = /^ {4}name:\s*(.+?)\s*$/m.exec(body);
    if (name) j.name = name[1].replace(/^(['"])(.*)\1$/, '$2');
    const cond = /^ {4}if:\s*(.+?)\s*$/m.exec(body);
    if (cond) j.if = cond[1];
    const inline = /^ {4}needs:\s*\[([^\]]*)\]\s*$/m.exec(body);
    const single = /^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/m.exec(body);
    if (inline) j.needs = inline[1].split(',').map((x) => x.trim()).filter(Boolean);
    else if (single) j.needs = [single[1]];
    else {
      const block = /^ {4}needs:\s*\n((?: {6}- .+\n?)+)/m.exec(body);
      if (block) j.needs = block[1].split('\n').map((x) => x.replace(/^ {6}- /, '').trim()).filter(Boolean);
    }
    // steps: each `      - ` item under `    steps:`
    const stepsAt = body.search(/^ {4}steps:\s*$/m);
    j.steps = stepsAt < 0 ? [] : body.slice(stepsAt).split(/\n(?= {6}- )/).slice(1);
    delete j.lines;
  }
  return jobs;
}

/** The single-line commands of a step (comments are not commands). */
function runLines(step) {
  const out = [];
  const lines = step.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {6,8}(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (/^[|>][+-]?\s*$/.test(m[1].trim())) {
      const indent = lines[i].search(/\S/);
      for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || lines[j].search(/\S/) > indent); j++) out.push(lines[j].trim());
    } else out.push(m[1].trim());
  }
  return out;
}

/**
 * Everything that must hold for the gate to be worth requiring.
 * @param {{ci:string, others?:Record<string,string>, webPackage?:{scripts?:Record<string,string>}}} input
 * @returns {string[]} one message per problem; empty means sound
 */
export function shapeProblems({ ci, others = {}, webPackage = {} }) {
  const problems = [];
  const jobs = parseJobs(ci);
  const byId = new Map(jobs.map((j) => [j.id, j]));

  /* a · every required name is reported by exactly one place: the name of one job, somewhere, or one line of a
         report step (see REPORT_SCRIPT) */
  const reported = parseReportedChecks(ci);
  const allNames = [
    ...jobs.map((j) => j.name),
    ...Object.values(others).flatMap((t) => parseJobs(t).map((j) => j.name)),
    ...reported.map((r) => r.name),
  ];
  for (const ctx of REQUIRED_CONTEXTS) {
    const n = allNames.filter((x) => x === ctx).length;
    if (n === 0) problems.push(`required check "${ctx}" is no longer the name of any job, nor reported by name — branch protection would wait forever on a check that never reports, and every PR would be stuck`);
    if (n > 1) problems.push(`required check "${ctx}" is reported by ${n} places (job names + report lines) — which one branch protection reads is not something this file decides`);
  }
  problems.push(...reportProblems(ci, jobs));

  /* b · the gate exists and is fail-closed */
  const gates = jobs.filter((j) => j.name === GATE_NAME);
  const gate = gates[0];
  if (!gate) return [...problems, `no job in ci.yml is named "${GATE_NAME}"`];
  if (gate.needs.length === 0) problems.push(`"${GATE_NAME}" needs no jobs — it would pass while standing for nothing`);
  if (!/^\$\{\{\s*always\(\)\s*\}\}$/.test(gate.if ?? '')) {
    problems.push(`"${GATE_NAME}" must be \`if: \${{ always() }}\` — without it a failed dependency SKIPS the gate, and a skipped required check counts as passed`);
  }
  const gateRuns = gate.steps.flatMap(runLines);
  if (!gateRuns.some((r) => /^node scripts\/ci-gate\.mjs$/.test(r))) problems.push(`"${GATE_NAME}" no longer runs \`node scripts/ci-gate.mjs\` — nothing reads the results it needs`);
  if (!/NEEDS:\s*\$\{\{\s*toJSON\(needs\)\s*\}\}/.test(gate.body)) problems.push(`"${GATE_NAME}" must hand the script \`NEEDS: \${{ toJSON(needs) }}\` — the whole list, never a hand-picked subset`);
  for (const id of gate.needs) if (!byId.has(id)) problems.push(`"${GATE_NAME}" needs "${id}", which is not a job in this file`);

  /* c · no job is decoration */
  for (const j of jobs) {
    if (j === gate) continue;
    if (REQUIRED_CONTEXTS.includes(j.name)) continue;
    if (!gate.needs.includes(j.id)) {
      problems.push(`job "${j.id}" (${j.name}) is not a required check and is not in the gate's \`needs:\` — it would go red on the PR page and the PR would merge anyway. Add it to \`needs:\` of "${GATE_NAME}".`);
    }
  }

  /* d · a needed job that can be skipped makes the gate red for no fault — or tempts someone to loosen it */
  for (const id of gate.needs) {
    const j = byId.get(id);
    const live = j?.if === LIVE_DRAFT_IF;
    if (j?.if && j.if.includes('github.event.pull_request.draft')) {
      problems.push(`job "${id}" decides draft-or-ready from the event payload (\`${j.if}\`) — a re-run replays that payload, so a run that started on a draft stays red after the PR is ready. Use \`if: ${LIVE_DRAFT_IF}\` with \`needs: ${LIVE_DRAFT_JOB}\`.`);
    } else if (j?.if && !live) {
      problems.push(`job "${id}" has a job-level \`if:\` — where it is false the job is skipped and the gate is (correctly) red. Make the job run everywhere; do not teach the gate that skipped is fine.`);
    }
    const ownNeeds = live ? j.needs.filter((n) => n !== LIVE_DRAFT_JOB) : j?.needs ?? [];
    if (ownNeeds.length) problems.push(`job "${id}" has its own \`needs:\` — if that dependency fails this job is SKIPPED rather than failed. Keep the gated jobs independent of each other (the one allowed need is \`${LIVE_DRAFT_JOB}\`, with the live draft \`if:\`).`);
  }

  /* e · what the gate used to run as steps is still run by a job it needs */
  const gatedRuns = gate.needs.flatMap((id) => (byId.get(id)?.steps ?? []).flatMap(runLines));
  for (const [label, re] of GATED_COMMANDS) {
    if (!gatedRuns.some((r) => re.test(r))) problems.push(`${label} is not run by any job the gate needs — the split dropped it`);
  }

  /* g · a workflow whose jobs skip drafts must run them when the PR is marked ready (see DRAFT_CLAUSE) */
  for (const [file, text] of [['ci.yml', ci], ...Object.entries(others)]) {
    if (!text.includes(DRAFT_CLAUSE) && !text.includes(LIVE_DRAFT_CLAUSE)) continue;
    const pr = /^ {2}pull_request:[^\n]*\n((?: {4}[^\n]*\n)*)/m.exec(text);
    const types = pr ? /^ {4}types:\s*\[([^\]]*)\]/m.exec(pr[1]) : null;
    const have = types ? types[1].split(',').map((x) => x.trim()) : [];
    const missing = PR_TYPES_NEEDED.filter((t) => !have.includes(t));
    if (!pr || missing.length) {
      problems.push(`${file}: its jobs skip draft PRs, so its \`pull_request\` trigger must list \`types: [${PR_TYPES_NEEDED.join(', ')}]\` — missing ${missing.join(', ') || 'the trigger'}. Without \`ready_for_review\` a PR marked ready keeps only the draft's SKIPPED checks, which GitHub counts as passed.`);
    }
  }

  /* h · the gate is told when the PR is a draft — LIVE — so a draft is red, never green-by-skipping */
  if (!/PR_DRAFT:\s*\$\{\{\s*needs\.pr-state\.outputs\.draft\s*\}\}/.test(gate.body)) {
    problems.push(`"${GATE_NAME}" must hand the script \`PR_DRAFT: \${{ needs.${LIVE_DRAFT_JOB}.outputs.draft }}\` — on a draft the heavy jobs are skipped, and without it the gate cannot say the PR is a draft and stay red. Never the event payload's \`github.event.pull_request.draft\`: a re-run replays it.`);
  }

  /* i · draft-or-ready is read LIVE, once, by one job the gate needs (see LIVE_DRAFT_JOB) */
  const liveJob = byId.get(LIVE_DRAFT_JOB);
  if (!liveJob) {
    problems.push(`no job "${LIVE_DRAFT_JOB}" in ci.yml — nothing reads the PR's draft flag live, so a run that started on a draft replays "draft" on every re-run and strands a ready PR behind a red gate`);
  } else {
    if (!gate.needs.includes(LIVE_DRAFT_JOB)) problems.push(`"${GATE_NAME}" must \`needs: ${LIVE_DRAFT_JOB}\` — a failed live read must be a red gate, not skipped heavy jobs nobody counts`);
    if (liveJob.if) problems.push(`job "${LIVE_DRAFT_JOB}" must have no \`if:\` — it answers for every run, push and dispatch included`);
    if (liveJob.needs.length) problems.push(`job "${LIVE_DRAFT_JOB}" must need nothing — every heavy job waits on it`);
    if (!/^ {6}pull-requests:\s*read\s*$/m.test(liveJob.body)) problems.push(`job "${LIVE_DRAFT_JOB}" must have \`permissions: pull-requests: read\` — without it the live read is refused`);
    if (!/^ {6}draft:\s*\$\{\{\s*steps\.[A-Za-z0-9_-]+\.outputs\.draft\s*\}\}/m.test(liveJob.body)) problems.push(`job "${LIVE_DRAFT_JOB}" must output \`draft\` from its read step`);
    if (!/gh api "repos\/\$REPO\/pulls\/\$PR_NUMBER" --jq '\.draft'/.test(liveJob.body)) problems.push(`job "${LIVE_DRAFT_JOB}" must read the flag from GitHub's API at run time (\`gh api "repos/$REPO/pulls/$PR_NUMBER" --jq '.draft'\`) — that is the whole point of the job`);
  }
  ci.split('\n').forEach((line, i) => {
    if (/^\s*#/.test(line)) return;
    if (line.includes('github.event.pull_request.draft')) problems.push(`ci.yml line ${i + 1} reads the event payload's draft flag (\`${line.trim()}\`) — a re-run replays it. Read \`needs.${LIVE_DRAFT_JOB}.outputs.draft\` instead.`);
  });
  /* j · a cancelled run's gate can see the run replacing it — or a superseded commit stays red forever (see supersedingRun) */
  if (!/^ {6}checks:\s*write\s*$/m.test(gate.body)) problems.push(`"${GATE_NAME}" must have \`permissions: checks: write\` — a deferring gate posts a PENDING check (never success) and an honest gate completes it; without it a cancelled run stays red`);
  if (!/^ {6}actions:\s*read\s*$/m.test(gate.body)) problems.push(`"${GATE_NAME}" must have \`permissions: actions: read\` — without it a run cancelled for a newer run on the same commit cannot see that run, and posts a FAILED gate nothing replaces`);
  for (const [key, expr] of [
    ['EVENT_NAME', 'github.event_name'],
    ['GITHUB_TOKEN', 'github.token'],
    ['RUN_ID', 'github.run_id'],
    ['HEAD_SHA', 'github.event.pull_request.head.sha'],
    ['HEAD_BRANCH', 'github.head_ref'],
  ]) {
    const re = new RegExp(`^ {10}${key}:\\s*\\$\\{\\{\\s*${expr.replace(/\./g, '\\.')}\\s*\\}\\}\\s*$`, 'm');
    if (!re.test(gate.body)) problems.push(`"${GATE_NAME}" must hand the script \`${key}: \${{ ${expr} }}\` — it is how a cancelled run finds the run replacing it on the same commit`);
  }

  for (const j of jobs) {
    if (j.body.includes(`needs.${LIVE_DRAFT_JOB}.outputs`) && !j.needs.includes(LIVE_DRAFT_JOB)) {
      problems.push(`job "${j.id}" reads \`needs.${LIVE_DRAFT_JOB}.outputs\` but does not \`needs: ${LIVE_DRAFT_JOB}\``);
    }
  }

  /* k · a pull_request workflow can never end ALL-SKIPPED (see neverSkippedProblems) */
  for (const [file, text] of [['ci.yml', ci], ...Object.entries(others)]) problems.push(...neverSkippedProblems(file, text));

  /* f · shards: the whole list, never cancelled early, exit code kept */
  for (const j of jobs) {
    for (const step of j.steps) {
      const flag = /TEST_SHARD_FLAG:\s*--test-shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/.exec(step);
      const cmds = runLines(step);
      const teed = cmds.some((c) => /\|\s*tee\b/.test(c));
      if (teed && !/^ {8}shell:\s*bash\s*$/m.test(step)) {
        problems.push(`job "${j.id}": a step pipes through \`tee\` without \`shell: bash\` — there is no pipefail, so a failing or killed run reads as success`);
      }
      if (!flag) continue;
      const total = Number(flag[1]);
      const list = /^ {8}shard:\s*\[([^\]]*)\]\s*$/m.exec(j.body);
      const have = list ? list[1].split(',').map((x) => Number(x.trim())) : [];
      const want = Array.from({ length: total }, (_, i) => i + 1);
      if (have.length !== want.length || have.some((x, i) => x !== want[i])) {
        problems.push(`job "${j.id}": the shards are [${have.join(', ')}] but the flag deals the suite into ${total} — every number from 1 to ${total} must be listed, or a slice of the tests never runs`);
      }
      if (!/^ {6}fail-fast:\s*false\s*$/m.test(j.body)) problems.push(`job "${j.id}": \`fail-fast: false\` is missing — one red shard would cancel the others and hide their failures`);
      const script = cmds.map((c) => /\b(test:[a-z:]+)\b/.exec(c)?.[1]).find(Boolean);
      if (!script) {
        problems.push(`job "${j.id}": a step sets TEST_SHARD_FLAG but runs no test:* package script — the flag reaches nothing`);
        continue;
      }
      const body = webPackage.scripts?.[script];
      if (!body) problems.push(`apps/web package.json has no \`${script}\` script, which job "${j.id}" runs`);
      else if (!/--test\s+\$TEST_SHARD_FLAG\s+"/.test(body)) {
        problems.push(`apps/web package.json \`${script}\` must read \`tsx --test $TEST_SHARD_FLAG "<globs>"\` — the flag BEFORE the globs. After them node ignores it and every shard runs the whole suite.`);
      }
    }
  }

  return problems;
}

/* ── 2a. a workflow's check suite is never all-skipped ──────────────────────*/

/**
 * 🚨 #8098 (auto-merge.yml, opened with the hold label) and #8465 (lighthouse.yml, head pushed while a DRAFT).
 * When every job of a workflow run skips, that run's check suite concludes "skipped". If it is the first
 * github-actions suite on the head commit, GitHub files the required checks `scripts/ci-report-checks.mjs` posts
 * by name into it — and branch protection does not count runs in a skipped suite. The PR then sits BLOCKED with
 * every check green, and re-running replays the same event and skips again.
 *
 * So every workflow that runs on `pull_request` (or `pull_request_target`) must have at least one job with no
 * job-level `if:` and no `needs:` — a job that runs on every event and cannot be skipped by a failed dependency.
 * The convention is a do-nothing job named NEVER_SKIPPED_JOB; any unconditional job satisfies the rule.
 */
export const NEVER_SKIPPED_JOB = 'suite-is-never-skipped';
export function neverSkippedProblems(file, text) {
  const on = /^on:[^\n]*\n((?:(?: [^\n]*|#[^\n]*|)\n)*)/m.exec(text);
  if (!on || !/^ {2}pull_request(?:_target)?:/m.test(on[1])) return [];
  const jobs = parseJobs(text);
  if (jobs.some((j) => !j.if && j.needs.length === 0)) return [];
  return [`${file}: runs on pull_request but every job has an \`if:\` or a \`needs:\` (${jobs.map((j) => j.id).join(', ') || 'no jobs'}) — where they all skip (a draft, a hold label) the run's check suite concludes "skipped", required checks reported by name can be filed into it, and branch protection does not count them: the PR stays BLOCKED with everything green (#8098, #8465). Add a job \`${NEVER_SKIPPED_JOB}\` with no \`if:\` and no \`needs:\`.`];
}

/* ── 2b. required checks a job reports by name ──────────────────────────────*/

/**
 * 2026-11-18 — GitHub Pro runs 40 jobs at once on this account, so seconds-long
 * jobs that were each a REQUIRED check are steps of the `guards` job now, and
 * one step of that job posts each of them back under its exact required name
 * through the Checks API (scripts/ci-report-checks.mjs). A check run created
 * with the job's GITHUB_TOKEN belongs to the GitHub Actions app — the same app
 * branch protection pins those names to — so branch protection is unchanged.
 *
 * The step's `REPORT: |` env block has one line per check:
 *     <exact required name>=${{ steps.<id>.outcome }}[,${{ steps.<id>.outcome }}…]
 */
export const REPORT_SCRIPT = 'scripts/ci-report-checks.mjs';

/** @returns {{job:string, name:string, stepIds:string[], step:string}[]} */
export function parseReportedChecks(ci) {
  const out = [];
  for (const j of parseJobs(ci)) {
    for (const step of j.steps) {
      if (!runLines(step).some((r) => r === `node ${REPORT_SCRIPT}`)) continue;
      const block = /^ {10}REPORT:\s*\|\s*\n((?: {12}.*\n?)+)/m.exec(step);
      if (!block) {
        out.push({ job: j.id, name: '', stepIds: [], step });
        continue;
      }
      for (const raw of block[1].split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const eq = line.indexOf('=');
        const name = eq < 0 ? line : line.slice(0, eq).trim();
        const rhs = eq < 0 ? '' : line.slice(eq + 1);
        const stepIds = [...rhs.matchAll(/\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outcome\s*\}\}/g)].map((m) => m[1]);
        out.push({ job: j.id, name, stepIds, step });
      }
    }
  }
  return out;
}

/** What must hold for a reported name to mean what a job of that name meant. */
function reportProblems(ci, jobs) {
  const problems = [];
  const reported = parseReportedChecks(ci);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const steps = new Set(reported.map((r) => r.step));
  for (const step of steps) {
    const r0 = reported.find((r) => r.step === step);
    const job = byId.get(r0.job);
    if (!/^ {8}if:\s*\$\{\{\s*always\(\)\s*\}\}\s*$/m.test(step)) {
      problems.push(`job "${r0.job}": the step that reports required checks by name must be \`if: \${{ always() }}\` — if an earlier step fails it would be SKIPPED, and every name it carries would wait forever`);
    }
    if (!/^ {10}GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/m.test(step)) problems.push(`job "${r0.job}": the report step must be given GITHUB_TOKEN — a check run from any other token is not the GitHub Actions app branch protection pins the names to`);
    if (!/^ {10}HEAD_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha \|\| github\.sha\s*\}\}/m.test(step)) problems.push(`job "${r0.job}": the report step must post to \`github.event.pull_request.head.sha || github.sha\` — on a pull request github.sha is the MERGE commit, which branch protection never reads`);
    if (job && !/^ {6}checks:\s*write\s*$/m.test(job.body)) problems.push(`job "${r0.job}" reports checks by name but has no \`permissions: checks: write\` — every post would be refused and the names would never report`);
    if (r0.name === '' && r0.stepIds.length === 0) problems.push(`job "${r0.job}": the report step has no \`REPORT: |\` block — it reports nothing`);
  }
  for (const r of reported) {
    if (!r.name) continue;
    if (r.stepIds.length === 0) problems.push(`reported check "${r.name}" reads no step outcome — it would be green while standing for nothing`);
    const job = byId.get(r.job);
    for (const id of r.stepIds) {
      if (!job || !new RegExp(`^ {6}- id:\\s*${id}\\s*$|^ {8}id:\\s*${id}\\s*$`, 'm').test(job.body)) {
        problems.push(`reported check "${r.name}" reads steps.${id}, which is not a step of job "${r.job}" — the outcome would be empty and the check red forever`);
      }
    }
  }
  return problems;
}

/**
 * The conclusion for each line of a REPORT block. FAIL-CLOSED: green only when
 * the line lists at least one outcome and every one is exactly `success`.
 * @returns {{name:string, conclusion:'success'|'failure', outcomes:string[]}[]}
 */
export function reportConclusions(report) {
  const out = [];
  for (const raw of String(report ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const eq = line.lastIndexOf('=');
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const outcomes = line.slice(eq + 1).split(',').map((x) => x.trim());
    const ok = outcomes.length > 0 && outcomes.every((o) => o === 'success');
    out.push({ name, conclusion: ok ? 'success' : 'failure', outcomes: outcomes.map((o) => o || 'missing') });
  }
  return out;
}

/* ── 3. a test shard's log ──────────────────────────────────────────────────*/

/**
 * Reads node's TAP output. For each failing LEAF test: its name, the first line
 * of its error, and where it is — taken from the first stack frame inside a
 * test file, because the `location:` line carries the transpiled position.
 * @returns {{tests:number|null, pass:number|null, fail:number|null, failures:{name:string,msg:string,file:string,line:number|null}[], ran:boolean}}
 */
export function summariseTap(log) {
  const total = (key) => {
    const m = [...log.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))].pop();
    return m ? Number(m[1]) : null;
  };
  const tests = total('tests');
  const lines = log.split('\n');
  const failures = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)not ok \d+ - (.*)$/.exec(lines[i]);
    if (!m) continue;
    let file = '';
    let line = null;
    let msg = '';
    let parentOnly = false;
    for (let j = i + 1; j < Math.min(lines.length, i + 80); j++) {
      const l = lines[j];
      if (/^\s*(not ok|ok) \d+ - /.test(l) || /^\s*\.\.\.\s*$/.test(l)) break;
      if (/failureType:\s*'?subtestsFailed/.test(l)) parentOnly = true;
      const loc = /^\s*location:\s*'?(.+?):\d+:\d+'?\s*$/.exec(l);
      if (loc && !file) file = loc[1];
      const err = /^\s*error:\s*(.*)$/.exec(l);
      if (err && !msg) {
        const inline = err[1].trim();
        msg = /^[|>][+-]?$/.test(inline) ? (lines[j + 1] ?? '').trim() : inline.replace(/^(['"])(.*)\1$/, '$2');
      }
      const frame = /\((\/[^()]+?\.test\.[cm]?tsx?):(\d+):\d+\)/.exec(l);
      if (frame && line === null) {
        file = frame[1];
        line = Number(frame[2]);
      }
    }
    if (parentOnly) continue; // a parent that failed only because a child did
    const name = m[2].replace(/\s+#\s*(TODO|SKIP).*$/i, '');
    const key = `${file}:${line}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    failures.push({ name, msg, file: file.replace(/^.*?\/(apps\/web\/)/, '$1'), line });
  }
  return { tests, pass: total('pass'), fail: total('fail'), failures, ran: tests !== null && tests > 0 };
}
