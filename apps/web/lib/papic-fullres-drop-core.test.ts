import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEligibleForDrop,
  resolveOriginalRef,
  DEFAULT_FULL_RES_RETENTION_DAYS,
  type DropCandidate,
} from './papic-fullres-drop-core';

// This is DESTRUCTIVE logic (it decides which R2 originals get deleted), so the
// guards get a dense test — a wrong `true` deletes a photo that shouldn't be.

const NOW = Date.parse('2026-07-11T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const OPTS = { retentionDays: DEFAULT_FULL_RES_RETENTION_DAYS, nowMs: NOW };

function row(over: Partial<DropCandidate> = {}): DropCandidate {
  return {
    r2_object_key: 'event-abc/papic/seat-1/photo.jpg',
    display_r2_key: 'r2://setnayan-media/derivatives/event-abc/…display.avif',
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
    ...over,
  };
}

test('eligible: old photo, has web copy, not dropped, real key', () => {
  assert.equal(isEligibleForDrop(row(), OPTS), true);
});

test('NOT eligible: younger than the window', () => {
  assert.equal(isEligibleForDrop(row({ captured_at: daysAgo(30) }), OPTS), false);
  // exactly at the boundary is eligible (>=)
  assert.equal(isEligibleForDrop(row({ captured_at: daysAgo(90) }), OPTS), true);
});

test('NOT eligible: no web copy (would LOSE the photo)', () => {
  assert.equal(isEligibleForDrop(row({ display_r2_key: null }), OPTS), false);
});

test('NOT eligible: already dropped (idempotent)', () => {
  assert.equal(
    isEligibleForDrop(row({ full_res_dropped_at: daysAgo(1) }), OPTS),
    false,
  );
});

test('NOT eligible: a sample/ seed key is never touched', () => {
  assert.equal(
    isEligibleForDrop(row({ r2_object_key: 'sample/papic/maria-jose/01.jpg' }), OPTS),
    false,
  );
});

test('NOT eligible: unparseable captured_at', () => {
  assert.equal(isEligibleForDrop(row({ captured_at: 'not-a-date' }), OPTS), false);
});

// ── resolveOriginalRef ───────────────────────────────────────────────────────

test('raw key → media bucket', () => {
  assert.deepEqual(resolveOriginalRef('event-abc/papic/x.jpg'), {
    bucket: 'setnayan-media',
    key: 'event-abc/papic/x.jpg',
  });
});

test('r2:// ref → its own known bucket', () => {
  assert.deepEqual(resolveOriginalRef('r2://setnayan-media/a/b.jpg'), {
    bucket: 'setnayan-media',
    key: 'a/b.jpg',
  });
});

test('r2:// ref with an UNKNOWN bucket → null (never delete blindly)', () => {
  assert.equal(resolveOriginalRef('r2://some-other-bucket/a.jpg'), null);
  assert.equal(resolveOriginalRef('r2://'), null);
  assert.equal(resolveOriginalRef(''), null);
});
