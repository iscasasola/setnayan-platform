/**
 * 🔒 A PRIVATE MESSAGE TO SEVERAL PEOPLE — the words and the lists (DECISION_LOG 2026-11-12 "PRIVATE MESSAGES — TWO
 * DOORS, SEVERAL PEOPLE" · "EVENT GROUP CHATS APPROVED AS DRAWN" (3) a reply goes back to the same people).
 *
 *   1. The words: "Private message to Miguel and Tita Lu" · "Private · only you, Ana and Miguel" — each reader sees the
 *      OTHER people, never their own name.
 *   2. A reply goes to the same people: the sender + the other recipients, never yourself; the newest private line
 *      written TO you names them, your own newest private line clears it.
 *   3. The form: one `private_to` field per person, de-duplicated, malformed values and yourself dropped, at most 50
 *      (the database's own ceiling, CHECK chat_messages_recipients_agree).
 *   4. The store: a face (one) and the ticks (several) land as ONE list; null or [] = everyone again.
 *
 * Sabotage (12 Nov 2026): `privateOtherIds` keeping the viewer → 1 + 2 RED; `latestPrivateReply` skipping the "your own
 * line clears it" return → 2 RED; `privateToListFromForm` without the de-dupe → 3 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  joinNames,
  latestPrivateReply,
  privateBoxPlaceholder,
  privateOtherIds,
  privateReplyIds,
  privateStripLabel,
  privateToListFromForm,
} from './chat-private';
import { readPrivateTo, setPrivateTo } from '@/app/_components/chat/private-to';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

test('1 · the words name the other people, in the house list form', () => {
  assert.equal(joinNames(['Ana']), 'Ana');
  assert.equal(joinNames(['Ana', 'Miguel']), 'Ana and Miguel');
  assert.equal(joinNames(['Ana', 'Miguel', 'Tita Lu']), 'Ana, Miguel and Tita Lu');
  assert.equal(privateBoxPlaceholder(['Miguel', 'Tita Lu']), 'Private message to Miguel and Tita Lu');
  assert.equal(privateBoxPlaceholder('Jose'), 'Private message to Jose');
  assert.equal(privateStripLabel(['Ana', 'Miguel']), 'Private · only you, Ana and Miguel');
  // What each of three people sees on one line from A to B and C.
  const line = { sender_user_id: A, recipient_user_ids: [B, C] };
  assert.deepEqual(privateOtherIds(line, A), [B, C]);
  assert.deepEqual(privateOtherIds(line, B), [A, C]);
  assert.deepEqual(privateOtherIds(line, C), [A, B]);
});

test('2 · a reply goes to the same people; your own newest private line clears it', () => {
  const fromA = { sender_user_id: A, recipient_user_ids: [B, C] };
  assert.deepEqual(privateReplyIds(fromA, B), [A, C]);
  const shared = { sender_user_id: C, recipient_user_ids: null };
  assert.deepEqual(latestPrivateReply([fromA, shared], B), [A, C], 'a shared line after it does not clear the reply');
  const mine = { sender_user_id: B, recipient_user_ids: [A] };
  assert.equal(latestPrivateReply([fromA, mine], B), null, 'your own newest private line already chose');
  assert.equal(latestPrivateReply([shared], B), null);
});

test('3 · the form: one field per person, de-duplicated, never yourself, at most 50', () => {
  assert.deepEqual(privateToListFromForm([B, C, B, 'nope', A], A), [B, C]);
  assert.deepEqual(privateToListFromForm([], A), []);
  const many = Array.from({ length: 60 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  assert.equal(privateToListFromForm(many, null).length, 50);
});

test('4 · the store: a face (one) and the ticks (several) are one list; [] or null = everyone', () => {
  const T = 'thread-several';
  setPrivateTo(T, { userId: B, name: 'Ben' });
  assert.deepEqual(readPrivateTo(T), [{ userId: B, name: 'Ben' }]);
  setPrivateTo(T, [{ userId: B, name: 'Ben' }, { userId: C, name: 'Cid' }, { userId: B, name: 'Ben' }]);
  assert.deepEqual(readPrivateTo(T)?.map((p) => p.userId), [B, C]);
  setPrivateTo(T, []);
  assert.equal(readPrivateTo(T), null);
  setPrivateTo(T, { userId: B, name: 'Ben' });
  setPrivateTo(T, null);
  assert.equal(readPrivateTo(T), null);
});
