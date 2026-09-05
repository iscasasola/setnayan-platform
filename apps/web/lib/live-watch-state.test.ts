import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideGuestWatchState, type GuestWatchLive } from './live-watch-state';

const LINK: GuestWatchLive = {
  embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  facebookUrl: null,
};

test('a resolvable link is always live, regardless of broadcast-row history', () => {
  for (const latestBroadcastStatus of [
    null,
    'ready',
    'testing',
    'live',
    'complete',
    'errored',
  ] as const) {
    assert.equal(
      decideGuestWatchState({ watchLive: LINK, latestBroadcastStatus }),
      'live',
      `link present + status=${latestBroadcastStatus} should be 'live'`,
    );
  }
});

test('no link, no broadcast row ever created → not_yet', () => {
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: null }),
    'not_yet',
  );
});

test('no link, most recent broadcast row complete → ended', () => {
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: 'complete' }),
    'ended',
  );
});

test('no link, broadcast lifecycle still open → reconnecting', () => {
  for (const latestBroadcastStatus of ['ready', 'testing', 'live', 'errored'] as const) {
    assert.equal(
      decideGuestWatchState({ watchLive: null, latestBroadcastStatus }),
      'reconnecting',
      `no link + status=${latestBroadcastStatus} should be 'reconnecting'`,
    );
  }
});

// ⭐ THE GUARD (rule 164 of the W1 prompt): a finished broadcast must NEVER be
// reported as "about to come back". Mutation-tested by dropping the
// `latestBroadcastStatus === 'complete'` branch and confirming this goes red.
test("GUARD: 'complete' never produces 'reconnecting'", () => {
  const result = decideGuestWatchState({ watchLive: null, latestBroadcastStatus: 'complete' });
  assert.notEqual(result, 'reconnecting');
  assert.equal(result, 'ended');
});

// Totality: every branch returns one of the four named states, never undefined
// or a fifth value a caller didn't ask for.
test('total: every input combination returns a valid GuestWatchState', () => {
  const VALID = new Set(['live', 'reconnecting', 'ended', 'not_yet']);
  const statuses = [null, 'ready', 'testing', 'live', 'complete', 'errored'] as const;
  for (const watchLive of [null, LINK]) {
    for (const latestBroadcastStatus of statuses) {
      const result = decideGuestWatchState({ watchLive, latestBroadcastStatus });
      assert.ok(VALID.has(result), `unexpected state: ${result}`);
    }
  }
});
