/**
 * "WHO CAN RSVP?" IS ONE STORED VALUE (owner 2026-09-26/27, guest pathway brief
 * item 4). It lives as a key in `events.rsvp_ask_config` — no new column — and
 * every place that shows or enforces it reads it through `readWhoCanRsvp`.
 *
 * What this file holds:
 *   · the default (absent / malformed) is Only my Guest List — nobody without a
 *     key can ask until the couple opens the door;
 *   · the sanitizer the Maker's draft path runs (lib/hub-draft.ts) KEEPS the
 *     two page-level keys, so saving one of the six question switches can
 *     never silently reset "Who can RSVP?";
 *   · `oneAtATime` defaults OFF;
 *   · the reply-by date: the couple's own deadline always wins; only an unset
 *     one falls back to 30 days before the event.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anyoneMayAskToJoin,
  readOneAtATime,
  readWhoCanRsvp,
  resolveReplyBy,
  resolveRsvpAsk,
  sanitizeRsvpAskConfig,
} from '@/lib/rsvp-ask';
import { sanitizeHubDraftEventValue } from '@/lib/hub-draft';

test('default: absent / null / junk reads as Only my Guest List, and nobody may ask', () => {
  for (const raw of [null, undefined, {}, { whoCanRsvp: 'everyone' }, { whoCanRsvp: true }, 'x', []]) {
    assert.equal(readWhoCanRsvp(raw), 'guest_list');
    assert.equal(anyoneMayAskToJoin(raw), false);
  }
});

test('"Anyone, I approve" is the only value that opens the ask-to-join door', () => {
  assert.equal(readWhoCanRsvp({ whoCanRsvp: 'anyone' }), 'anyone');
  assert.equal(anyoneMayAskToJoin({ whoCanRsvp: 'anyone', meal: false }), true);
  assert.equal(anyoneMayAskToJoin({ whoCanRsvp: 'guest_list' }), false);
});

test('the sanitizer keeps both page-level keys beside the six switches', () => {
  const kept = sanitizeRsvpAskConfig({ meal: false, whoCanRsvp: 'anyone', oneAtATime: true, junk: 1 });
  assert.deepEqual(kept, { meal: false, whoCanRsvp: 'anyone', oneAtATime: true });
  // …and drops them when malformed rather than repairing them.
  assert.deepEqual(sanitizeRsvpAskConfig({ whoCanRsvp: 'all', oneAtATime: 'yes' }), {});
});

test('a six-switch save through the draft path does not reset Who can RSVP', () => {
  // What maker-rsvp-ask.tsx posts: the whole local object with one switch changed.
  const local = sanitizeRsvpAskConfig({ whoCanRsvp: 'anyone', oneAtATime: true });
  const patch = { ...local, dietary: false };
  const stored = sanitizeHubDraftEventValue('rsvp_ask_config', patch);
  assert.equal(readWhoCanRsvp(stored), 'anyone');
  assert.equal(readOneAtATime(stored), true);
  // …and the question switches still resolve exactly as before.
  assert.equal(resolveRsvpAsk(stored).dietary, false);
  assert.equal(resolveRsvpAsk(stored).meal, true);
});

test('one question at a time defaults OFF', () => {
  for (const raw of [null, {}, { oneAtATime: 'true' }]) assert.equal(readOneAtATime(raw), false);
  assert.equal(readOneAtATime({ oneAtATime: true }), true);
});

test('reply by: a set deadline always wins and is never replaced by the default', () => {
  assert.deepEqual(resolveReplyBy({ deadline: '2026-11-01', eventDate: '2026-12-18' }), {
    date: '2026-11-01',
    isDefault: false,
  });
});

test('reply by: unset → 30 days before the event, marked as the default', () => {
  assert.deepEqual(resolveReplyBy({ deadline: null, eventDate: '2026-12-18' }), {
    date: '2026-11-18',
    isDefault: true,
  });
  // Across a month + year boundary.
  assert.deepEqual(resolveReplyBy({ deadline: '', eventDate: '2027-01-10' }), {
    date: '2026-12-11',
    isDefault: true,
  });
  assert.equal(resolveReplyBy({ deadline: null, eventDate: null }), null);
});
