/**
 * rsvp-push-count.test.ts — THE RSVP NOTICE COUNTS THE HOST'S UNREAD REPLIES.
 *
 * Owner, 2026-10-31: "Maria replied", then "Maria + 1 other replied", then "Maria
 * + 5 others replied" — what is unread since the host last opened Guests or the
 * bell. Runs the pure count (`lib/rsvp-push-count.ts`) and the template's sentence:
 *   1 · one unread reply → "Maria replied", tap opens her card;
 *   2 · two guests → "+ 1 other", tap opens the list;
 *   3 · six guests → "+ 5 others", the NEWEST guest named;
 *   4 · one guest twice (a reply, then a meal change) is one person;
 *   5 · nothing unread → no notice;
 *   6 · "· 34 coming so far" through formatCount, left out when unknown.
 *
 * SABOTAGE (seen red, then restored): counted rows instead of guests (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rsvpPushFacts, type UnreadReplyRow } from './rsvp-push-count';
import { rsvpSentence } from './push-message';

const EV = '11111111-2222-4333-8444-555555555555';
const at = (m: number) => new Date(Date.parse('2026-10-31T10:00:00Z') + m * 60000).toISOString();
const r = (name: string, guest: string, m: number, how = "RSVP'd: attending"): UnreadReplyRow => ({
  title: `${name} ${how}`,
  related_url: `/dashboard/${EV}/guests/${guest}`,
  created_at: at(m),
});
const say = (rows: UnreadReplyRow[], coming: number | null = null) => {
  const f = rsvpPushFacts(rows, EV, coming);
  return f ? { text: rsvpSentence(f), url: f.url } : null;
};

test('1 · one unread reply → "Maria replied", opens her card', () => {
  assert.deepEqual(say([r('Maria', 'g1', 0)]), { text: 'Maria replied', url: `/dashboard/${EV}/guests/g1` });
});

test('2 · two guests → "+ 1 other", opens the list', () => {
  assert.deepEqual(say([r('Jose', 'g2', 0), r('Maria', 'g1', 1)]), { text: 'Maria + 1 other replied', url: `/dashboard/${EV}/guests` });
});

test('3 · six guests → "+ 5 others", the newest named', () => {
  const rows = ['Ana', 'Ben', 'Cris', 'Dan', 'Eli'].map((n, i) => r(n, `g${i}`, i));
  rows.push(r('Maria', 'gm', 99));
  assert.equal(say(rows)!.text, 'Maria + 5 others replied');
});

test('4 · one guest twice is one person', () => {
  assert.equal(say([r('Maria', 'g1', 0), r('Maria', 'g1', 3, 'updated their details')])!.text, 'Maria replied');
});

test('5 · nothing unread → no notice', () => {
  assert.equal(say([]), null);
});

test('6 · "· 34 coming so far", and nothing when the count is unknown', () => {
  assert.equal(say([r('Maria', 'g1', 0)], 34)!.text, 'Maria replied · 34 coming so far');
  assert.equal(say([r('Maria', 'g1', 0)], 1240)!.text, 'Maria replied · 1,240 coming so far');
  assert.equal(say([r('Maria', 'g1', 0)], null)!.text, 'Maria replied');
});
