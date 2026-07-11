import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  webCopyBytes,
  webCopyRatio,
  aggregateEventStorage,
  BYTES_PER_GB,
  type StorageRow,
} from './papic-storage-telemetry';

// A "typical" still: 4 MB original → ~0.3 MB display + ~40 KB thumb ≈ 8.5% web copy.
const STILL: StorageRow = {
  orig_bytes: 4_000_000,
  display_bytes: 300_000,
  thumb_bytes: 40_000,
};
// A clip: no orig_bytes (video ≠ poster), poster display + thumb only.
const CLIP: StorageRow = {
  orig_bytes: null,
  display_bytes: 200_000,
  thumb_bytes: 30_000,
};

test('webCopyBytes = display + thumb', () => {
  assert.equal(webCopyBytes(STILL), 340_000);
  assert.equal(webCopyBytes(CLIP), 230_000);
});

test('webCopyBytes tolerates NULL/missing fields', () => {
  assert.equal(webCopyBytes({}), 0);
  assert.equal(webCopyBytes({ display_bytes: 100, thumb_bytes: null }), 100);
});

test('webCopyRatio measures the real "~8%" for a still', () => {
  const r = webCopyRatio(STILL);
  assert.ok(r !== null && Math.abs(r - 0.085) < 1e-9);
});

test('webCopyRatio is NULL for a clip (no original) — never corrupts the ratio', () => {
  assert.equal(webCopyRatio(CLIP), null);
  assert.equal(webCopyRatio({ orig_bytes: 0, display_bytes: 100 }), null);
});

test('aggregate ratio is measured over stills only, ignoring clips', () => {
  const s = aggregateEventStorage([STILL, STILL, CLIP]);
  assert.equal(s.captures, 3);
  assert.equal(s.measuredStills, 2);
  // ratio = (340k+340k) / (4M+4M) = 0.085 — the clip's 230k web copy is excluded
  assert.ok(s.webCopyRatio !== null && Math.abs(s.webCopyRatio - 0.085) < 1e-9);
});

test('total web copy counts ALL captures (stills + clip posters) for the ceiling', () => {
  const s = aggregateEventStorage([STILL, CLIP]);
  assert.equal(s.totalWebCopyBytes, 340_000 + 230_000);
});

test('over-ceiling switch fires only above the (dialable) threshold', () => {
  // 100 stills whose web copy is 0.5 GB each = 50 GB total → over the 40 GB default.
  const heavy: StorageRow[] = Array.from({ length: 100 }, () => ({
    orig_bytes: 6 * BYTES_PER_GB,
    display_bytes: 0.5 * BYTES_PER_GB,
    thumb_bytes: 0,
  }));
  const over = aggregateEventStorage(heavy);
  assert.equal(over.overWebCopyCeiling, true);
  assert.ok(over.totalWebCopyGb > 40);

  // A normal event stays well under.
  const normal = aggregateEventStorage([STILL, STILL, STILL]);
  assert.equal(normal.overWebCopyCeiling, false);

  // The ceiling is dialable.
  const dialed = aggregateEventStorage(heavy, { webCopyCeilingGb: 100 });
  assert.equal(dialed.overWebCopyCeiling, false);
  assert.equal(dialed.ceilingGb, 100);
});

test('empty event → null ratio, zero totals, not over ceiling', () => {
  const s = aggregateEventStorage([]);
  assert.equal(s.webCopyRatio, null);
  assert.equal(s.totalWebCopyBytes, 0);
  assert.equal(s.overWebCopyCeiling, false);
});
