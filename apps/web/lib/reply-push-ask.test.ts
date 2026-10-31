/**
 * reply-push-ask.test.ts — GUESTS ASKS "GET A NOTICE ON THIS PHONE WHEN GUESTS
 * REPLY?" ONCE, AND ONLY WHERE A YES CAN WORK.
 *
 * Runs the pure decision (`lib/reply-push-ask.ts`) the sheet calls on the device:
 *   1 · a list with no reply is never asked;
 *   2 · an answer (Yes OR Not now) silences it for 30 days, then it may ask again;
 *   3 · never inside the iPhone app (the native ask owns that moment);
 *   4 · a subscribed device, a blocked one, or a browser without Web Push is not asked;
 *   5 · iPhone Safari in a tab is TOLD how (Home Screen), never offered a dead Yes;
 *   6 · the remembered answer survives a blocked storage without throwing.
 *
 * SABOTAGE (each seen red, then restored): `<` → `<=` on the 30 days and back ·
 * removed the storeShell branch (3 red) · removed the subscribed branch (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPLY_ASK_COPY,
  REPLY_ASK_REASK_MS,
  readLastAnswer,
  rememberAnswer,
  replyAskMode,
  type ReplyAskInput,
} from './reply-push-ask';

const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const base: ReplyAskInput = {
  replied: 3,
  storeShell: false,
  supported: true,
  iosOutsideHomeScreen: false,
  permission: 'default',
  subscribed: false,
  lastAnsweredAtMs: null,
  nowMs: NOW,
};

test('the ordinary case asks', () => {
  assert.equal(replyAskMode(base), 'ask');
});

test('1 · a list with no reply is never asked', () => {
  assert.equal(replyAskMode({ ...base, replied: 0 }), null);
});

test('2 · an answer silences it for 30 days, then it may ask again', () => {
  assert.equal(replyAskMode({ ...base, lastAnsweredAtMs: NOW - DAY }), null);
  assert.equal(replyAskMode({ ...base, lastAnsweredAtMs: NOW - 29 * DAY }), null);
  assert.equal(replyAskMode({ ...base, lastAnsweredAtMs: NOW - REPLY_ASK_REASK_MS }), 'ask');
  assert.equal(REPLY_ASK_REASK_MS, 30 * DAY);
});

test('3 · never inside the iPhone app', () => {
  assert.equal(replyAskMode({ ...base, storeShell: true }), null);
  assert.equal(replyAskMode({ ...base, storeShell: true, iosOutsideHomeScreen: true }), null);
});

test('4 · subscribed, blocked, or no Web Push → not asked', () => {
  assert.equal(replyAskMode({ ...base, subscribed: true }), null);
  assert.equal(replyAskMode({ ...base, permission: 'denied' }), null);
  assert.equal(replyAskMode({ ...base, supported: false }), null);
  assert.equal(replyAskMode({ ...base, permission: 'unsupported' }), null);
});

test('5 · iPhone Safari in a tab is told how, never offered a dead Yes', () => {
  assert.equal(replyAskMode({ ...base, supported: false, iosOutsideHomeScreen: true }), 'ios-home-screen');
  // …and it is still once: answered → quiet for 30 days.
  assert.equal(replyAskMode({ ...base, supported: false, iosOutsideHomeScreen: true, lastAnsweredAtMs: NOW - DAY }), null);
  assert.equal(REPLY_ASK_COPY.iosLine, 'On iPhone, add Setnayan to your Home Screen to get these');
  assert.match(REPLY_ASK_COPY.iosHow, /Add to Home Screen/);
});

test('6 · the remembered answer round-trips, and a blocked storage never throws', () => {
  const box = new Map<string, string>();
  const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
  assert.equal(readLastAnswer(storage), null);
  rememberAnswer(storage, NOW);
  assert.equal(readLastAnswer(storage), NOW);
  const blocked = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(readLastAnswer(blocked), null);
  assert.doesNotThrow(() => rememberAnswer(blocked, NOW));
  assert.equal(readLastAnswer(null), null);
});
