import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedDriveKeys,
  isDriveCopyConfirmed,
  isDriveDeferred,
  isEligibleForDrop,
  resolveOriginalRef,
  DEFAULT_FULL_RES_RETENTION_DAYS,
  type DriveArtifactRow,
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

// ── Drive-aware defer guard (Build Brief ruling #4) ──────────────────────────
// The single most dangerous branch in this module: a wrong `false` here deletes
// the ONLY full-res copy of a wedding photo.

const KEY = 'event-abc/papic/seat-1/photo.jpg';

function art(over: Partial<DriveArtifactRow> = {}): DriveArtifactRow {
  return { r2_object_key: KEY, drive_file_id: 'drive-file-1', ...over };
}

test('confirmed: uploaded high-res copy (drive_file_id present)', () => {
  assert.equal(isDriveCopyConfirmed(art()), true);
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: true })), true);
  // photo_delivery_artifacts has no copied_high_res column — absent = the
  // original bytes were uploaded, so it counts as high-res.
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: undefined })), true);
});

test('NOT confirmed: queued / failed / retry-capped (no drive_file_id)', () => {
  assert.equal(isDriveCopyConfirmed(art({ drive_file_id: null })), false);
  assert.equal(isDriveCopyConfirmed(art({ drive_file_id: '' })), false);
});

test('NOT confirmed: a post-compression copy (copied_high_res=false)', () => {
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: false })), false);
});

test('NOT confirmed: keyless row', () => {
  assert.equal(isDriveCopyConfirmed(art({ r2_object_key: null })), false);
});

test('confirmedDriveKeys keeps only the confirmed rows', () => {
  const keys = confirmedDriveKeys([
    art(),
    art({ r2_object_key: 'b.jpg', drive_file_id: null }),
    art({ r2_object_key: 'c.jpg', copied_high_res: false }),
    art({ r2_object_key: 'd.jpg' }),
  ]);
  assert.deepEqual([...keys].sort(), [KEY, 'd.jpg'].sort());
});

test('DEFER: Drive connected but this photo is not copied yet', () => {
  const state = { kind: 'connected' as const, confirmedKeys: new Set<string>() };
  assert.equal(isDriveDeferred(KEY, state), true);
});

test('DROPPABLE: Drive connected and this photo IS confirmed', () => {
  const state = { kind: 'connected' as const, confirmedKeys: new Set([KEY]) };
  assert.equal(isDriveDeferred(KEY, state), false);
  // ...but a sibling key that isn't confirmed still defers.
  assert.equal(isDriveDeferred('other.jpg', state), true);
});

test('UNCHANGED: Drive never connected → guard is a no-op', () => {
  assert.equal(isDriveDeferred(KEY, { kind: 'not_connected' }), false);
});

test('DEFER: unreadable Drive state — a read failure never authorizes a delete', () => {
  assert.equal(isDriveDeferred(KEY, { kind: 'unknown', reason: 'oauth_grants:boom' }), true);
});
