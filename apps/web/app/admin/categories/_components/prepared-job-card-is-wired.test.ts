/**
 * prepared-job-card-is-wired.test.ts — the table has to reach a real input.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM prepared-jobs.test.ts ──────────────
 * That one proves the DESCRIPTORS are right. Right descriptors prove nothing on
 * their own: a guard on this very feature recently checked that a link existed
 * and that its target existed — both true, while the button was dead. So this
 * one asks the other question. Does a descriptor reach a server action? Does a
 * gathered value reach an input a person can see and a form can post? Does the
 * studio mount the card at all?
 *
 * The card and the studio are `'use client'` components wired to Next's router,
 * so neither can be imported into a node:test file. What CAN be checked exactly
 * is the wiring, against COMMENT-STRIPPED source — every file here carries a
 * docblock naming the very strings being asserted, and a raw-source match would
 * be satisfied by the prose describing the bug.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { PREPARED_TAXONOMY_JOBS } from './prepared-jobs';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const card = () => read('prepared-job-card.tsx');
const studio = () => read('taxonomy-studio.tsx');

const prepared = [...PREPARED_TAXONOMY_JOBS.keys()];

/** The keys of PREPARED_JOB_ACTIONS, read out of the card's source. */
function actionMapKeys(src: string): string[] {
  const open = src.indexOf('PREPARED_JOB_ACTIONS');
  assert.ok(open > 0, 'the action map is gone from the card');
  const start = src.indexOf('{', open);
  const end = src.indexOf('\n};', start);
  assert.ok(end > start, 'the action map is no longer a plain object — re-pin this test');
  return src
    .slice(start + 1, end)
    .split(',')
    .map((line) => line.trim().replace(/:.*$/, ''))
    .filter((s) => /^[A-Za-z0-9_]+$/.test(s));
}

/**
 * 🔑 BOTH DIRECTIONS. A descriptor with no action renders a button that does
 * nothing; an action with no descriptor can never be reached. Neither shows up
 * as an error — the card just sits there looking finished.
 */
test('every prepared job has an action, and every action has a descriptor', () => {
  const keys = actionMapKeys(card()).sort();
  assert.ok(keys.length > 0, 'the action map parsed as empty — this guard is proving nothing');
  assert.deepEqual(
    keys,
    [...prepared].sort(),
    'the descriptor table and the action map disagree — a card would render with a dead button, or an action would be unreachable',
  );
});

test('every action in the map comes from the taxonomy actions module', () => {
  const src = card();
  // The `import { … } from '../actions'` list, so a key can only be satisfied
  // by a real named import from the module that owns these actions — not by a
  // same-named local, and not by an import from somewhere else.
  const block = /import\s*\{([^}]*)\}\s*from\s*'\.\.\/actions'/.exec(src);
  assert.ok(block, "the card no longer imports from '../actions' — re-pin this test");
  const imported = new Set(
    block![1]!.split(',').map((s) => s.trim()).filter(Boolean),
  );
  assert.ok(imported.size > 0, 'the import list parsed as empty — this guard is proving nothing');
  for (const name of actionMapKeys(src)) {
    assert.ok(imported.has(name), `${name} is in the action map but not imported from '../actions'`);
  }
});

/**
 * 🔒 IT PREPARES, IT NEVER PRESSES — the one-person admin plan (2026-07-11).
 */
