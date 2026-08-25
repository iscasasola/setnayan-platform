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
  assert.match(code, /r\.source === 'samahan'/, 'chips are not built from the rows');
  assert.match(code, /samahanGroups\.map/, 'the chips do not render from that list');
});

test('a chip drives the search that already exists, and can be turned off', () => {
  assert.match(code, /setQuery\(active \? '' : g\)/, 'a chip cannot be un-pressed');
  assert.match(code, /aria-pressed=\{active\}/, 'a pressed chip does not say so');
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
