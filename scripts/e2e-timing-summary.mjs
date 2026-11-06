#!/usr/bin/env node
/**
 * e2e-timing-summary — where the Playwright suite's minutes went, per spec file.
 *
 *   node scripts/e2e-timing-summary.mjs <playwright-json-report>
 *
 * Written 2026-10-27 because "the e2e job is slow" had been diagnosed twice from
 * the dot reporter, and both times the suite was not where the time went (the
 * apt download was — see .github/workflows/e2e.yml). This prints, for the run it
 * is given: the wall time, the summed test time per spec file (every attempt,
 * retries included — a retry is time the job really spent), the slowest single
 * tests, and how many tests were flaky (passed only on a retry).
 *
 * Diagnostic only: it never changes the job's result. A missing or unreadable
 * report is reported as such and exits 0 — the test step's own exit code is the
 * verdict, and a crashed suite must not be hidden behind a crashed summary.
 */

import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
let report;
try {
  report = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.log(`::notice title=e2e timings::no readable Playwright JSON report at ${file} (${e.message}) — nothing to summarise`);
  process.exit(0);
}

const perFile = new Map();
const tests = [];
let flaky = 0;
let retried = 0;

function walk(suite) {
  for (const spec of suite.specs ?? []) {
    const f = spec.file ?? suite.file ?? '?';
    for (const t of spec.tests ?? []) {
      const ms = (t.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0);
      if ((t.results ?? []).length > 1) retried++;
      if (t.status === 'flaky') flaky++;
      const row = perFile.get(f) ?? { ms: 0, n: 0 };
      row.ms += ms;
      row.n += 1;
      perFile.set(f, row);
      tests.push({ f, title: spec.title, line: spec.line, ms });
    }
  }
  for (const s of suite.suites ?? []) walk(s);
}
for (const s of report.suites ?? []) walk(s);

const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
const total = [...perFile.values()].reduce((a, r) => a + r.ms, 0);
const files = [...perFile.entries()].sort((a, b) => b[1].ms - a[1].ms);
const slowest = tests.sort((a, b) => b.ms - a.ms).slice(0, 10);
const wall = report.stats?.duration;

const lines = [
  '### e2e — where the suite\'s time went',
  '',
  `Wall time ${wall != null ? sec(wall) : '?'} · summed test time ${sec(total)} across ${tests.length} tests in ${files.length} files · ${retried} retried · ${flaky} flaky`,
  '',
  '| spec file | tests | summed time | share |',
  '|---|---:|---:|---:|',
  ...files.map(([f, r]) => `| ${path.basename(f)} | ${r.n} | ${sec(r.ms)} | ${total ? Math.round((100 * r.ms) / total) : 0}% |`),
  '',
  '**Slowest tests**',
  '',
  ...slowest.map((t) => `- ${sec(t.ms)} — ${path.basename(t.f)}:${t.line} ${t.title}`),
  '',
];

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