test('the card is a real form the admin submits, and submits nothing itself', () => {
  const src = card();
  assert.match(
    src,
    /<form\s+action=\{action\}/,
    'the card no longer posts the real server action — its button does nothing',
  );
  assert.match(src, /<SubmitButton/, 'the card has no submit control for the admin to press');
  assert.ok(
    !/useEffect|requestSubmit\(|\.submit\(/.test(src),
    'the card runs something on arrival — the machine may prepare and hold back, never press',
  );
});

/**
 * 🚨 "EXISTING IS NOT REACHABLE." A resolved value that never lands in an input
 * is a form that opens empty while every other guard says it is filled. Each
 * control shape must take its value from the prepared values, and each must
 * carry the field's own name or the action cannot read it back.
 */
test('a prepared value actually reaches every kind of control', () => {
  const src = card();
  for (const control of ['<select', '<textarea', '<input']) {
    const at = src.indexOf(control);
    assert.ok(at > 0, `the card renders no ${control} — a whole field kind cannot be filled`);
  }
  const filled = [...src.matchAll(/defaultValue=\{prepared\.values\[f\.field\]/g)].length;
  assert.ok(
    filled >= 3,
    `only ${filled} controls open on the prepared value — text, choice and multiline must all be filled`,
  );
  const named = [...src.matchAll(/name=\{f\.field\}/g)].length;
  assert.ok(named >= 3, `only ${named} controls carry the field name — the action cannot read the rest`);
  // The hidden plumbing field is posted as a value, not a defaultValue.
  assert.match(
    src,
    /type="hidden"[\s\S]{0,80}value=\{prepared\.values\[f\.field\]/,
    'the carried field no longer posts its gathered value — the answer is binned',
  );
});

/**
 * 🔑 A MISS IS SAID OUT LOUD. Without this the card silently opens on "— choose
 * —" and the admin has no way to know their words matched nothing.
 */
test('words that matched nothing are shown on the card', () => {
  const src = card();
  assert.match(src, /prepared\.misses\[f\.field\]/, 'the card no longer reads the misses');
  assert.match(
    src,
    /Nothing here is called/,
    'the card no longer names the words that matched nothing — the miss is silent again',
  );
});

/**
 * 🔒 AN UNRESOLVED PICKER MUST NOT BE SUBMITTABLE BY ACCIDENT — except where
 * clearing the field is itself a legitimate answer (a service's faith).
 */
test('an unresolved picker is required', () => {
  assert.match(
    card(),
    /required=\{!allowEmpty\}/,
    'the picker is no longer required, so an unresolved record can be submitted by pressing past it',
  );
});

// ── The studio must actually mount it ────────────────────────────────────────

test('the studio mounts the card and feeds it the table', () => {
  const src = studio();
  assert.match(
    src,
    /<PreparedJobCard/,
    'the studio no longer renders the prepared card — the whole table is unreachable',
  );
  assert.match(
    src,
    /PREPARED_TAXONOMY_JOBS\.get\(/,
    'the studio no longer looks the ask marker up in the table',
  );
  assert.match(
    src,
    /buildPreparedValues\(/,
    'the studio no longer builds the prepared values — the card would open empty',
  );
});

/**
 * ⚠ THE SAME-ROUTE TRAP, WHICH ALREADY COST THIS FEATURE A RELEASE. The search
 * box is mounted on /admin/taxonomy itself, so answering there is a same-route
 * navigation: React reconciles instead of remounting and an empty dependency
 * array never looks again. Every answer is discarded, with no error.
 */
test('the generic effect re-runs on a same-route navigation', () => {
  const src = studio();
  const at = src.indexOf('PREPARED_TAXONOMY_JOBS.get(');
  assert.ok(at > 0, 'the generic prefill effect is gone from the studio');
  const deps = src.slice(src.indexOf('}, [', at), src.indexOf(']);', at) + 3);
  assert.ok(
    !/^\}, \[\s*\]\);/.test(deps),
    'the generic prefill effect is on an EMPTY dependency array — answering while already on /admin/taxonomy discards every answer',
  );
  assert.ok(
    deps.includes('searchParams') || deps.includes('askSignature'),
    `the generic prefill effect no longer depends on the URL it reads: ${deps}`,
  );
});

/**
 * 🔑 RE-RUNNING MUST NOT CLOBBER THE ADMIN'S OWN EDITS. The filter box rewrites
 * ?q= on every keystroke; keying on the ask params alone is what makes a
 * re-running effect safe.
 */
test('the effect is keyed on the ask params alone, and a second ask remounts the inputs', () => {
  const src = studio();
  assert.match(
    src,
    /appliedPreparedRef\.current === askSignature/,
    'the generic effect no longer guards on the ask signature — typing in the filter box re-applies the prefill over hand edits',
  );
  assert.match(
    src,
    /key=\{preparedJob\.nonce\}/,
    'the card is no longer keyed on the ask — a second ask leaves the first ask’s answers in the boxes',
  );
});

/**
 * ⚠ PREPARED AND INVISIBLE is this feature's recurring failure: four views
 * replace the whole centre pane, so a card rendered inside one can land off
 * screen. This one sits above the view switch, which is what makes it
 * unnecessary to move the admin off the view they were on.
 */
test('the card renders outside the pane the view switch replaces', () => {
  const src = studio();
  const cardAt = src.indexOf('<PreparedJobCard');
  const switchAt = src.indexOf("view === 'unfiled' ?");
  assert.ok(switchAt > 0, 'the view switch moved — re-pin this test');
  assert.ok(
    cardAt > 0 && cardAt < switchAt,
    'the prepared card moved inside the swappable pane — an ask can now be prepared into a view that is not on screen',
  );
});
