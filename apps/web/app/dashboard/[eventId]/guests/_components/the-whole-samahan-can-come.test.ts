/**
 * the-whole-samahan-can-come.test.ts — the group gesture on the people picker.
 *
 * ⚖ THE PREMISE WAS HALF STALE AND MEASURING IT CHANGED THE BUILD. The samahan
 * register says "you cannot invite a whole samahan to an event — today a
 * barkada and a guest list are strangers, you retype every name." Measured
 * against origin/main: a samahan's co-members have been offered in this very
 * sheet since 2026-08-21 (`getPeopleYouCanInvite` has a `samahan` source, and
 * second-degree members too). NOBODY RETYPES ANYTHING. What was actually
 * missing is the GROUP — twelve taps for a barkada — so what shipped is a chip
 * per samahan and one control that takes everyone the search is showing.
 *
 * 🔑 THE GROUP IS A FILTER, NOT A STORED LINK, and that is a decision worth
 * keeping: `guest_groups` has no `source_community_id` (verified absent in the
 * migrations AND in production), so a guest list can never change because
 * somebody joined or left a group chat. The names land as ordinary guests the
 * couple owns from that second on — which is also why the snapshot-vs-live
 * question that stalled this item never has to be answered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = stripComments(readFileSync(join(HERE, 'add-from-people-sheet.tsx'), 'utf8'));

test('the samahan chips are derived from the rows, never hand-listed', () => {
  // A hand-written list of groups is a list of the groups somebody thought of,
  // and this sheet cannot know a host's samahan names in advance.
  assert.match(code, /samahanGroupsIn\(rows \?\? \[\]\)/, 'chips are not built from the rows');
  assert.match(code, /samahanGroups\.map/, 'the chips do not render from that list');
});

test('a chip is a membership filter, not a word typed into the search box', () => {
  // 🚨 THE FIRST CUT STUFFED THE SAMAHAN'S NAME INTO THE SEARCH BOX and let the
  // text matcher do the work. That made "the whole barkada" a SUBSTRING search,
  // wrong in both directions at once: a group called "Ana" swept up Diana and
  // Joana — one press putting strangers on a wedding list — and any member whose
  // row was labelled with a different group, or with an event they were also a
  // guest at, was left out with nothing said.
  assert.match(code, /isInSamahan\(r, activeGroup\)/, 'the chip does not filter by membership');
  assert.match(code, /setActiveGroup\(active \? null : g\)/, 'a chip cannot be un-pressed');
  assert.match(code, /aria-pressed=\{active\}/, 'a pressed chip does not say so');
  assert.ok(
    !/setQuery\(active \? '' : g\)/.test(code),
    'the chip is back to typing into the search box',
  );
});

test('a group filter and a typed search are two filters, not one string', () => {
  // Both must apply, so a host can narrow inside a barkada.
  assert.match(code, /!activeGroup \|\| isInSamahan/, 'no chip means no filter — that must hold');
  assert.match(code, /inGroup\.filter\(\(r\) => matchesInvitableQuery\(r, query\)\)/);
});

test('nothing is dropped past the cap without saying so', () => {
  // 🪤 `picks.slice(0, 200)` has always been here and `failed` was only ever
  // incremented INSIDE the loop, so picks 201..N were neither added nor counted
  // and the call returned added:200, failed:0 — the sheet closed as if it had
  // worked. A one-tap "choose all" on a list that reads up to 500 candidates is
  // what made that reachable.
  const actions = stripComments(readFileSync(join(HERE, '..', 'people-add-actions.ts'), 'utf8'));
  assert.match(actions, /const overflow = Math\.max\(0, picks\.length - MAX_PICKS_PER_ADD\)/);
  assert.match(actions, /failed \+= overflow/, 'the overflow is dropped in silence again');
  assert.match(actions, /picks\.slice\(0, MAX_PICKS_PER_ADD\)/, 'the cap and the count disagree');
});

test('choosing everyone shown goes through the shared rule', () => {
  // Not a loop re-implemented in the component: the "never touch somebody
  // already here" rule is proved in people-you-can-invite-core.test.ts, and a
  // second copy in the sheet is a second place for it to drift softer.
  assert.match(code, /chooseAllShown\(prev, addableShown, allShownPicked\)/);
  assert.match(code, /visible\.filter\(\(r\) => !r\.alreadyHere\)/, 'the bar could re-add a guest');
});

test('the match rule is not re-implemented in the sheet', () => {
  assert.match(code, /matchesInvitableQuery\(r, query\)/);
  assert.ok(
    !/r\.from\.toLowerCase\(\)\.includes/.test(code),
    'the sheet has its own copy of the match rule again — a chip that stops ' +
      'matching the `from` line stops finding its own samahan',
  );
});

// ── THE DEAD STATE THE BULK CONTROL MADE REACHABLE (2026-08-25, completeness pass)

test('a pick that is off screen cannot hold Add shut in silence', () => {
  // 🚨 THE TRAP. `missingSurname` is computed over EVERY loaded row, but the
  // only control that can satisfy it — the "Last name" box — renders inside the
  // visible list. Press the barkada chip, choose all twelve, clear the chip, and
  // the one-word names are picked, off screen, and holding Add shut. Before the
  // bulk control you reached that state one tick at a time, with the input right
  // under your finger; one tap made it reachable for a dozen people at once.
  // Samahan rows are the population it bites: they come from a single
  // display-name string, and a group-chat handle is one word far more often than
  // a guest-list entry is.
  assert.match(
    code,
    /missingSurname\.length\} of your \{pickedKeys\.length\} need a last name/,
    'the footer does not say why Add is dead',
  );
  assert.match(code, /setOnlyBlocking\(true\)/, 'there is no way to reach the blocking picks');
  assert.match(
    code,
    /return \(rows \?\? \[\]\)\.filter\(\(r\) => missingSurname\.includes\(r\.key\)\)/,
    'the blocking view does not reach past the chip and the search',
  );
});

test('the blocking view has a way out, and lets itself out', () => {
  assert.match(code, /Show everyone again/, 'no way back to the whole list');
  assert.match(
    code,
    /if \(onlyBlocking && missingSurname\.length === 0\) setOnlyBlocking\(false\)/,
    'filling the last surname leaves you staring at an empty list',
  );
});
