import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRIVE_COPY_BATCH_CAP,
  DRIVE_COPY_RETRY_BASE_MS,
  DRIVE_COPY_RETRY_CEILING,
  DRIVE_COPY_RETRY_MAX_MS,
  driveCopyRetryBackoffMs,
  driveCopyRetryDue,
  driveCopyStranded,
} from './papic-drive-copy-retry-core';

// ============================================================================
// Papic storage PR-4 — Drive-copy RETRY back-off + ceiling (pure predicates).
// These drive the autonomous retry sweep (lib/papic-drive-copy-retry.ts).
// ============================================================================

const NOW = Date.parse('2026-07-22T00:00:00Z');
const agoMs = (ms: number) => new Date(NOW - ms).toISOString();

// ── drift guard: the pure cap mirrors drive-copy.ts's MAX_ATTEMPTS ───────────

test('DRIVE_COPY_BATCH_CAP mirrors the 5-retry batch cap; the ceiling sits above it', () => {
  assert.equal(DRIVE_COPY_BATCH_CAP, 5, 'must match MAX_ATTEMPTS in lib/drive-copy.ts');
  assert.ok(
    DRIVE_COPY_RETRY_CEILING > DRIVE_COPY_BATCH_CAP,
    'the retry sweep must reach ABOVE the normal batch cap',
  );
});

// ── exponential back-off, capped ─────────────────────────────────────────────

test('back-off doubles per attempt from the base', () => {
  assert.equal(driveCopyRetryBackoffMs(1), DRIVE_COPY_RETRY_BASE_MS); // 30m
  assert.equal(driveCopyRetryBackoffMs(2), DRIVE_COPY_RETRY_BASE_MS * 2); // 1h
  assert.equal(driveCopyRetryBackoffMs(3), DRIVE_COPY_RETRY_BASE_MS * 4); // 2h
  assert.equal(driveCopyRetryBackoffMs(4), DRIVE_COPY_RETRY_BASE_MS * 8); // 4h
});

test('back-off never grows past the 24h cap', () => {
  assert.equal(driveCopyRetryBackoffMs(9), DRIVE_COPY_RETRY_MAX_MS);
  assert.equal(driveCopyRetryBackoffMs(100), DRIVE_COPY_RETRY_MAX_MS);
});

test('back-off is finite/base-floored for junk attempt counts', () => {
  assert.equal(driveCopyRetryBackoffMs(0), DRIVE_COPY_RETRY_BASE_MS);
  assert.equal(driveCopyRetryBackoffMs(Number.NaN), DRIVE_COPY_RETRY_BASE_MS);
  assert.equal(driveCopyRetryBackoffMs(-3), DRIVE_COPY_RETRY_BASE_MS);
});

// ── due / not-due ────────────────────────────────────────────────────────────

test('a failed row is due once its back-off since last_error_at has elapsed', () => {
  // attempt 1 → 30m back-off.
  assert.equal(
    driveCopyRetryDue({ attempt_count: 1, last_error_at: agoMs(31 * 60_000) }, NOW),
    true,
    '31 min after a first failure → due',
  );
  assert.equal(
    driveCopyRetryDue({ attempt_count: 1, last_error_at: agoMs(10 * 60_000) }, NOW),
    false,
    'only 10 min after → too soon, hold',
  );
});

test('a row past the ceiling is NEVER due (stranded → surfaced, not hot-looped)', () => {
  assert.equal(
    driveCopyRetryDue(
      { attempt_count: DRIVE_COPY_RETRY_CEILING, last_error_at: agoMs(DRIVE_COPY_RETRY_MAX_MS * 5) },
      NOW,
    ),
    false,
  );
  assert.equal(
    driveCopyRetryDue({ attempt_count: DRIVE_COPY_RETRY_CEILING + 3, last_error_at: null }, NOW),
    false,
  );
});

test('a never-attempted row (attempt < 1) is not the retry sweep’s job', () => {
  assert.equal(driveCopyRetryDue({ attempt_count: 0, last_error_at: null }, NOW), false);
});

test('an already-copied row (drive_file_id set) is never due', () => {
  assert.equal(
    driveCopyRetryDue(
      { attempt_count: 3, last_error_at: agoMs(DRIVE_COPY_RETRY_MAX_MS), drive_file_id: 'file-123' },
      NOW,
    ),
    false,
  );
});

test('a failed row with no last_error_at is due (can’t prove it’s too soon)', () => {
  assert.equal(driveCopyRetryDue({ attempt_count: 2, last_error_at: null }, NOW), true);
  assert.equal(driveCopyRetryDue({ attempt_count: 2, last_error_at: 'not-a-date' }, NOW), true);
});

test('the retry sweep reaches rows ABOVE the batch cap (5..ceiling-1) with back-off', () => {
  // attempt 6 → 16h back-off. The normal batch (cap 5) never touches this row.
  assert.equal(
    driveCopyRetryDue(
      { attempt_count: 6, last_error_at: agoMs(17 * 60 * 60_000) },
      NOW,
    ),
    true,
    '17h after the 6th failure → due (only the retry sweep reaches it)',
  );
  assert.equal(
    driveCopyRetryDue({ attempt_count: 6, last_error_at: agoMs(60 * 60_000) }, NOW),
    false,
    '1h after → still inside the 16h back-off',
  );
});

// ── stranded predicate ───────────────────────────────────────────────────────

test('driveCopyStranded is true only at/over the ceiling with no drive_file_id', () => {
  assert.equal(driveCopyStranded({ attempt_count: DRIVE_COPY_RETRY_CEILING }), true);
  assert.equal(driveCopyStranded({ attempt_count: DRIVE_COPY_RETRY_CEILING + 5 }), true);
  assert.equal(driveCopyStranded({ attempt_count: DRIVE_COPY_RETRY_CEILING - 1 }), false);
  assert.equal(
    driveCopyStranded({ attempt_count: DRIVE_COPY_RETRY_CEILING, drive_file_id: 'f1' }),
    false,
    'a confirmed copy is never stranded',
  );
});
