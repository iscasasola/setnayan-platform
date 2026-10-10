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
 */
export function gateVerdict(needsJson) {
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

  /* a · every required name is the name of exactly one job, somewhere */
  const allNames = [...jobs.map((j) => j.name), ...Object.values(others).flatMap((t) => parseJobs(t).map((j) => j.name))];
  for (const ctx of REQUIRED_CONTEXTS) {
    const n = allNames.filter((x) => x === ctx).length;
    if (n === 0) problems.push(`required check "${ctx}" is no longer the name of any job — branch protection would wait forever on a check that never reports, and every PR would be stuck`);
    if (n > 1) problems.push(`required check "${ctx}" is the name of ${n} jobs — which one branch protection reads is not something this file decides`);
  }

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
    if (j?.if) problems.push(`job "${id}" has a job-level \`if:\` — where it is false the job is skipped and the gate is (correctly) red. Make the job run everywhere; do not teach the gate that skipped is fine.`);
    if (j && j.needs.length) problems.push(`job "${id}" has its own \`needs:\` — if that dependency fails this job is SKIPPED rather than failed. Keep the gated jobs independent of each other.`);
  }

  /* e · what the gate used to run as steps is still run by a job it needs */
  const gatedRuns = gate.needs.flatMap((id) => (byId.get(id)?.steps ?? []).flatMap(runLines));
  for (const [label, re] of GATED_COMMANDS) {
    if (!gatedRuns.some((r) => re.test(r))) problems.push(`${label} is not run by any job the gate needs — the split dropped it`);
  }

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
