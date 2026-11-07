/**
 * push-levels.test.ts — EVERY NOTIFICATION TYPE HAS ONE LEVEL, AND THE QUIET HOURS HOLD.
 *
 * Owner, 2026-10-31: "Yes, add them" — Urgent · Normal · Low, quiet hours 10 pm to
 * 7 am Asia/Manila, one list, every push goes through it.
 *   1 · every member of the NotificationType union has a level, and no stray key;
 *   2 · URGENT ignores quiet hours;
 *   3 · NORMAL sends by day and is HELD in quiet hours, at the exact edges;
 *   4 · LOW never buzzes, day or night;
 *   5 · the owner's own examples sit at the levels he named;
 *   6 · the windows: the release reads exactly last night's quiet hours, the summary
 *       only opens 7 pm to 10 pm.
 *
 * SABOTAGE (each seen red, then restored): deleted one type from the list (1) ·
 * urgent → hold in quiet hours (2) · normal → always send (3) · low → send (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  PUSH_LEVEL,
  eveningSummaryOpen,
  eveningSummarySentence,
  isQuietHours,
  lastQuietWindow,
  morningReleaseOpen,
  pushDecision,
  typesAtLevel,
} from './push-levels';

/** An instant given as a Manila wall clock (UTC+8). */
const manila = (day: number, h: number, m = 0) => Date.UTC(2026, 9, day, h - 8, m);
const NIGHT = [manila(31, 22), manila(31, 23, 59), manila(31, 3), manila(31, 6, 59)];
const DAY = [manila(31, 7), manila(31, 12), manila(31, 21, 59)];

test('1 · every NotificationType has a level, and nothing else does', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib', 'notifications.ts'), 'utf8'));
  const at = src.indexOf('export type NotificationType');
  assert.ok(at > -1, 'the union moved — this guard is blind');
  const union = [...src.slice(at, src.indexOf(';', at)).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!).sort();
  assert.ok(union.length >= 100, `the union parsed as ${union.length} types`);
  assert.deepEqual(Object.keys(PUSH_LEVEL).sort(), union, 'a type has no level, or a level has no type');
  for (const v of Object.values(PUSH_LEVEL)) assert.ok(['urgent', 'normal', 'low'].includes(v));
});

test('2 · urgent ignores quiet hours', () => {
  assert.ok(typesAtLevel('urgent').length >= 5);
  for (const t of typesAtLevel('urgent')) {
    for (const at of [...NIGHT, ...DAY]) assert.equal(pushDecision(t, at), 'send', `${t} did not buzz`);
  }
});

test('3 · normal sends by day and is held in quiet hours — at the exact edges', () => {
  assert.ok(typesAtLevel('normal').length >= 5);
  for (const t of typesAtLevel('normal')) {
    for (const at of NIGHT) assert.equal(pushDecision(t, at), 'hold', `${t} buzzed in quiet hours`);
    for (const at of DAY) assert.equal(pushDecision(t, at), 'send', `${t} was held by day`);
  }
});

test('4 · low never buzzes', () => {
  assert.ok(typesAtLevel('low').length >= 5);
  for (const t of typesAtLevel('low')) {
    for (const at of [...NIGHT, ...DAY]) assert.equal(pushDecision(t, at), 'bell-only', `${t} buzzed`);
  }
});

test('5 · the owner\'s examples sit where he put them', () => {
  for (const t of ['payment_matched', 'payment_rejected', 'security_alert', 'booking_cancelled', 'schedule_shifted'] as const) {
    assert.equal(PUSH_LEVEL[t], 'urgent', t);
  }
  for (const t of ['rsvp_received', 'chat_message', 'vendor_inquiry_received', 'order_quoted', 'quote_accepted', 'booking_confirmed'] as const) {
    assert.equal(PUSH_LEVEL[t], 'normal', t);
  }
  for (const t of ['mood_board_changed', 'mood_board_share', 'vendor_feature_suggested', 'review_received', 'couple_photo_shared'] as const) {
    assert.equal(PUSH_LEVEL[t], 'low', t);
  }
});

test('6 · the windows', () => {
  assert.ok(isQuietHours(manila(31, 22)) && !isQuietHours(manila(31, 7)));
  const w = lastQuietWindow(manila(31, 7, 5));
  assert.deepEqual(w, { startMs: manila(30, 22), endMs: manila(31, 7) });
  assert.deepEqual(lastQuietWindow(manila(31, 18)), w, 'a late release must read the same night');
  assert.ok(morningReleaseOpen(manila(31, 7)) && !morningReleaseOpen(manila(31, 6, 59)) && !morningReleaseOpen(manila(31, 22)));
  assert.ok(eveningSummaryOpen(manila(31, 19)) && eveningSummaryOpen(manila(31, 21, 59)));
  assert.ok(!eveningSummaryOpen(manila(31, 18, 59)) && !eveningSummaryOpen(manila(31, 22)));
  assert.equal(eveningSummarySentence({ count: 3, events: 1 }), 'Today on your event: 3 updates');
  assert.equal(eveningSummarySentence({ count: 1, events: 1 }), 'Today on your event: 1 update');
  assert.equal(eveningSummarySentence({ count: 4, events: 2 }), 'Today on your events: 4 updates');
});
