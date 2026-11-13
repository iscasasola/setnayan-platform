/**
 * samahan-message-id.test.ts — ONE SEND PER MESSAGE in the group chat (walk 13 Nov 2026, F-W3-12) and the composer rule
 * (Enter sends · Shift+Enter is a new line · the box grows · a fresh box after each send).
 *
 * SABOTAGE: the action inserting without `message_id` → RED; a duplicate answered as an error → RED; the composer's
 * Enter not going through `shouldSendOnEnter` → RED; the box clearing in onSaved instead of at send → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDuplicateSend, postedSamahanMessageId } from '@/lib/samahan-message-id';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the posted id is a UUID or nothing; a duplicate is unique_violation', () => {
  assert.equal(postedSamahanMessageId('3F2504E0-4F89-11D3-9A0C-0305E82C3301'), '3f2504e0-4f89-11d3-9a0c-0305e82c3301');
  assert.equal(postedSamahanMessageId('nope'), null);
  assert.equal(postedSamahanMessageId(null), null);
  assert.ok(isDuplicateSend('23505'));
  assert.ok(!isDuplicateSend('42501'));
});

test('the action writes the composer’s id and answers a duplicate as sent', () => {
  const a = code('app/dashboard/(account)/samahan/actions.ts');
  const body = a.slice(a.indexOf('export async function postSamahanMessage'), a.indexOf('export async function deleteSamahanMessage'));
  assert.match(body, /message_id: messageId/);
  assert.match(body, /if \(error && isDuplicateSend\(error\.code\)\) redirect\(back\);/);
});

test('the composer: the shared Enter rule, one send in flight, a fresh box at send, a growing box', () => {
  const c = code('app/dashboard/(account)/samahan/[communityId]/_components/group-composer.tsx');
  assert.match(c, /shouldSendOnEnter\(e\.nativeEvent/);
  assert.match(c, /<textarea/);
  assert.match(c, /if \(stay\.pending \|\| !text\.trim\(\)\) \{\s*e\.preventDefault\(\);\s*return;/);
  assert.match(c, /stay\.onSubmit\(e\);\s*setText\(''\);/, 'the box must empty the moment the message leaves');
  assert.match(c, /name=\{SAMAHAN_MESSAGE_ID_FIELD\}/);
  assert.match(code('app/dashboard/(account)/samahan/[communityId]/_components/group-chatroom.tsx'), /<GroupComposer communityId=\{communityId\} \/>/);
});

test('F-W3-11 · the group’s "Ask someone from People" opens People ready to pick', () => {
  assert.match(code('app/dashboard/(account)/samahan/[communityId]/page.tsx'), /\/dashboard\?seg=people&ask=\$\{encodeURIComponent\(communityId\)\}/);
  assert.match(code('app/dashboard/(account)/people/_components/people-roster-view.tsx'), /useState\(Boolean\(askInto\)\)/);
  assert.match(code('app/dashboard/(launcher)/page.tsx'), /ask: one\('ask'\)/);
});
