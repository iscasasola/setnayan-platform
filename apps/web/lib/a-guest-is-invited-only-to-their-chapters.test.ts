/**
 * ✉ A GUEST IS INVITED ONLY TO THEIR CHAPTERS (owner 2026-11-02, DECISION_LOG "PER-GUEST "INVITED TO" CHAPTERS": *"Invited
 * to yes"* — each guest card gets "Invited to" = the chapters on the invitation, default all, e.g. "after party only";
 * RSVP-by-chapter, counts, Your schedule and seats follow it; a partial invite shows a tag; existing guests keep all).
 *
 * Stored as the exception (`guest_chapter_not_invited`, migration 20271302948959 — its database half is
 * tests/db/guests-invited-to-chapters.db.test.ts). Here, on the REAL code:
 *
 *   1 · the ONE rule (`guestInvitedTo`) takes the guest's set — and with none, the whole invitation (existing guests keep all);
 *   2 · RSVP: a guest is never asked about, nor recorded for, a chapter they were taken off — Yes covers only theirs;
 *   3 · Your schedule draws only their chapters;
 *   4 · the Guest list's tag, and the hosts' per-chapter count line;
 *   5 · seats: off every seated chapter = no seat; anything else = a seat, exactly as before;
 *   6 · every guest-side reader asks for THIS guest's invitation (string guards, so a new reader that forgets goes red).
 *
 * Sabotage (recorded in the PR): drop the `notInvited` test from `guestInvitedTo` → 1, 2, 3 red; read the event-wide
 * chapters in `submitRsvp` again → 6 red; drop the noSeat filter from `guestsOrStop` → 6 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  chapterCountLine,
  chaptersForGuest,
  guestInvitedTo,
  invitationChapters,
  needsNoSeat,
  partialInviteTag,
  resolveChapterReply,
  seatedChapterIds,
} from '@/lib/invitation-chapters';
import { yourSchedule } from '@/lib/guest-your-schedule';
import { chaptersFromBlocks } from '@/lib/schedule-chapters';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ROWS = [
  { block_id: 'cer', parent_block_id: null, label: 'Ceremony', start_at: '2099-12-18T14:00:00Z', on_invitation: true, sort_order: 0 },
  { block_id: 'rec', parent_block_id: null, label: 'Reception', start_at: '2099-12-18T18:00:00Z', on_invitation: true, sort_order: 1 },
  { block_id: 'aft', parent_block_id: null, label: 'After party', start_at: '2099-12-18T23:00:00Z', on_invitation: true, sort_order: 2 },
  { block_id: 'prv', parent_block_id: null, label: 'Family lunch', start_at: '2099-12-18T11:00:00Z', on_invitation: false, sort_order: 3 },
];
const AFTER_PARTY_ONLY = new Set(['cer', 'rec']);

test('1 · the one rule takes the guest’s set — none means the whole invitation (existing guests keep all)', () => {
  assert.equal(guestInvitedTo(ROWS[0]!), true);
  assert.equal(guestInvitedTo(ROWS[0]!, AFTER_PARTY_ONLY), false, 'a guest taken off the Ceremony is still invited to it');
  assert.equal(guestInvitedTo(ROWS[2]!, AFTER_PARTY_ONLY), true);
  assert.equal(guestInvitedTo(ROWS[3]!, new Set()), false, 'a private chapter joined the invitation');
  assert.deepEqual(invitationChapters(ROWS).map((c) => c.block_id), ['cer', 'rec', 'aft']);
  assert.deepEqual(invitationChapters(ROWS, new Set()).map((c) => c.block_id), ['cer', 'rec', 'aft'], 'an untouched guest lost a chapter');
  assert.deepEqual(invitationChapters(ROWS, AFTER_PARTY_ONLY).map((c) => c.block_id), ['aft']);
  const all = invitationChapters(ROWS);
  assert.deepEqual(chaptersForGuest(all, null).map((c) => c.block_id), ['cer', 'rec', 'aft']);
  assert.deepEqual(chaptersForGuest(all, AFTER_PARTY_ONLY).map((c) => c.block_id), ['aft']);
});

test('2 · RSVP: never asked about, never recorded for, a chapter they were taken off', () => {
  const theirs = invitationChapters(ROWS, AFTER_PARTY_ONLY);
  const yes = resolveChapterReply('attending', [], theirs);
  assert.deepEqual(yes.replies, [{ block_id: 'aft', attending: true }], 'Yes answered a chapter they are not invited to');
  // A tick posted for the Ceremony (a stale tab, a crafted form) is ignored — it is not on their invitation.
  const cant = resolveChapterReply('declined', ['cer'], theirs);
  assert.deepEqual(cant, { status: 'declined', replies: [{ block_id: 'aft', attending: false }] });
});

test('3 · Your schedule draws only their chapters', () => {
  const chapters = chaptersFromBlocks(ROWS as unknown as Parameters<typeof chaptersFromBlocks>[0]);
  const base = { chapters, moments: [], tasks: [], released: false, pro: false, guestsArriveBy: '1:30 PM' };
  const everyone = yourSchedule({ ...base, viewer: { guestId: 'g1', roles: ['guest'], groupIds: [] } });
  assert.equal(everyone.kind, 'ok');
  assert.deepEqual(everyone.kind === 'ok' ? everyone.chapters.map((c) => c.name) : [], ['Ceremony', 'Reception', 'After party']);
  const mine = yourSchedule({ ...base, viewer: { guestId: 'g1', roles: ['guest'], groupIds: [], notInvited: ['cer', 'rec'] } });
  assert.deepEqual(mine.kind === 'ok' ? mine.chapters.map((c) => c.name) : [], ['After party'], 'Your schedule showed a part they are not invited to');
});

test('4 · the Guest list’s tag, and the hosts’ count line', () => {
  const all = invitationChapters(ROWS);
  assert.equal(partialInviteTag(all, null), null, 'a guest invited to everything carries a tag');
  assert.equal(partialInviteTag(all, new Set()), null);
  assert.equal(partialInviteTag(all, AFTER_PARTY_ONLY), 'After party only');
  assert.equal(partialInviteTag(all, new Set(['aft'])), 'Not at After party');
  assert.equal(partialInviteTag(all, new Set(['cer', 'rec', 'aft'])), 'Not invited to any part');
  assert.equal(chapterCountLine({ yes: 12, no: 3, yesNames: [] }), '12 said yes · 3 can’t make it');
  assert.equal(chapterCountLine({ yes: 12, no: 3, yesNames: [], notInvited: 4 }), '12 said yes · 3 can’t make it · 4 not invited');
  assert.equal(chapterCountLine({ yes: 12, no: 3, yesNames: [], notInvited: 0 }), '12 said yes · 3 can’t make it');
});

test('5 · seats: off every seated chapter = no seat; anything else = a seat, as before', () => {
  const seated = seatedChapterIds(ROWS.map((r) => ({ ...r, block_type: 'custom' })));
  assert.deepEqual([...seated], ['rec'], 'the Reception, named so, is the seated chapter');
  assert.deepEqual([...seatedChapterIds([{ block_id: 'x', label: 'Salu-salo', block_type: null }])], ['x']);
  assert.deepEqual([...seatedChapterIds([{ block_id: 'y', label: 'Part 2', block_type: 'dinner' }])], ['y']);
  assert.equal(needsNoSeat(seated, AFTER_PARTY_ONLY), true, 'an after-party-only guest was offered a seat');
  assert.equal(needsNoSeat(seated, new Set(['cer'])), false, 'a reception guest lost their seat');
  assert.equal(needsNoSeat(seated, null), false);
  assert.equal(needsNoSeat(new Set(), AFTER_PARTY_ONLY), false, 'with no seated chapter, nobody may lose a seat');
});

test('6 · every guest-side reader asks for THIS guest’s invitation', () => {
  const actions = read('app/[slug]/actions.ts');
  assert.match(actions, /readInvitationChapters\(chapterAdmin, eventId, guestId\)/, 'the reply reads the whole invitation');
  const one = read('app/[slug]/_lib/chapter-reply.server.ts');
  assert.match(one, /readInvitationChapters\(admin, eventId, guestId\)/, 'one chapter’s answer reads the whole invitation');
  const reply = read('app/[slug]/invite/reply/page.tsx');
  assert.match(reply, /readInvitationChapters\(admin, event\.event_id as string, canvas \? undefined : \(guest\.guest_id as string\)\)/);
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /chaptersForGuest\(invitationChapters, notInvitedHere\)/);
  assert.match(page, /\{\.\.\.siteProps\}\s*invitationChapters=\{guestChapters\}/, 'the guest page draws the event’s whole invitation');
  const sched = read('app/[slug]/_lib/your-schedule.server.ts');
  assert.match(sched, /\.from\('guest_chapter_not_invited'\)\.select\('block_id'\)\.eq\('guest_id', guestId\)/);
  assert.match(sched, /notInvited: \(\(notInvitedRes\.data/);
  // A failed "taken off" read is never "invited to all".
  const server = read('lib/invitation-chapters.server.ts');
  assert.match(server, /if \(error \|\| !data \|\| notInvited === null\) \{/);
  // Seats: the arranging actions' guest list leaves them out; the seat plan does not offer them.
  const inputs = read('lib/seating-inputs.ts');
  assert.match(inputs, /if \(!read\.measured \|\| noSeat === null\) throw new SeatingInputsUnreadError\('guests'\);/);
  assert.match(inputs, /read\.rows\.filter\(\(g\) => !noSeat\.has\(g\.guest_id\)\)/);
  assert.match(read('app/dashboard/[eventId]/seating/page.tsx'), /guestsRead\.rows\.filter\(\(g\) => !noSeat\.has\(g\.guest_id\)\)/);
  // The card writes the exception through the chapter fence, never a chapter id the form made up.
  const card = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  assert.match(card, /async function syncInvitedChapters\(/);
  assert.match(card, /const picked = new Set\(pickedIds\.filter\(\(id\) => ours\.has\(id\)\)\);/);
  assert.match(card, /if \(wantOff\.size >= ours\.size\) return 'invited_to_none';/);
});
