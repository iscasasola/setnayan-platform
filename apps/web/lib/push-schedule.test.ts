/**
 * push-schedule.test.ts — WHAT THE 7 AM RELEASE AND THE EVENING SUMMARY SEND.
 *
 * Owner, 2026-10-31: Normal notices "wait and arrive together at 7 am, collapsed
 * per kind"; Low gets "ONE evening summary push a day". Runs the pure plan, and
 * reads the server half for what a plan cannot show:
 *   1 · the release sends one notice per person per collapse key — the latest row;
 *   2 · RSVPs collapse per event and go through the counted RSVP notice;
 *   3 · the summary is one line per person, counting Low rows, opening the bell;
 *   4 · the release reads only Normal rows, the summary only Low, both unread, and
 *       the clock is checked BEFORE the claim (a claim out of window burns the day);
 *   5 · no email anywhere in it.
 *
 * SABOTAGE (seen red, then restored): the release read Low rows (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { planMorningRelease, summaryCounts, summaryUrl, type HeldRow } from './push-schedule';

const EV = '11111111-2222-4333-8444-555555555555';
const row = (over: Partial<HeldRow>): HeldRow => ({
  user_id: 'u1',
  type: 'chat_message',
  title: 'New message from Luz',
  body: 'hi',
  related_url: `/dashboard/${EV}/messages/t1`,
  event_id: EV,
  created_at: '2026-10-30T15:00:00Z',
  ...over,
});

test('1 · one notice per person per collapse key — the latest row', () => {
  const plan = planMorningRelease([
    row({ body: 'first' }),
    row({ body: 'second' }),
    row({ related_url: `/dashboard/${EV}/messages/t2`, body: 'other thread' }),
    row({ user_id: 'u2', body: 'other person' }),
  ]);
  assert.equal(plan.length, 3);
  assert.equal(plan[0]!.row.body, 'second');
});

test('2 · RSVPs collapse per event and use the counted notice', () => {
  const r = (g: string) => row({ type: 'rsvp_received', title: `${g} RSVP'd: attending`, related_url: `/dashboard/${EV}/guests/${g}` });
  const plan = planMorningRelease([r('a'), r('b'), r('c')]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.rsvpEventId, EV);
});

test('3 · the summary is one line per person, opening the bell', () => {
  const people = summaryCounts([
    row({ type: 'mood_board_changed' }),
    row({ type: 'review_received', event_id: null, related_url: '/dashboard/notifications' }),
    row({ user_id: 'v', type: 'review_received', event_id: null, related_url: '/vendor-dashboard/reviews' }),
  ]);
  const u1 = people.find((p) => p.userId === 'u1')!;
  assert.deepEqual({ count: u1.count, events: u1.eventIds, vendor: u1.vendorSide }, { count: 2, events: [EV], vendor: false });
  const v = people.find((p) => p.userId === 'v')!;
  assert.ok(v.vendorSide);
  assert.equal(summaryUrl(false), '/dashboard/notifications');
  assert.equal(summaryUrl(true), '/vendor-dashboard/notifications');
});

test('4 · the right rows, and the clock before the claim', () => {
  const s = stripComments(readFileSync(join(process.cwd(), 'lib', 'push-schedule.server.ts'), 'utf8'));
  assert.match(s, /runMorningRelease[\s\S]*?typesAtLevel\('normal'\)/);
  assert.match(s, /runEveningSummary[\s\S]*?typesAtLevel\('low'\)/);
  assert.match(s, /\.is\('read_at', null\)/, 'a notice already read in the bell would be pushed');
  assert.match(s, /if \(morningReleaseOpen\(nowMs\)\) \{\s*await runClaimedJob\('push-morning-release'/);
  assert.match(s, /if \(eveningSummaryOpen\(nowMs\)\) \{\s*await runClaimedJob\('push-evening-summary'/);
  assert.match(s, /collapseKey: 'summary:today'/);
});

test('5 · no email in it', () => {
  const s = stripComments(readFileSync(join(process.cwd(), 'lib', 'push-schedule.server.ts'), 'utf8'));
  assert.ok(!/sendEmail|recordDelivery|emitNotification/.test(s));
});
