/**
 * details-edits-in-place.test.ts — owner 2026-09-28 (DECISION_LOG "NO 'GO EDIT
 * IT OVER THERE' LINKS — EDIT IT WHERE YOU ARE"): on the Maker's Details page a
 * text-carrying switch shows its field right there, and the parents are
 * opened AND added right there. Held by source: no link sends the couple to the
 * Guest list to do it, and each edit goes through its shipped writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const L = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components');
const read = (f: string) => stripComments(readFileSync(join(L, f), 'utf8'));

test('a parent is opened and ADDED in place — the Guest list’s own add, the parent role preset', () => {
  const src = read('parent-cards.tsx');
  assert.doesNotMatch(src, /<Link\b|href=[^>]*\/guests|guestsHref/, 'a parent is sent to the Guest list again');
  assert.match(src, /import \{ addSingleGuest \} from '\.\.\/\.\.\/guests\/inline-actions';/, 'not the shipped single-guest add');
  assert.match(src, /roleHint: side === 'bride' \? \('bride_parents' as const\) : \('groom_parents' as const\)/);
  assert.match(src, /makerSave\(\(\) => addSingleGuest\(eventId, draft\), requestMakerRefresh\)/);
  // …and the new parent's card opens once the list carries it.
  assert.match(src, /setPendingOpen\(r\.guest\.guest_id\)/);
  // A parent opens their OWN card — never a names-only box over a full-row write.
  assert.doesNotMatch(src, /updateGuest|name="first_name"/);
});

test('the Details page links out to edit nothing it can edit in place', () => {
  const src = read('maker-details.tsx');
  assert.doesNotMatch(src, /Edit on Guest list|Add parents on your Guest list|Edit in [A-Z]|Write it ↗/);
  assert.match(src, /<PabuyaMessageEditor eventId=\{eventId\}/, 'the thank-you is typed where it prints');
  // Part 2b: the special message is its OWN component (Details › Words, and the
  // stage's tap), drawn under its print switch as the same node.
  assert.match(src, /name="inc_special_message"[^>]*>[^<]*?\{facts\['special-message'\]\}\s*<\/Toggle>/, 'the special message is typed where it prints');
  assert.match(src, /'special-message': \(\s*<SpecialMessageField\b/, 'the special message editor is the shared one');
  assert.match(read('special-message-field.tsx'), /<form action=\{action\} data-details-special=""/, 'the special message posts its one writer');
  assert.match(src, /<ParentCards eventId=\{eventId\} parents=\{parents\} \/>/);
});
