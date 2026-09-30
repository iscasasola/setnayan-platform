/**
 * the-first-visit-asks-who-can-reply.test.ts — owner 2026-09-30 (DECISION_LOG
 * "THE FIRST VISIT TO THE GUEST LIST ASKS WHICH KIND OF LIST"): one question,
 * two answers, once per event, BEFORE the Invite tour.
 *
 * The decision itself is executed in `lib/who-can-reply.test.ts`; this holds the
 * page to it — the page asks the pure rule, and the tour waits its turn.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(GUESTS, ...p), 'utf8'));

test('the page asks the one rule, and only a host is asked', () => {
  const page = read('page.tsx');
  assert.match(page, /const whoCanReply = whoCanReplyBase\(\{\s*isHost: viewer\.isCouple,/, 'the page decides who is asked on its own');
  assert.match(page, /liveMeasured: !eventRow\.error,/, 'a refused event read could ask a question that is already answered');
});

test('the Invite tour waits for the question — never both at once', () => {
  const page = read('page.tsx');
  const tours = page.match(/<MiniTour tourKey="customer_guest_invite_v1" \/>/g) ?? [];
  assert.equal(tours.length, 2, 'the Invite tour is mounted somewhere other than beside the question');
  assert.match(
    page,
    /\{whoCanReply \? \(\s*<WhoCanReplyAsk eventId=\{eventId\} base=\{whoCanReply\}>\s*<MiniTour tourKey="customer_guest_invite_v1" \/>\s*<\/WhoCanReplyAsk>\s*\) : \(\s*<MiniTour tourKey="customer_guest_invite_v1" \/>\s*\)\}/,
    'the Invite tour can show while "Who can reply?" is still open',
  );
  const ask = read('_components', 'who-can-reply-ask.tsx');
  assert.match(ask, /if \(phase === 'done'\) return <>\{children\}<\/>;/, 'the pop-up draws the tour before it is closed');
});

test('one question, two big answers, nothing else — no dropdown for two choices', () => {
  const ask = read('_components', 'who-can-reply-ask.tsx');
  assert.match(ask, />\s*Who can reply\?\s*</);
  assert.match(ask, /WHO_CAN_REPLY_CHOICES\.map/);
  assert.doesNotMatch(ask, /PickMenu|<select\b|<p\b[^>]*>(?![^<]*\{error\})/, 'the pop-up grew a dropdown or extra text');
});
