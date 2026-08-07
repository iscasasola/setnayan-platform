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

// THE REAL INVARIANT: applying the hold label must never be the event that ARMS
// a PR.
//
// This used to be checked by its proxy — "`labeled` must not be a trigger at all"
// — which was right for the original design, where the only job was the arming
// one. It is too strict now. On 2026-08-07 the label turned out to protect only
// a PR that already carried it AT `opened`; #4186 and #4209 were armed at open,
// labelled 16h/14m later, wore the label for eleven minutes and merged anyway.
// Fixing that needs `labeled` as a trigger so a DISARM job can fire on it.
//
// So assert the property, not the proxy: `labeled` may be a trigger ONLY IF the
// arming job explicitly opts out of it. That is strictly stronger than the old
// check — it still forbids the backwards case, and additionally permits the one
// arrangement that makes the label work at any time.
const triggers = yml.match(/types:\s*\[([^\]]*)\]/)?.[1] ?? '';
if (/\blabeled\b/.test(triggers)) {
  // The arming job's condition must exclude the labeled event.
  const armingOptsOut = /github\.event\.action\s*!=\s*'labeled'/.test(yml);
  if (!armingOptsOut) {
    failures.push(
      '`labeled` is a trigger but the arming job does not opt out of it — adding the ' +
        "do-not-auto-merge label would itself ARM the PR, which is exactly backwards. " +
        "Add `github.event.action != 'labeled'` to enable-automerge's `if:`",
    );
  }
  // And if we are paying the cost of the trigger, the disarm job must exist and
  // must actually run the command — a recovery step that lives in a comment is a
  // convention, which is the precise failure this whole guard exists to prevent.
  const nonComment = yml
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  if (!/disarm-on-hold-label:/.test(yml) || !/--disable-auto/.test(nonComment)) {
    failures.push(
      '`labeled` is a trigger but nothing disarms on it — the disarm-on-hold-label job ' +
        'must exist and must run `--disable-auto` as a COMMAND, not mention it in a comment',
    );
  }
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

console.log(
  'lint-automerge-hold: OK — label hold, title hold, and labelling can only disarm, never arm.',
);
