/**
 * the-cover-never-asks-into-a-shut-window.test.ts — "Confirm attendance" is never drawn while replies are shut, for ANY
 * reader (walk 13 Nov 2026, F-W3-25: a guest tapped it and the reply page said "Replies are not open yet" — a dead end).
 *
 * SABOTAGE: drop the window check from `coverRsvpOf`'s visitor path → RED; stop passing `window: repliesWindow` on the
 * page's stranger path → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverRsvpOf } from '@/lib/cover-rsvp';
import { OPEN_REPLY_WINDOW } from '@/lib/reply-window';
import { stripComments } from '@/lib/strip-comments';

test('a visitor gets the window’s line when replies are not open, the button when they are', () => {
  const notYet = coverRsvpOf({ card: null, visitorHref: '/x/invite/reply', window: { state: 'not_yet', reason: 'invitation_not_open', opensOn: null, closesOn: null } });
  assert.equal(notYet?.kind, 'not_yet');
  assert.ok(notYet && 'line' in notYet && /not open/i.test(notYet.line));
  const closed = coverRsvpOf({ card: null, visitorHref: '/x/invite/reply', window: { state: 'closed', reason: 'closed_by_couple', opensOn: null, closesOn: null } });
  assert.equal(closed?.kind, 'closed');
  const open = coverRsvpOf({ card: null, visitorHref: '/x/invite/reply', window: OPEN_REPLY_WINDOW });
  assert.deepEqual(open, { kind: 'ask', href: '/x/invite/reply' });
  // The Maker's canvas hands no window: open, as before.
  assert.equal(coverRsvpOf({ card: null, visitorHref: '/x/invite/reply' })?.kind, 'ask');
});

test('the page’s stranger path hands the window in', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(src, /coverRsvpOf\(\{ card: null, visitorHref: replyDoor, window: repliesWindow/);
});

test('one picked date is the date on the create-event door too (F-W3-30)', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/dashboard/(account)/create-event/actions.ts'), 'utf8'));
  assert.match(src, /const pickedDate = singlePickedDate\(event_type, capture\.dateCandidates\);/);
  assert.match(src, /event_date: pickedDate,/);
  assert.match(src, /date_candidates: pickedDate \|\| !capture\.dateCandidates\.length \? null : capture\.dateCandidates,/);
  const comm = stripComments(readFileSync(join(import.meta.dirname, 'communities.ts'), 'utf8'));
  assert.match(comm, /\.map\(\(e\) => withPickedDate\(e\)\)/, 'a Group’s event card must read an old one-pick event’s day');
});
