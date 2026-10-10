#!/usr/bin/env node
/**
 * ci-test-summary — name every failing test of one CI test job, and refuse a
 * job that ran nothing.
 *
 *   node scripts/ci-test-summary.mjs <tap log> "<label>"
 *
 * The unit suite and the DB replay print tens of thousands of lines. A failure
 * used to be found by opening the log and searching it; with the suite split
 * into shards that would be one log per shard. So each shard's log is read
 * here and its failures are written to the run summary and raised as
 * annotations on the PR — every one, not the first.
 *
 * AND IT FAILS when the log holds no `# tests` total above zero. The test step
 * itself fails on a failing test; what it cannot do is notice that it ran
 * NOTHING — a glob that matched no file, a shard number past the end, a runner
 * killed before the total was printed. "0 tests, 0 failures" is not a pass.
 */

import fs from 'node:fs';
import { summariseTap } from './lib/ci-shape.mjs';

const [logPath, label = 'tests'] = process.argv.slice(2);
if (!logPath) {
  console.error('usage: node scripts/ci-test-summary.mjs <tap log> "<label>"');
  process.exit(2);
}
let log = '';
try {
  log = fs.readFileSync(logPath, 'utf8');
} catch {
  console.log(`::error title=${label} · no log::${label}: the test step left no log at ${logPath} — it did not run. That is a failure, not a pass.`);
  process.exit(1);
}

const s = summariseTap(log);
const n = (x) => (x === null ? '?' : x.toLocaleString('en-US'));
console.log(`${label}: ${n(s.tests)} tests · ${n(s.pass)} passed · ${n(s.fail)} failed`);

const md = [];
if (!s.ran) {
  md.push(`### ❌ ${label} — ran nothing`, '', 'The log has no `# tests` total above zero: the run was killed before it finished, or its pattern matched no test file. That is a failure, not a pass.', '');
} else if (s.failures.length || (s.fail ?? 0) > 0) {
  md.push(`### ❌ ${label} — ${n(s.fail)} failed of ${n(s.tests)}`, '');
  for (const f of s.failures.slice(0, 100)) md.push(`- **${f.name}**${f.file ? ` — \`${f.file}${f.line ? `:${f.line}` : ''}\`` : ''}${f.msg ? `<br>${f.msg.slice(0, 300)}` : ''}`);
  if (s.failures.length > 100) md.push(`- … and ${s.failures.length - 100} more (see the log)`);
  md.push('');
} else {
  md.push(`### ✅ ${label} — ${n(s.tests)} tests passed`, '');
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n'));

const esc = (x) => String(x).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/::/g, ': :');
for (const f of s.failures.slice(0, 30)) {
  const at = f.file ? `file=${f.file},${f.line ? `line=${f.line},` : ''}` : '';
  console.log(`::error ${at}title=${esc(label)} · ${esc(f.name).slice(0, 120)}::${esc(f.name)}${f.msg ? ` — ${esc(f.msg).slice(0, 400)}` : ''}`);
}

if (!s.ran) {
  console.log(`::error title=${esc(label)} · ran nothing::${esc(label)} printed no test total above zero — killed before the end, or its pattern matched no file. Not a pass.`);
  process.exit(1);
}
