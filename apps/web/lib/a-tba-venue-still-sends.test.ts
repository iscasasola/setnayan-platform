/**
 * ✉ A TBA VENUE STILL SENDS (owner 2026-11-01: *"If a chapter still doesnt have a venue, how can they send the rsvp?
 * Sometime it can be tba"* — plan §3 TBA: "The RSVP still sends, as 'Reception · Venue TBA'").
 *
 * A chapter with no venue is on the invitation, read for the guest, named on the card as "Venue TBA", offered in
 * "Which part can't you make?", and answered by the write — at every layer, by rows and by markup. A Time-TBA chapter
 * says "Time TBA", never a guessed 12:00 AM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { chapterWhen, chapterWhere, invitationChapters, resolveChapterReply, VENUE_TBA } from './invitation-chapters';
import { AFTER_PARTY, BLOCKS, EVENT, RECEPTION, STAGED, allowServerOnly, fakeAdmin } from './invitation-chapters.fixture';
import { cantTicks, renderReplyCard } from './invitation-chapters-card.fixture';

allowServerOnly();

const chapters = () => invitationChapters(BLOCKS.filter((b) => b.block_id !== STAGED) as never);

test('1 · a chapter with no venue stays on the invitation, said as Venue TBA', () => {
  const reception = chapters().find((c) => c.block_id === RECEPTION);
  assert.ok(reception, 'Reception (no venue) is on the invitation');
  assert.equal(chapterWhere(reception!), VENUE_TBA);
  const blank = invitationChapters([{ block_id: 'x', label: 'Dinner', start_at: '2026-12-18T19:00:00.000Z', location: '   ', on_invitation: true }]);
  assert.equal(blank.length, 1, 'a blank-space venue is no venue — still invited');
  assert.equal(chapterWhere(blank[0]!), VENUE_TBA);
});

test('2 · the server read returns the no-venue chapter', async () => {
  const { readInvitationChapters } = await import('./invitation-chapters.server');
  const got = await readInvitationChapters(fakeAdmin(), EVENT);
  assert.ok(got?.some((c) => c.block_id === RECEPTION && c.location === null));
});

test('3 · the card names it "Venue TBA" and offers it; a Time-TBA chapter is never 12:00 AM', async () => {
  const html = await renderReplyCard({ chapters: chapters() });
  assert.match(html, /Reception<\/span><span[^>]*>· <span data-chapter-when="">[^<]*<\/span> · <span data-chapter-where="">Venue TBA<\/span>/);
  assert.ok(cantTicks(html).includes(RECEPTION));
  const after = chapters().find((c) => c.block_id === AFTER_PARTY)!;
  assert.equal(chapterWhen(after), 'Time TBA');
  assert.doesNotMatch(html, /12:00\s?AM/);
});

test('4 · the reply is written for the no-venue chapter, yes or no', () => {
  const cs = chapters();
  const yes = resolveChapterReply('attending', [], cs);
  assert.ok(yes.replies.some((r) => r.block_id === RECEPTION && r.attending));
  const notThat = resolveChapterReply('declined', [RECEPTION], cs);
  assert.equal(notThat.status, 'attending');
  assert.ok(notThat.replies.some((r) => r.block_id === RECEPTION && !r.attending));
});
