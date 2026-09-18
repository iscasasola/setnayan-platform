/**
 * the-console-claims-only-what-it-does.test.ts — the day-of console may not
 * tell a supplier that something reaches the couple when it never leaves their
 * phone.
 *
 * ── The defect, in one sentence ────────────────────────────────────────────
 * Both headings above the shot list read "Shot list · syncs to the couple".
 * `shot-list.tsx` says of itself, in its own docblock, "Nothing here touches
 * the server" — it is `localStorage`, namespaced by eventId, and its only
 * persistence calls are `window.localStorage.getItem` / `.setItem`. So the list
 * does not reach the couple, and does not even follow the shooter to a second
 * device. A photographer reading that heading on a wedding morning has no
 * reason to send the couple anything, because the screen has told them it is
 * already done.
 *
 * 🔑 THE CLAIM AND THE MECHANISM WERE WRITTEN BY THE SAME COMMIT AND
 * CONTRADICTED EACH OTHER FROM THE START. Nothing failed; the sentence was
 * simply untrue, and a sentence cannot fail a test that does not exist.
 *
 * ── What this pins ────────────────────────────────────────────────────────
 * Two properties, and the second is the load-bearing one:
 *
 *   1. no heading in the console claims the shot list syncs/sends/shares to
 *      the couple;
 *   2. IF `shot-list.tsx` ever genuinely gains a server writer, this test
 *      fails — so the claim can come back, but only WITH the mechanism, and
 *      whoever builds it is told to update this file rather than discovering
 *      the heading is now allowed.
 *
 * Property 2 is why this is not just a string ban. A guard that only forbade
 * the words would still be green on the day somebody shipped the sync and left
 * the honest heading in place, and would quietly forbid a true statement.
 *
 * ── DAY-10 · PROPERTY 2 FIRED, AS DESIGNED (2026-09-18) ───────────────────
 * The sync was built: `event_shot_list_items` (migration 20271234188149),
 * written through `../shot-list-actions.ts` and read by the couple in
 * `dashboard/[eventId]/vendors/[vendorId]/workspace/_components/shot-list-card.tsx`.
 * So the second test below now asserts the OPPOSITE of what it used to — the
 * writer must exist — and the heading may speak about the couple ONLY while
 * BOTH halves (the writer and the couple's reader) are present. Remove either
 * half and the heading claim goes red again.
 *
 * 🛡 Mutation-checked (original, pre-DAY-10): the heading was restored on ONE of the two sites and the
 * count printed before and after, to prove the sabotage landed; the test went
 * RED naming that site. The `shot-list.tsx` rule was broken by adding a fake
 * `await fetch('/api/x')` and confirmed RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSOLE_PAGE = join(HERE, 'page.tsx');
const SHOT_LIST = join(HERE, '_components', 'shot-list.tsx');
const SHOT_LIST_ACTIONS = join(HERE, 'shot-list-actions.ts');
const COUPLE_WORKSPACE = join(
  HERE,
  '..',
  '..',
  'dashboard',
  '[eventId]',
  'vendors',
  '[vendorId]',
  'workspace',
  'page.tsx',
);

/**
 * Comments are stripped so a docblock EXPLAINING the rule does not satisfy it.
 *
 * ⚠ ONE COMMENT STRIPPER — `@/lib/strip-comments`, never a local regex. This
 * file shipped its own two-line regex version first and a blocking guard caught
 * it, correctly: `/*` inside a STRING (`accept="image/*"`, `video/*`) opens a
 * comment that never existed and blanks real code to the next `*​/`. That
 * version hid 5,104 lines across 1,031 files when it last shipped here.
 */
function code(path: string): string {
  return stripComments(readFileSync(path, 'utf8'));
}

/** Any shot-list heading line on the console that talks about the couple. */
function headingLinesAboutTheCouple(): string[] {
  return code(CONSOLE_PAGE)
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /shot\s*list/i.test(line) && /\bcouple\b/i.test(line))
    .map(({ n, line }) => `${n}: ${line.trim()}`);
}

/** The writer half: the component calls every server writer it imports. */
function writerHalf(): string[] {
  const missing: string[] = [];
  const comp = code(SHOT_LIST);
  for (const fn of ['loadShotList', 'replaceShotList', 'addShot', 'setShotCaptured', 'removeShot']) {
    const calls = comp.split(new RegExp(`\\b${fn}\\s*\\(`)).length - 1;
    if (calls < 1) missing.push(`shot-list.tsx never calls ${fn}()`);
  }
  if (!/from\s+'\.\.\/shot-list-actions'/.test(comp)) missing.push('shot-list.tsx does not import ../shot-list-actions');
  const actions = code(SHOT_LIST_ACTIONS);
  if (!/^'use server';/m.test(actions)) missing.push("shot-list-actions.ts is not 'use server'");
  const tableWrites = actions.split(/\.from\('event_shot_list_items'\)/).length - 1;
  // load + replace(select, insert, delete) + add + toggle + remove = 7.
  if (tableWrites < 7) missing.push(`shot-list-actions.ts touches event_shot_list_items ${tableWrites}× (floor 7)`);
  return missing;
}

/** The reader half: the couple's workspace reads the table AND mounts the card once. */
function readerHalf(): string[] {
  const missing: string[] = [];
  const ws = code(COUPLE_WORKSPACE);
  const reads = ws.split(/\.from\('event_shot_list_items'\)/).length - 1;
  if (reads !== 1) missing.push(`couple workspace reads event_shot_list_items ${reads}× (want 1)`);
  const mounts = ws.split(/<ShotListCard\b/).length - 1;
  if (mounts !== 1) missing.push(`couple workspace mounts <ShotListCard> ${mounts}× (want 1)`);
  return missing;
}

test('the shot list reaches the server — both the writer and the couple’s reader exist', () => {
  const missing = [...writerHalf(), ...readerHalf()];
  console.log(`# writer+reader gaps: ${missing.length}`);
  assert.deepEqual(missing, [], 'DAY-10: the shot list must be saved AND read by the couple');
});

test('a console heading may speak about the couple only while both halves exist', () => {
  const claims = headingLinesAboutTheCouple();
  console.log(`# shot-list heading lines about the couple: ${claims.length}`);
  if (claims.length === 0) return;
  const missing = [...writerHalf(), ...readerHalf()];
  assert.deepEqual(
    missing,
    [],
    `the console heading says the couple can see the shot list (${claims.join(' | ')}) — ` +
      'but a half of the mechanism is missing. Restore it, or take the claim out of the heading.',
  );
});

test('the device cache is kept, and it is a cache — the component still says when it is only local', () => {
  const comp = code(SHOT_LIST);
  assert.match(comp, /window\.localStorage\.setItem/, 'the offline cache must stay');
  // The three states the status line must be able to say. Anchored on the
  // copy the supplier reads, because that sentence is the property.
  for (const phrase of [/Saved — the couple can see/, /Not shared yet/, /Not saved to Setnayan — changes are on this device only/]) {
    assert.match(comp, phrase, `status line lost a state: ${phrase}`);
  }
});
