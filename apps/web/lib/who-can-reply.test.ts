import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWhoCanRsvp, resolveRsvpAsk } from './rsvp-ask';
import { WHO_CAN_REPLY_CHOICES, whoCanReplyBase, whoCanReplyPatch } from './who-can-reply';

const none = { read: 'ok', drafted: false } as const;

test('asks a host whose event has never answered — live and draft both silent', () => {
  assert.deepEqual(whoCanReplyBase({ isHost: true, liveMeasured: true, live: null, draft: none }), {});
  assert.deepEqual(
    whoCanReplyBase({ isHost: true, liveMeasured: true, live: { meal: false }, draft: none }),
    { meal: false },
  );
});

test('an answer anywhere ends the question — live or drafted, either value', () => {
  for (const v of ['guest_list', 'anyone']) {
    assert.equal(whoCanReplyBase({ isHost: true, liveMeasured: true, live: { whoCanRsvp: v }, draft: none }), null);
    assert.equal(
      whoCanReplyBase({ isHost: true, liveMeasured: true, live: {}, draft: { read: 'ok', drafted: true, value: { whoCanRsvp: v } } }),
      null,
    );
  }
});

test('never asks when it cannot know — a refused read is not "unanswered"', () => {
  assert.equal(whoCanReplyBase({ isHost: true, liveMeasured: false, live: null, draft: none }), null);
  assert.equal(whoCanReplyBase({ isHost: true, liveMeasured: true, live: null, draft: { read: 'refused' } }), null);
  // …and never a helper: the writer refuses anyone but a host.
  assert.equal(whoCanReplyBase({ isHost: false, liveMeasured: true, live: null, draft: none }), null);
});

test('the post keeps every drafted RSVP switch — never the one key alone', () => {
  const base = whoCanReplyBase({
    isHost: true,
    liveMeasured: true,
    live: { dietary: true },
    draft: { read: 'ok', drafted: true, value: { meal: false, song_request: false } },
  });
  assert.ok(base, 'should ask');
  const posted = whoCanReplyPatch(base, 'anyone');
  assert.equal(readWhoCanRsvp(posted), 'anyone');
  assert.equal(resolveRsvpAsk(posted).meal, false, 'a drafted switch was reset by the pop-up');
  assert.equal(resolveRsvpAsk(posted).song_request, false, 'a drafted switch was reset by the pop-up');
});

test('two answers, named by the rules, one per stored value', () => {
  assert.deepEqual(
    WHO_CAN_REPLY_CHOICES.map((c) => c.label),
    ['List only', 'Accept'],
  );
  assert.deepEqual(WHO_CAN_REPLY_CHOICES.map((c) => c.value), ['guest_list', 'anyone']);
});
