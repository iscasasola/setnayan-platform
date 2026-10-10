#!/usr/bin/env node
/**
 * RELEASE REHEARSAL — writes REHEARSAL.md and prints it (the workflow tees the
 * print into the run's summary page).
 *
 * Reads only the files the rehearsal itself wrote into its output folder. Every
 * one of them is optional: a rehearsal that died early still gets a summary
 * that says how far it got — a missing section is written as "did not run",
 * never left out, and never rendered as a pass.
 *
 * Usage: node summary.mjs <out-dir> <walk-outcome>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'rehearsal-out';
const walkOutcome = process.argv[3] ?? '';

const read = (f) => (existsSync(join(out, f)) ? readFileSync(join(out, f), 'utf8') : null);
const readJson = (f) => {
  const raw = read(f);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const envFile = (f) =>
  Object.fromEntries(
    (read(f) ?? '')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );

const release = envFile('release.env');
const timings = envFile('timings.env');
const migrations = readJson('migrations.json');
const steps = readJson('steps.json');
const requests = readJson('requests.json');
const blocked = readJson('blocked-requests.json');
const upload = (read('in-this-upload.txt') ?? '').split('\n').filter(Boolean);
const pushLog = read('db-push.log');
const swallowed = (read('swallowed-http.txt') ?? '').trim();

const short = (sha) => (sha ? String(sha).slice(0, 7) : '');
const mins = (s) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return 'n/a';
  return n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`;
};
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const stepList = Array.isArray(steps?.steps) ? steps.steps : [];
const failedStep = stepList.find((s) => s.ok === false);
const walked = stepList.length > 0;
const allGreen = walkOutcome === 'success' && walked && !failedStep && steps?.finished === true;

const lines = [];
const say = (s = '') => lines.push(s);

say(`# Release rehearsal — ${allGreen ? '✅ PASSED' : '❌ DID NOT PASS'}`);
say();
if (!allGreen) {
  if (failedStep) {
    say(`**Stopped at: "${failedStep.title}"** — ${cell(failedStep.error ?? 'no message')}`);
    if (failedStep.screenshot) say(`Screenshot of that moment: \`rehearsal-screens/${failedStep.screenshot}\``);
  } else if (!walked) {
    say('**The walk did not run** — the rehearsal stopped before the app was up. See the red step on the run page.');
  } else {
    say(`**The walk ended as "${walkOutcome || 'unknown'}"** without finishing every step.`);
  }
  say();
  say('Do not upload this release until a rehearsal passes.');
  say();
}

say('## What was rehearsed');
say();
say(`- Ref: \`${release.ref ?? '?'}\` at \`${short(release.ref_sha) || '?'}\``);
if (release.live_sha) {
  say(`- The site is on: \`${release.live_ref}\` at \`${short(release.live_sha)}\``);
  say(`- **In this upload: ${upload.length} commit${upload.length === 1 ? '' : 's'}**`);
} else {
  say(`- No usable "live" commit (\`${release.live_ref ?? ''}\`) — the list of what this upload adds could not be made.`);
}
say();
if (upload.length > 0) {
  say('<details><summary>Commits in this upload</summary>');
  say();
  say('```');
  for (const l of upload.slice(0, 150)) say(l);
  if (upload.length > 150) say(`… and ${upload.length - 150} more (the full list is in diagnostics/in-this-upload.txt)`);
  say('```');
  say('</details>');
  say();
}

say('## Database — migrations');
say();
if (!migrations) {
  say('**Did not run** (or failed before writing its report).');
} else {
  say(`- ${migrations.total} migration files in the ref.`);
  say(`- Baseline (what the live site has): ${migrations.baseline} files, ${migrations.applied} applied by the repo's replay engine in ${mins(migrations.seconds)}.`);
  if (migrations.release.length > 0) {
    say(`- **This upload adds ${migrations.release.length} migration${migrations.release.length === 1 ? '' : 's'}**, applied with \`supabase db push --include-all\` (the production command):`);
    for (const f of migrations.release) say(`  - \`${f}\``);
  } else {
    say('- This upload adds no migration (or no live commit was given) — `supabase db push --include-all` had nothing to apply.');
  }
  if (migrations.skipped.length > 0) {
    say(`- ${migrations.skipped.length} file(s) cannot apply to an EMPTY database and were recorded as applied (production has them):`);
    for (const s of migrations.skipped) say(`  - \`${s.file}\` — ${cell(s.reason)}`);
  }
  if (migrations.outOfOrder.length > 0) {
    say(`- ${migrations.outOfOrder.length} back-numbered file(s) were applied at the first point they could be (same rule as the repo's db tests).`);
  }
  if (migrations.unapplied.length > 0) {
    say(`- ❌ **${migrations.unapplied.length} file(s) did not apply:**`);
    for (const u of migrations.unapplied) say(`  - \`${u.file}\` — ${cell(u.reason)}`);
  }
  say(`- Scheduled database jobs: ${migrations.cronJobs.total} defined, ${migrations.cronJobs.active} active (must be 0 in a rehearsal).`);
}
if (pushLog) {
  const tail = pushLog.trim().split('\n').slice(-6).join('\n');
  say();
  say('<details><summary>supabase db push — last lines</summary>');
  say();
  say('```');
  say(tail);
  say('```');
  say('</details>');
}
say();

say('## The walk (375×812)');
say();
if (!walked) {
  say('**Did not run.**');
} else {
  say('| # | Step | Result | What was checked | Screenshot |');
  say('|---|---|---|---|---|');
  stepList.forEach((s, i) => {
    const result = s.ok === true ? '✅' : s.ok === false ? '❌' : '— not reached';
    say(
      `| ${i + 1} | ${cell(s.title)} | ${result} | ${cell((s.checks ?? []).join(' · ') || (s.error ?? ''))} | ${s.screenshot ? `\`${s.screenshot}\`` : ''} |`,
    );
  });
}
say();

say('## Requests each step cost');
say();
const reqSteps = Array.isArray(requests?.steps) ? requests.steps : [];
if (reqSteps.length === 0) {
  say('**Not recorded** — the counter did not report.');
} else {
  say('Counted at the door between the app and the database, for the fixture (30 guests, 12 suppliers, 3 orders).');
  say('"DB" = PostgREST requests (reads + writes + function calls). "from the phone" = sent by the browser itself, the rest by the app\'s server.');
  say();
  say('| Step | Screen loads | Presses | DB reads | DB writes | DB function calls | **DB total** | from the phone | auth | refused | Asked most |');
  say('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  let grand = 0;
  const refusedLines = [];
  for (const s of reqSteps) {
    const sv = s.counts?.server ?? {};
    const br = s.counts?.browser ?? {};
    const sum = (k) => (sv[k] ?? 0) + (br[k] ?? 0);
    const db = sum('read') + sum('write') + sum('rpc');
    const fromPhone = (br.read ?? 0) + (br.write ?? 0) + (br.rpc ?? 0);
    if (!s.step.startsWith('(')) grand += db;
    const walked = stepList.find((r) => r.counted === s.step);
    const top = Object.entries(s.targets ?? {})
      .filter(([k]) => !k.startsWith('auth:') && !k.startsWith('other:'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${k.replace(/^(read|write|rpc):/, '')} ×${n}`)
      .join(', ');
    for (const [k, n] of Object.entries(s.refused ?? {})) {
      const sample = s.refusedSamples?.[k];
      refusedLines.push(
        `- ${cell(s.step)}: \`${cell(k)}\` ×${n}` +
          (sample ? `\n  - asked: \`${cell(sample.asked)}\`\n  - the database said: \`${cell(sample.said)}\`` : ''),
      );
    }
    const label = s.step === '(the build)' && timings.build_seconds === '0' ? '(the build — an identical build was reused, so nothing was asked)' : s.step;
    say(
      `| ${cell(label)} | ${walked ? walked.app?.screens ?? '' : ''} | ${walked ? walked.app?.presses ?? '' : ''} | ${sum('read')} | ${sum('write')} | ${sum('rpc')} | **${db}** | ${fromPhone} | ${sum('auth')} | ${s.failed ?? 0} | ${cell(top)} |`,
    );
  }
  say(`| **Whole walk** (steps only) | | | | | | **${grand}** | | | | |`);
  say();
  say('"Screen loads" = how many screens the phone asked the app\'s server to draw during the step: the one the person opened, plus every screen the app loaded in the background on its own (link preloads and the app\'s own preloader). "Presses" = taps that reached the server. Every number in a row is everything that row set off, counted until the database went quiet.');
  say();
  if (refusedLines.length > 0) {
    say(`**Requests the database refused (${refusedLines.length} kinds)** — each is worth a look before the upload:`);
    say();
    for (const l of refusedLines.slice(0, 40)) say(l);
    say();
  }
  say('> `auth` is HIGHER here than on the live site: the local stack signs sessions the legacy way, so the app asks the auth server on each navigation; production checks the token itself. The DB columns are not affected.');
}
say();

say('## Nothing live was touched');
say();
say('- No production secret or variable is named in the workflow; the run refuses to start if one is in its environment.');
say('- The live hostnames resolved to this runner for the whole run.');
if (swallowed !== '') {
  say(`- Database → outside calls swallowed (pg_net, e.g. the notify webhook): **${swallowed}**. None was sent.`);
} else {
  say('- Database → outside calls: the swallowed count could not be read.');
}
if (Array.isArray(blocked?.hosts)) {
  const hosts = blocked.hosts;
  if (hosts.length === 0) {
    say('- The browser asked for nothing outside this runner.');
  } else {
    say(`- The browser asked for ${blocked.total} address(es) outside this runner; every one was refused: ${hosts.map((h) => `\`${cell(h.host)}\` ×${h.count}`).join(', ')}.`);
  }
} else {
  say('- Browser → outside requests: not recorded (the walk did not finish writing its report).');
}
say();

say('## What is stubbed');
say();
say('- **Email (Resend), file storage (R2), error reporting (Sentry), analytics (PostHog), AI, payments:** no key is given, so each takes the path the app already has for "not configured". Nothing is sent or stored outside the runner.');
say('- **Images hosted on the live media address** do not load (the address is refused) — some screenshots show empty picture frames.');
say('- **Sign-in tokens** are signed the legacy way by the local stack (see the note under the request table).');
say('- **The database is built from the migration FILES**, not copied from production: anything production holds that no file wrote is not here.');
say();

say('## How long it took');
say();
const total = Number(timings.finished) - Number(timings.started);
say(`- Whole run: **${mins(total)}**`);
say(`- Local stack: ${mins(timings.stack_seconds)} · migrations (baseline): ${mins(timings.baseline_seconds)} · db push: ${mins(timings.push_seconds)} · build: ${timings.build_seconds === '0' ? 'reused an identical build' : mins(timings.build_seconds)} · walk: ${mins(timings.walk_seconds)}`);
say();

const screens = existsSync(join(out, 'screens')) ? readdirSync(join(out, 'screens')).filter((f) => f.endsWith('.png')).sort() : [];
say(`Screenshots (${screens.length}) are in this run's artifact **release-rehearsal** → \`rehearsal-screens/\`.`);

const md = lines.join('\n') + '\n';
writeFileSync(join(out, 'REHEARSAL.md'), md);
process.stdout.write(md);
