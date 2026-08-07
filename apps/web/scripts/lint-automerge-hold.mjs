#!/usr/bin/env node
/**
 * Guard: the auto-merge workflow must always honour a "do not auto-merge" hold.
 *
 * WHY THIS EXISTS (2026-08-07, a near miss). The standing rule is that
 * public-facing LEGAL COPY — privacy notices, pricing disclosures — is opened
 * for the owner to read and merge in his own name as DPO, never merged by a
 * machine. The only thing protecting that was "don't run `gh pr merge --auto`".
 *
 * That protects nothing: `.github/workflows/auto-merge.yml` arms auto-merge for
 * you, on every non-draft PR. The privacy-retention PR was opened deliberately
 * unarmed, VERIFIED unarmed, and was armed by that workflow about a minute
 * later. It was caught only because a re-check happened to run.
 *
 * 🔑 A convention that lives in someone's head is not a control. This turns it
 * into one, and this script is the thing that stops the control being deleted
 * later by someone tidying up a YAML file they do not have the context for.
 *
 * Run by CI alongside the other lint-*.mjs scripts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, '..', '..', '..', '.github', 'workflows', 'auto-merge.yml');

const failures = [];

if (!existsSync(WORKFLOW)) {
  // Deleting the workflow is a legitimate future step — its own header says to
  // retire it at public-vendor launch. That REMOVES the auto-arming, so there is
  // nothing left to hold back and this guard has no job.
  console.log('lint-automerge-hold: auto-merge.yml is gone — nothing arms PRs, guard not needed.');
  process.exit(0);
}

const yml = readFileSync(WORKFLOW, 'utf8');

/** The two hold conditions that must survive any edit to the `if:` block. */
const REQUIRED = [
  {
    re: /!contains\(\s*github\.event\.pull_request\.labels\.\*\.name\s*,\s*'do-not-auto-merge'\s*\)/,
    what: "the `do-not-auto-merge` LABEL check",
    why: 'the label is the real control — a PR carrying it must never be armed',
  },
  {
    re: /!contains\(\s*github\.event\.pull_request\.title\s*,\s*'DO NOT AUTO-MERGE'\s*\)/,
    what: 'the `DO NOT AUTO-MERGE` TITLE check',
    why: 'catches a PR opened before anyone thought to label it — both PRs that needed this had the words in the title and no label',
  },
];

for (const { re, what, why } of REQUIRED) {
  if (!re.test(yml)) failures.push(`missing ${what} — ${why}`);
}

// `labeled` must NOT be a trigger: adding the hold label must never be the very
// event that arms the PR.
const triggers = yml.match(/types:\s*\[([^\]]*)\]/)?.[1] ?? '';
if (/\blabeled\b/.test(triggers)) {
  failures.push(
    "`labeled` is a trigger — adding the do-not-auto-merge label would itself arm the PR, " +
      'which is exactly backwards',
  );
}

if (failures.length > 0) {
  console.error('\n✖ lint-automerge-hold — the auto-merge hold is broken:\n');
  for (const f of failures) console.error(`  · ${f}`);
  console.error(
    '\n  Legal copy (privacy notices, pricing disclosures) is opened for the owner to merge\n' +
      '  in his own name as DPO. Without these conditions the workflow arms it automatically\n' +
      '  and it merges itself. Restore them rather than weakening this check.\n',
  );
  process.exit(1);
}

console.log('lint-automerge-hold: OK — label hold, title hold, and no `labeled` trigger.');
