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
 * Usage: node summary.mjs <out-dir> <walk-outcome> [<sweep-outcome>]
 *
 * The control sweep's own report (every screen, every failure) is written to
 * SWEEP.md beside REHEARSAL.md, and summarised in REHEARSAL.md.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'rehearsal-out';
const walkOutcome = process.argv[3] ?? '';
const sweepOutcome = process.argv[4] ?? '';

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
const SWEEP_PARTS = [
  ['couple', 'phone'],
  ['supplier', 'phone'],
  ['couple', 'desktop'],
  ['supplier', 'desktop'],
];
const sweeps = SWEEP_PARTS.map(([persona, width]) => ({ persona, width, r: readJson(`sweep-${persona}-${width}.json`) }));
const sweepRan = sweeps.some((x) => x.r);
const sweepFailures = sweeps.flatMap((x) => x.r?.failures ?? []);
// A sweep that was switched off (0 minutes) is "skipped"; one that ran must be clean and complete.
const sweepGreen = sweepOutcome === 'skipped' || sweepOutcome === '' ? !sweepRan || sweepFailures.length === 0 : sweepOutcome === 'success';
const walkGreen = walkOutcome === 'success' && walked && !failedStep && steps?.finished === true;
const allGreen = walkGreen && sweepGreen;

const lines = [];
const say = (s = '') => lines.push(s);

