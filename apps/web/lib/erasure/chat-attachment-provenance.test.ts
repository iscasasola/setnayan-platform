/**
 * Erasure deletes a chat file only when the leaving person SENT IT FIRST
 * (lib/erasure/chat-attachment-provenance.ts). Behavioural: the real planner,
 * the real scope builder, rows shaped exactly as the lookup reads them.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatAttachmentScope } from '@/lib/cleanup-delete-scope';
import {
  canonicalChatRef,
  chatAttachmentIsSubjectsOwn,
  type ChatAttachmentRow,
} from '@/lib/erasure/chat-attachment-provenance';

const THREAD = '2d000000-0000-4000-8000-000000000001';
const SUBJECT = '2a000000-0000-4000-8000-000000000001';
const PARTNER = '2a000000-0000-4000-8000-000000000002';
const scope = chatAttachmentScope(THREAD);
const FILE = `r2://setnayan-thread-files/chat/${THREAD}/0b6c-contract.pdf`;
const OTHER_FILE = `r2://setnayan-thread-files/chat/${THREAD}/77aa-menu.pdf`;

const row = (ref: string | null, sender: string | null, at: string | Date | null): ChatAttachmentRow => ({
  attachment_r2_key: ref,
  sender_user_id: sender,
  created_at: at,
});

test('the subject’s own file — the only message carrying it is theirs — may be deleted', () => {
  const v = chatAttachmentIsSubjectsOwn(FILE, scope, [row(FILE, SUBJECT, '2026-09-01T10:00:00.000Z')], SUBJECT);
  assert.deepEqual(v, { ok: true });
});

test('THE REVIEW’S EXPLOIT: a copy of the partner’s file on the subject’s own later message is REFUSED', () => {
  const v = chatAttachmentIsSubjectsOwn(
    FILE,
    scope,
    [row(FILE, PARTNER, '2026-09-01T10:00:00.000Z'), row(FILE, SUBJECT, '2026-09-02T10:00:00.000Z')],
    SUBJECT,
  );
  assert.deepEqual(v, { ok: false, reason: 'first_sent_by_someone_else' });
});

test('a PADDED copy is compared as the object it names, not as its spelling — still REFUSED', () => {
  // planCleanupDelete trims, so `…pdf ` deletes `…pdf`. A string comparison would
  // find the subject "first" to their own spelling and delete the partner's file.
  for (const padded of [`${FILE} `, `${FILE}\n`, `${FILE}\t `]) {
    assert.equal(canonicalChatRef(padded, scope), FILE, 'precondition: the planner resolves the padding away');
    const v = chatAttachmentIsSubjectsOwn(
      padded,
      scope,
      [row(FILE, PARTNER, '2026-09-01T10:00:00.000Z'), row(padded, SUBJECT, '2026-09-02T10:00:00.000Z')],
      SUBJECT,
    );
    assert.deepEqual(v, { ok: false, reason: 'first_sent_by_someone_else' }, JSON.stringify(padded));
  }
});

test('the subject sent it first and the partner copied it later — the subject’s erasure still deletes it', () => {
  const v = chatAttachmentIsSubjectsOwn(
    FILE,
    scope,
    [row(FILE, PARTNER, new Date('2026-09-03T10:00:00.000Z')), row(FILE, SUBJECT, new Date('2026-09-01T10:00:00.000Z'))],
    SUBJECT,
  );
  assert.deepEqual(v, { ok: true }, 'a later copy must not let anyone pin another person’s file into existence');
});

test('a TIE with anyone else at the earliest instant is REFUSED — the direction that keeps the file', () => {
  const at = '2026-09-01T10:00:00.000Z';
  assert.deepEqual(
    chatAttachmentIsSubjectsOwn(FILE, scope, [row(FILE, SUBJECT, at), row(FILE, PARTNER, at)], SUBJECT),
    { ok: false, reason: 'first_sent_by_someone_else' },
  );
});

test('an earliest message with NO author (an account already erased) is not the subject’s — REFUSED', () => {
  assert.deepEqual(
    chatAttachmentIsSubjectsOwn(
      FILE,
      scope,
      [row(FILE, null, '2026-09-01T10:00:00.000Z'), row(FILE, SUBJECT, '2026-09-02T10:00:00.000Z')],
      SUBJECT,
    ),
    { ok: false, reason: 'first_sent_by_someone_else' },
  );
});

test('no row names the object, or a matching row has no readable time — no provenance, REFUSED', () => {
  assert.deepEqual(chatAttachmentIsSubjectsOwn(FILE, scope, [], SUBJECT), { ok: false, reason: 'no_provenance' });
  assert.deepEqual(
    chatAttachmentIsSubjectsOwn(FILE, scope, [row(OTHER_FILE, SUBJECT, '2026-09-01T10:00:00.000Z')], SUBJECT),
    { ok: false, reason: 'no_provenance' },
    'a row naming a DIFFERENT object is not provenance for this one',
  );
  for (const bad of [null, '', 'not a time']) {
    assert.deepEqual(
      chatAttachmentIsSubjectsOwn(FILE, scope, [row(FILE, SUBJECT, '2026-09-02T10:00:00.000Z'), row(FILE, PARTNER, bad)], SUBJECT),
      { ok: false, reason: 'no_provenance' },
      `created_at ${JSON.stringify(bad)} could be the first message`,
    );
  }
});

test('rows naming other objects are ignored; a ref outside the thread folder is out of scope', () => {
  assert.deepEqual(
    chatAttachmentIsSubjectsOwn(
      FILE,
      scope,
      [row(OTHER_FILE, PARTNER, '2026-08-01T10:00:00.000Z'), row(FILE, SUBJECT, '2026-09-01T10:00:00.000Z')],
      SUBJECT,
    ),
    { ok: true },
  );
  assert.deepEqual(
    chatAttachmentIsSubjectsOwn(
      'r2://setnayan-thread-files/chat/2d000000-0000-4000-8000-000000000099/a.pdf',
      scope,
      [row('r2://setnayan-thread-files/chat/2d000000-0000-4000-8000-000000000099/a.pdf', SUBJECT, '2026-09-01T10:00:00.000Z')],
      SUBJECT,
    ),
    { ok: false, reason: 'out_of_scope' },
  );
});
