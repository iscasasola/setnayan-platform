/**
 * sync-daemon eviction backstop (Node built-in test runner, run via tsx —
 * `pnpm test:unit`). Covers the pure `isOfflineItemExpired` predicate that
 * decides when a permanently-failing queued item is evicted instead of retried
 * forever. The rest of the daemon needs IndexedDB, so only the predicate is
 * unit-tested here (nowMs is injectable so we don't touch the wall clock).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isOfflineItemExpired,
  OFFLINE_ITEM_TTL_MS,
  OFFLINE_MAX_RETRY_COUNT,
} from './sync-daemon';

const NOW = 1_760_000_000_000; // fixed reference "now" for the age math

function at(offsetMs: number): string {
  return new Date(NOW - offsetMs).toISOString();
}

test('a fresh, lightly-retried item is not evicted', () => {
  assert.equal(isOfflineItemExpired({ queued_at: at(60_000), retry_count: 3 }, NOW), false);
});

test('an item past the 7-day TTL is evicted (age bound)', () => {
  const justOver = OFFLINE_ITEM_TTL_MS + 1_000;
  assert.equal(isOfflineItemExpired({ queued_at: at(justOver), retry_count: 0 }, NOW), true);
});

test('the TTL boundary is exclusive — exactly TTL old is not yet evicted', () => {
  assert.equal(
    isOfflineItemExpired({ queued_at: at(OFFLINE_ITEM_TTL_MS), retry_count: 0 }, NOW),
    false,
  );
});

test('an item at/over the retry cap is evicted even when fresh (retry bound)', () => {
  assert.equal(
    isOfflineItemExpired({ queued_at: at(1_000), retry_count: OFFLINE_MAX_RETRY_COUNT }, NOW),
    true,
  );
  assert.equal(
    isOfflineItemExpired({ queued_at: at(1_000), retry_count: OFFLINE_MAX_RETRY_COUNT - 1 }, NOW),
    false,
  );
});

test('a malformed queued_at never ages out on time alone — the retry cap is the backstop', () => {
  assert.equal(isOfflineItemExpired({ queued_at: 'not-a-date', retry_count: 0 }, NOW), false);
  assert.equal(
    isOfflineItemExpired({ queued_at: 'not-a-date', retry_count: OFFLINE_MAX_RETRY_COUNT }, NOW),
    true,
  );
});

test('📮 the daemon leaves save-first Papic shots to the page uploader — two senders race', async () => {
  const { ownedByPageUploader } = await import('../papic-upload/ownership');
  for (const mode of ['save-first', 'save-first-blob', 'guest', 'vendor']) {
    assert.equal(ownedByPageUploader({ payload: { mode } }), true, mode);
  }
  // The seat camera's items (no mode) are still the daemon's.
  assert.equal(ownedByPageUploader({ payload: { seat_token: 't' } }), false);
  const src = (await import('node:fs')).readFileSync(new URL('./sync-daemon.ts', import.meta.url), 'utf8');
  const skip = src.indexOf("if (service === 'papic' && ownedByPageUploader(item)) continue;");
  const evict = src.indexOf('if (isOfflineItemExpired(item))');
  assert.ok(skip > -1 && skip < evict, 'the skip must come before the daemon evicts or sends anything');
});