say(`# Release rehearsal — ${allGreen ? '✅ PASSED' : '❌ DID NOT PASS'}`);
say();
if (!allGreen) {
  if (!walkGreen && failedStep) {
    say(`**Stopped at: "${failedStep.title}"** — ${cell(failedStep.error ?? 'no message')}`);
    if (failedStep.screenshot) say(`Screenshot of that moment: \`rehearsal-screens/${failedStep.screenshot}\``);
  } else if (!walked) {
    say('**The walk did not run** — the rehearsal stopped before the app was up. See the red step on the run page.');
  } else if (!walkGreen) {
    say(`**The walk ended as "${walkOutcome || 'unknown'}"** without finishing every step.`);
  }
  if (!sweepGreen) {
    say(
      sweepFailures.length > 0
        ? `**The control sweep found ${sweepFailures.length} failure${sweepFailures.length === 1 ? '' : 's'}** — the numbered list is under "Every control, pressed" below.`
        : `**The control sweep ended as "${sweepOutcome || 'unknown'}"** — see "Every control, pressed" below.`,
    );
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

// ── THE CONTROL SWEEP ────────────────────────────────────────────────────
const sw = [];
const sws = (x = '') => sw.push(x);
const widthLabel = (w) => (w === 'phone' ? '375 px' : 'desktop');
/** One numbered line per distinct failure, with every place it was seen. */
const grouped = new Map();
for (const f of sweepFailures) {
  const g = grouped.get(f.key) ?? { f, places: [] };
  g.places.push(f);
  grouped.set(f.key, g);
}
const failureLines = [];
let fn = 0;
for (const { f, places } of grouped.values()) {
  fn += 1;
  failureLines.push(`${fn}. **${f.kind}** on \`${cell(f.route)}\` — control **${cell(f.control)}** (${f.persona} · ${widthLabel(f.width)})`);
  failureLines.push(`   - error: \`${cell(f.text).slice(0, 500)}\``);
  if (f.url) failureLines.push(`   - address: \`${cell(f.url)}\``);
  if (f.screenshot) failureLines.push(`   - screenshot: \`rehearsal-screens/${f.screenshot}\``);
  if (places.length > 1) {
    const where = [...new Set(places.slice(1).map((p) => `${p.persona} · ${widthLabel(p.width)} · ${p.route} · "${p.control}"`))];
    failureLines.push(`   - also seen ${places.length - 1} more time${places.length === 2 ? '' : 's'}: ${cell(where.slice(0, 6).join(' ; '))}${where.length > 6 ? ` … and ${where.length - 6} more` : ''}`);
  }
}

sws('## Every control, pressed (the sweep)');
sws();
if (!sweepRan) {
  sws(sweepOutcome === 'skipped' ? '**Not run** (switched off for this run, or the walk never started).' : '**Did not run** (or failed before writing its report).');
} else {
  sws('Signed in as the couple and as the supplier; every dashboard screen in `lib/ugat/screens.generated.json` opened and every control pressed (each dropdown option picked, each sheet opened, swept and closed). **Red** on an error screen, a page or console error, or any 5xx.');
  sws();
  sws('| Who | Width | Screens swept | Controls pressed | Options picked | Dialogs opened | Never pressed (skip list) | Could not press | Not swept | **Failures** | Time |');
  sws('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const { persona, width, r } of sweeps) {
    if (!r) {
      sws(`| ${persona} | ${widthLabel(width)} | did not run | | | | | | | | |`);
      continue;
    }
    const routes = r.routes ?? [];
    const swept = routes.filter((x) => x.status === 'swept' || x.status === 'error-on-load').length;
    const sum = (k) => routes.reduce((n, x) => n + (Array.isArray(x[k]) ? x[k].length : x[k] ?? 0), 0);
    const notSwept = routes.filter((x) => !['swept', 'error-on-load'].includes(x.status)).length + (r.left ?? []).length;
    const secs = routes.reduce((n, x) => n + (x.seconds ?? 0), 0);
    sws(`| ${persona} | ${widthLabel(width)} | ${swept} | ${sum('pressed')} | ${sum('options')} | ${sum('dialogs')} | ${sum('skipped')} | ${sum('unpressable')} | ${notSwept} | **${(r.failures ?? []).length}** | ${mins(secs)}${r.finished ? '' : ' (did not finish)'} |`);
  }
  sws();
  if (failureLines.length === 0) {
    sws('**No failure.** No error screen, no page or console error, no 5xx on any control pressed.');
  } else {
    sws(`### Failures — ${grouped.size} distinct (${sweepFailures.length} in all)`);
    sws();
    for (const l of failureLines) sws(l);
  }
  sws();
}
const sweepSummary = [...sw];

// The full report (every screen, every skip) — SWEEP.md, in the artifact.
if (sweepRan) {
  sws('### Every screen');
  sws();
  sws('| Who | Width | Screen | Result | Pressed | Options | Dialogs | Skipped | Could not press | Failures | Notes |');
  sws('|---|---|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const { persona, width, r } of sweeps) {
    for (const x of r?.routes ?? []) {
      const result = { swept: '✅ swept', 'error-on-load': '❌ error on load', 'not-reached': '— not reached (budget)', 'no-fixture': '— no address to open', 'signed-out': '❌ signed out', 'harness-error': '⚠️ sweep stumbled' }[x.status] ?? x.status;
      sws(`| ${persona} | ${widthLabel(width)} | \`${cell(x.label)}\`${x.landed ? ` → \`${cell(x.landed)}\`` : ''} | ${x.failures > 0 && x.status === 'swept' ? '❌ swept' : result} | ${x.pressed} | ${x.options} | ${x.dialogs} | ${x.skipped.length} | ${x.unpressable.length} | ${x.failures} | ${cell((x.notes ?? []).join(' · ')).slice(0, 300)} |`);
    }
    for (const l of r?.left ?? []) sws(`| ${persona} | ${widthLabel(width)} | \`${cell(l.route)}\` | — left out | | | | | | | ${cell(l.reason)} |`);
  }
  sws();
  const skips = new Map();
  for (const { r } of sweeps) for (const x of r?.routes ?? []) for (const k of x.skipped ?? []) {
    const key = `${k.name}|${k.reason}`;
    skips.set(key, { ...k, n: (skips.get(key)?.n ?? 0) + 1 });
  }
  sws(`### Never pressed — the skip list matched these (${skips.size})`);
  sws();
  sws('Matched by accessible name (`tests/rehearsal/sweep-rules.ts` SKIP_CONTROLS / SKIP_OPTIONS).');
  sws();
  for (const k of [...skips.values()].sort((a, b) => b.n - a.n)) sws(`- "${cell(k.name)}" — ${k.reason} (on ${k.n} screen${k.n === 1 ? '' : 's'})`);
  sws();
  const stuck = new Map();
  for (const { r } of sweeps) for (const x of r?.routes ?? []) for (const k of x.unpressable ?? []) {
    const key = `${x.label} · ${k.name}`;
    if (!stuck.has(key)) stuck.set(key, k.why);
  }
  sws(`### Could not press (${stuck.size}) — covered, moved or gone when its turn came`);
  sws();
  for (const [k, why] of [...stuck].slice(0, 200)) sws(`- \`${cell(k)}\` — ${cell(why)}`);
  sws();
  const noise = {};
  const native = [];
  for (const { r } of sweeps) {
    for (const [id, v] of Object.entries(r?.noise ?? {})) noise[id] = { why: v.why, count: (noise[id]?.count ?? 0) + v.count };
    native.push(...(r?.nativeDialogs ?? []));
  }
  sws('### Rehearsal noise — counted, not failures');
  sws();
  if (Object.keys(noise).length === 0) sws('- none');
  for (const [id, v] of Object.entries(noise)) sws(`- \`${id}\` ×${v.count} — ${v.why}`);
  if (native.length > 0) {
    sws();
    sws(`Native confirm / alert boxes (dismissed — "no"): ${native.length}`);
    for (const d of native.slice(0, 40)) sws(`- ${cell(d)}`);
  }
}
writeFileSync(join(out, 'SWEEP.md'), sw.join('\n') + '\n');
for (const l of sweepSummary) say(l);
if (sweepRan) say('The full sweep report — every screen, every skip, everything that could not be pressed — is `SWEEP.md` in this run\'s artifact.');
say();

say('## Requests each step cost');
say();
const reqSteps = Array.isArray(requests?.steps) ? requests.steps : [];
if (reqSteps.length === 0) {
  say('**Not recorded** — the counter did not report.');
} else {
  say('Counted at the door between the app and the database, for the fixture (39 guests, 12 suppliers, 3 orders).');
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
say('- **Email (Resend), file storage (R2), error reporting (Sentry), AI, payments:** no key is given, so each takes the path the app already has for "not configured". Nothing is sent or stored outside the runner.');
say('- **Images hosted on the live media address** do not load (the address is refused) — some screenshots show empty picture frames.');
say('- **Sign-in tokens** are signed the legacy way by the local stack (see the note under the request table).');
say('- **The database is built from the migration FILES**, not copied from production: anything production holds that no file wrote is not here.');
say();

say('## How long it took');
say();
const total = Number(timings.finished) - Number(timings.started);
say(`- Whole run: **${mins(total)}**`);
say(`- Local stack: ${mins(timings.stack_seconds)} · migrations (baseline): ${mins(timings.baseline_seconds)} · db push: ${mins(timings.push_seconds)} · build: ${timings.build_seconds === '0' ? 'reused an identical build' : mins(timings.build_seconds)} · walk: ${mins(timings.walk_seconds)} · sweep: ${timings.sweep_seconds ? mins(timings.sweep_seconds) : 'did not run'}`);
say();

const screens = existsSync(join(out, 'screens')) ? readdirSync(join(out, 'screens')).filter((f) => f.endsWith('.png')).sort() : [];
say(`Screenshots (${screens.length}) are in this run's artifact **release-rehearsal** → \`rehearsal-screens/\`.`);

const md = lines.join('\n') + '\n';
writeFileSync(join(out, 'REHEARSAL.md'), md);
process.stdout.write(md);
