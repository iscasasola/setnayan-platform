/**
 * ⏱ A CHAT TIME READS THE SAME ON EVERY MACHINE (walk 2026-11-01).
 *
 * A chat thread is rendered on the server and hydrated in the browser, so every message time is printed twice, by two
 * machines. When those two strings differ React discards the server's HTML and redraws the thread — on every thread.
 * The walk caught it in WebKit (Safari prints "Oct 26 at 6:05 PM" where Node prints "Oct 26, 6:05 PM"); production's
 * UTC server against a Manila phone made it every browser. `formatChatTimestamp` (lib/chat.ts) now builds the string
 * from fixed parts in the product's zone.
 *
 * THE PROPERTY: the output depends on the instant and on "now" — never on the machine's own zone or its locale data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatChatTimestamp } from './chat';

const ZONES = ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati', 'Europe/London'];

function underTz<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

const NOW = Date.parse('2026-10-30T04:00:00Z'); // 12:00 PM, Oct 30 in Manila
const SAMPLES = [
  '2026-10-30T01:05:00Z', // same Manila day, morning
  '2026-10-29T17:30:00Z', // 1:30 AM Oct 30 in Manila — still "today" there, yesterday in UTC
  '2026-10-26T10:05:00Z', // an earlier day
  '2026-01-02T23:59:00Z', // a year boundary in some zones
];

test('the same instant prints the same string whatever the machine zone (the server is UTC, the phone is not)', () => {
  for (const iso of SAMPLES) {
    const seen = new Set(ZONES.map((tz) => underTz(tz, () => formatChatTimestamp(iso, NOW))));
    assert.equal(seen.size, 1, `${iso} printed ${seen.size} ways across ${ZONES.join(', ')}: ${[...seen].join(' | ')}`);
  }
});

test('the string has one fixed shape — a clock today, "Mon D, clock" otherwise — with plain spaces only', () => {
  const today = formatChatTimestamp('2026-10-30T01:05:00Z', NOW);
  assert.equal(today, '9:05 AM');
  const manilaToday = formatChatTimestamp('2026-10-29T17:30:00Z', NOW);
  assert.equal(manilaToday, '1:30 AM', 'today is decided in Manila, not in the machine zone');
  const earlier = formatChatTimestamp('2026-10-26T10:05:00Z', NOW);
  assert.equal(earlier, 'Oct 26, 6:05 PM');
  for (const iso of SAMPLES) {
    const s = formatChatTimestamp(iso, NOW);
    assert.match(s, /^(?:[A-Z][a-z]{2} \d{1,2}, )?\d{1,2}:\d{2} [AP]M$/, `"${s}" is not the one shape (no " at ", no special spaces)`);
  }
});

test('a bad timestamp prints nothing, never "Invalid Date"', () => {
  assert.equal(formatChatTimestamp('not a date', NOW), '');
});
