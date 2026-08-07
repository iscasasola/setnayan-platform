/**
 * The `do-not-auto-merge` label must be a CONTROL, not a convention.
 *
 * ── WHAT WENT WRONG (measured 2026-08-07) ──────────────────────────────────
 * `auto-merge.yml` arms auto-merge on every non-draft PR. A hold was added the
 * same morning — a label, a title string, and draft. But the label was only ever
 * consulted at `opened`, and NOTHING undid an arming afterwards:
 *
 *   label `do-not-auto-merge` created ....... 04:17:20Z
 *   #4186 opened ............................ 2026-08-06 11:46:40Z  (16h EARLIER)
 *   #4209 opened ............................ 04:02:57Z             (14m EARLIER)
 *   both labelled ........................... 04:17
 *   both MERGED ............................. 04:28:43 / 04:28:46
 *
 * Neither PR could have been opened carrying a label that did not exist yet.
 * Both were armed at open, wore the hold label for eleven minutes, and merged
 * anyway — one of them the public privacy notice published in the owner's name
 * as DPO, the very document the hold was invented to protect.
 *
 * 🔑 THE FIX'S OWN LESSON, ONE LEVEL DOWN. That PR's thesis was "a convention
 * that lives in someone's head is not a control" — and then it documented the
 * recovery step, `gh pr merge --disable-auto`, in a COMMENT. A comment is a
 * convention. `--disable-auto` appeared in the file exactly once, inside prose.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * Not the wording — the wiring. Three things must all stay true, and each one
 * alone is enough to make the hold fake again.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const WORKFLOW = join(HERE, '../../../.github/workflows/auto-merge.yml');
const src = readFileSync(WORKFLOW, 'utf8');

/** The `if:` block of a named job, up to the next top-level key. */
function jobCondition(job: string): string {
  const at = src.indexOf(`${job}:`);
  assert.ok(at > -1, `job \`${job}\` is missing from auto-merge.yml`);
  const after = src.slice(at);
  const ifAt = after.indexOf('if:');
  assert.ok(ifAt > -1 && ifAt < 1200, `job \`${job}\` has no \`if:\` guard`);
  return after.slice(ifAt, after.indexOf('runs-on:', ifAt));
}

test('the workflow listens for `labeled` at all', () => {
  const types = src.match(/types:\s*\[([^\]]*)\]/);
  assert.ok(types, 'auto-merge.yml declares no pull_request types');
  assert.match(
    types[1]!,
    /labeled/,
    'Without `labeled` in the trigger list, applying the hold label fires nothing ' +
      'and an already-armed PR stays armed — exactly how #4186 and #4209 merged.',
  );
});

test('a disarm job exists and actually runs --disable-auto', () => {
  assert.match(
    src,
    /disarm-on-hold-label:/,
    'the disarm job is gone — the label is decoration again',
  );
  // The whole point: --disable-auto must appear as a COMMAND, not only in prose.
  const runLines = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  assert.match(
    runLines,
    /--disable-auto/,
    'A recovery step that exists only in a comment is a convention, not a control. ' +
      'That is the precise mistake this job was written to correct.',
  );
});

test('the disarm job fires on the hold label, and only on it', () => {
  const cond = jobCondition('disarm-on-hold-label');
  assert.match(cond, /github\.event\.action\s*==\s*'labeled'/, 'disarm must be scoped to the labeled event');
  assert.match(
    cond,
    /github\.event\.label\.name\s*==\s*'do-not-auto-merge'/,
    'disarm must fire for the hold label specifically — disarming on ANY label ' +
      'would silently stop ordinary PRs from merging, and a guard that fires on ' +
      'the wrong thing teaches its reader to ignore it.',
  );
});

test('LABELLING A PR CAN NEVER BE WHAT ARMS IT', () => {
  const cond = jobCondition('enable-automerge');
  assert.match(
    cond,
    /github\.event\.action\s*!=\s*'labeled'/,
    'The arming job must exclude the labeled event. `labeled` is in the trigger ' +
      'list for the disarm job; if arming does not opt out, adding the hold label ' +
      'would ARM the very PR it was meant to stop — strictly worse than before.',
  );
});

test('the three documented holds are all still wired', () => {
  const cond = jobCondition('enable-automerge');
  assert.match(cond, /draft\s*==\s*false/, 'draft hold lost');
  assert.match(cond, /do-not-auto-merge/, 'label hold lost from the arming condition');
  assert.match(cond, /DO NOT AUTO-MERGE/, 'title hold lost');
});
