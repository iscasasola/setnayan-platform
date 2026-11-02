/**
 * ✉ A GUEST IS ASKED ONLY ABOUT THE INVITATION'S CHAPTERS (owner 2026-11-01: *"Rsvp will depend on what chapters we
 * make."* — corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3 "Only chapters on the invitation are replied to", Step 5).
 *
 * Held as a PROPERTY, at every layer a chapter passes through on its way to a guest:
 *   1 · the rule — `guestInvitedTo` / `invitationChapters`: a top-level block with "On the invitation" on, nothing else
 *       (a private chapter, a moment wrongly flagged, are out);
 *   2 · the server read — `readInvitationChapters` against an in-memory table that REALLY filters: a private chapter
 *       and a coordinator's staged one never come back;
 *   3 · the card — "Which part can't you make?" offers exactly the invitation's chapters;
 *   4 · the write — `resolveChapterReply` answers exactly the invitation's chapters, and a crafted tick for any other
 *       block (a private chapter, a moment) is dropped, never stored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { guestInvitedTo, invitationChapters, resolveChapterReply } from './invitation-chapters';
import { AFTER_PARTY, BLOCKS, CEREMONY, EVENT, PREP_BRIDE, RECEPTION, STAGED, allowServerOnly, fakeAdmin } from './invitation-chapters.fixture';
import { cantTicks, renderReplyCard } from './invitation-chapters-card.fixture';

allowServerOnly();

const INVITED = [CEREMONY, RECEPTION, AFTER_PARTY];

test('1 · the rule: only a top-level block with On the invitation on', () => {
  assert.equal(guestInvitedTo({ on_invitation: true, parent_block_id: null }), true);
  assert.equal(guestInvitedTo({ on_invitation: false, parent_block_id: null }), false, 'a private chapter');
  assert.equal(guestInvitedTo({ on_invitation: true, parent_block_id: CEREMONY }), false, 'a moment is never replied to');
  const ids = invitationChapters(BLOCKS.filter((b) => b.block_id !== STAGED) as never).map((c) => c.block_id);
  assert.deepEqual(ids.sort(), [...INVITED].sort());
  assert.ok(!ids.includes(PREP_BRIDE));
});

test('2 · the server read returns only the invitation’s chapters (rows, not source)', async () => {
  const { readInvitationChapters } = await import('./invitation-chapters.server');
  const got = await readInvitationChapters(fakeAdmin(), EVENT);
  assert.ok(got, 'the read answered');
  assert.deepEqual(got!.map((c) => c.block_id).sort(), [...INVITED].sort());
  assert.ok(!got!.some((c) => c.block_id === STAGED), 'a coordinator’s staged chapter is not a guest’s');
  assert.ok(!got!.some((c) => c.block_id === PREP_BRIDE), 'a private chapter is not on the invitation');
});

test('3 · the card offers "Which part can’t you make?" for exactly the invitation’s chapters', async () => {
  const chapters = invitationChapters(BLOCKS.filter((b) => b.block_id !== STAGED) as never);
  const html = await renderReplyCard({ chapters });
  assert.match(html, /Which part can’t you make\?/);
  assert.deepEqual(cantTicks(html).sort(), [...INVITED].sort());
  assert.doesNotMatch(html, /Preparation · Bride/, 'a private chapter is never named to a guest');
  // One chapter: "I can't make it" already says which — no tick list.
  const one = await renderReplyCard({ chapters: chapters.slice(0, 1) });
  assert.deepEqual(cantTicks(one), []);
  // No chapters: the card as it always was.
  const none = await renderReplyCard({ chapters: [] });
  assert.doesNotMatch(none, /data-rsvp-chapters|cant_chapter/);
});

test('4 · the write answers only the invitation’s chapters; a crafted tick for another block is dropped', () => {
  const chapters = INVITED.map((block_id) => ({ block_id }));
  const yes = resolveChapterReply('attending', [PREP_BRIDE], chapters);
  assert.equal(yes.status, 'attending');
  assert.deepEqual(yes.replies.map((r) => r.block_id).sort(), [...INVITED].sort());
  assert.ok(yes.replies.every((r) => r.attending), 'Yes is one tap: every chapter');

  const partial = resolveChapterReply('declined', [RECEPTION, PREP_BRIDE, 'm-procession'], chapters);
  assert.equal(partial.status, 'attending', 'can’t make SOME = coming to the rest');
  assert.deepEqual(partial.replies.map((r) => r.block_id).sort(), [...INVITED].sort(), 'no row for a block not on the invitation');
  assert.deepEqual(
    partial.replies.filter((r) => !r.attending).map((r) => r.block_id),
    [RECEPTION],
  );

  const onlyStrays = resolveChapterReply('declined', [PREP_BRIDE], chapters);
  assert.equal(onlyStrays.status, 'declined', 'a tick for a chapter not on the invitation narrows nothing');
  assert.ok(onlyStrays.replies.every((r) => !r.attending));

  const all = resolveChapterReply('declined', INVITED, chapters);
  assert.equal(all.status, 'declined');
});
