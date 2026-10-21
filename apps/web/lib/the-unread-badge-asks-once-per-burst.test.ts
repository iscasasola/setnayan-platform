/**
 * The Messages badge used to fire `count_unread_message_threads()` once PER chat message the caller could see — a
 * burst of five replies was five identical RPCs. It then asked once per burst (`settleBurst`, retired 2026-10-21).
 *
 * Since 2026-10-21 it holds no Realtime channel at all (lib/a-socket-only-where-something-is-live.test.ts): it re-asks
 * on a slow timer while the tab is in view, and at once on return (`startCountPoll`). So a burst of messages asks
 * NOTHING extra — and a burst of return events (visibilitychange + focus + online, which fire together) asks once.
 *
 * Two halves, because either alone is a green that proves nothing:
 *   · the helper: a burst of wake events → exactly ONE read; a later return (past the gap) → a second;
 *   · the wiring: the badge reads through `startCountPoll` and nowhere else, and holds no channel.
 *
 * Sabotage-checked (2026-10-21): dropping the gap check in `startCountPoll`'s wake handler fails the helper half;
 * putting a `postgres_changes` INSERT handler back in the badge fails the wiring half.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { startCountPoll, type TabEnv } from './tab-return';
import { stripComments } from './strip-comments';

test('a burst of return events asks once; a later return asks again', async () => {
  let t = 100_000;
  const wakes: Array<() => void> = [];
  const env: TabEnv = {
    isVisible: () => true,
    onWake: (cb) => {
      wakes.push(cb);
      return () => {};
    },
    onVisibility: () => () => {},
    now: () => t,
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  let reads = 0;
  const stop = startCountPoll({ read: async () => (reads += 1), onValue: () => {}, minGapMs: 10_000, env });
  const fire = async () => {
    wakes.forEach((w) => w());
    for (let i = 0; i < 3; i += 1) await Promise.resolve();
  };
  t += 60_000;
  for (let i = 0; i < 5; i += 1) await fire();
  assert.equal(reads, 1, 'a burst of five return events must ask exactly once');
  t += 10_000;
  await fire();
  assert.equal(reads, 2, 'a later return must still be asked');
  stop();
});

test('the badge reads through the poll and holds no channel', () => {
  const src = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'app', '_components', 'unread-messages-badge.tsx'), 'utf8'),
  );
  assert.match(src, /return startCountPoll\(\{/, 'the badge no longer reads through startCountPoll');
  assert.equal((src.match(/readUnreadMessageThreads\(/g) ?? []).length, 1, 'the badge reads the count from exactly one place');
  assert.doesNotMatch(src, /postgres_changes|\.channel\(/, 'the badge subscribes to chat_messages again — a socket and a read per message');
});
