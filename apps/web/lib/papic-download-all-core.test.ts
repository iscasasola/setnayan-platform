/**
 * 📦 DOWNLOAD ALL — the plan (owner 2026-11-03, DECISION_LOG "THE PHOTO RULE": "zips by chapter, ~2 GB numbered parts,
 * count + sizes shown up front, per-zip ✓").
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PART_TARGET_BYTES,
  UNSORTED_KEY,
  cutIntoParts,
  entryName,
  findPart,
  formatBytes,
  formatFileCount,
  partFileName,
  partFingerprint,
  pickDownloadSource,
  planDownloadAll,
  type DownloadFile,
} from './papic-download-all-core';

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const file = (id: string, bytes: number, chapters: string[] = [], at = `2027-02-14T0${id.length % 9}:00:00Z`, kind: 'photo' | 'clip' = 'photo'): DownloadFile => ({
  id,
  kind,
  ref: `r2://setnayan-media/papic/${id}.jpg`,
  needsStrip: kind === 'photo',
  ext: kind === 'photo' ? 'jpg' : 'mp4',
  at,
  bytes,
  chapters,
});

test('the owner’s ~2 GB is 2 GiB', () => {
  assert.equal(PART_TARGET_BYTES, 2 * GB);
});

test('one zip set per chapter, in the chapters’ order, then Unsorted', () => {
  const plan = planDownloadAll(
    [file('a', 10 * MB, ['cer']), file('b', 10 * MB, ['rec']), file('c', 10 * MB, [])],
    [
      { id: 'cer', label: 'Ceremony' },
      { id: 'rec', label: 'Reception' },
    ],
  );
  assert.deepEqual(
    plan.parts.map((p) => [p.chapterKey, p.chapterLabel, p.part, p.of, p.count]),
    [
      ['cer', 'Ceremony', 1, 1, 1],
      ['rec', 'Reception', 1, 1, 1],
      [UNSORTED_KEY, 'Unsorted', 1, 1, 1],
    ],
  );
  assert.equal(plan.count, 3);
  assert.equal(plan.bytes, 30 * MB);
});

test('a photo in two chapters is in both zips, counted once in the total photos', () => {
  const plan = planDownloadAll([file('a', 5 * MB, ['cer', 'rec'])], [
    { id: 'cer', label: 'Ceremony' },
    { id: 'rec', label: 'Reception' },
  ]);
  assert.equal(plan.parts.length, 2);
  assert.equal(plan.count, 1);
  assert.equal(plan.bytes, 10 * MB, 'it downloads twice, so the size counts twice');
});

test('a chapter the host is not shown is never a zip — its photos fall to Unsorted only if they are in no shown chapter', () => {
  const plan = planDownloadAll([file('a', MB, ['hidden']), file('b', MB, ['hidden', 'cer'])], [{ id: 'cer', label: 'Ceremony' }]);
  assert.deepEqual(plan.parts.map((p) => [p.chapterKey, p.files.map((f) => f.id)]), [
    ['cer', ['b']],
    [UNSORTED_KEY, ['a']],
  ]);
});

test('numbered parts of at most ~2 GB, in capture order; an over-size file gets a part of its own', () => {
  const files = [
    file('a1', 1.5 * GB, ['x'], '2027-02-14T01:00:00Z'),
    file('a2', 0.4 * GB, ['x'], '2027-02-14T02:00:00Z'),
    file('a3', 0.2 * GB, ['x'], '2027-02-14T03:00:00Z'), // 1.5 + 0.4 + 0.2 > 2 → starts part 2
    file('a4', 3 * GB, ['x'], '2027-02-14T04:00:00Z'), // bigger than a part — alone
    file('a5', 1 * MB, ['x'], '2027-02-14T05:00:00Z'),
  ];
  const plan = planDownloadAll(files, [{ id: 'x', label: 'Day 1' }]);
  assert.deepEqual(plan.parts.map((p) => [p.part, p.of, p.files.map((f) => f.id)]), [
    [1, 4, ['a1', 'a2']], // 1.9 GB
    [2, 4, ['a3']], // 0.2 GB — the next file would take it past 2 GB
    [3, 4, ['a4']], // 3 GB — one file bigger than a part, never split
    [4, 4, ['a5']],
  ]);
});

test('cutIntoParts never splits or drops a file, and no part but a single-file one passes the target', () => {
  const files = Array.from({ length: 50 }, (_, i) => file(`f${i}`, ((i * 37) % 11) * 100 * MB));
  const parts = cutIntoParts(files, 2 * GB);
  assert.equal(parts.flat().length, 50);
  for (const p of parts) {
    const size = p.reduce((s, f) => s + f.bytes, 0);
    assert.ok(size <= 2 * GB || p.length === 1, `a part of ${p.length} files is ${size} bytes`);
  }
});

test('a part is found by chapter + number, and its fingerprint moves when its contents do', () => {
  const plan = planDownloadAll([file('a', MB, ['x'])], [{ id: 'x', label: 'Day 1' }]);
  const p = findPart(plan, 'x', 1)!;
  assert.ok(p);
  assert.equal(findPart(plan, 'x', 2), null);
  const fp = partFingerprint(p);
  assert.match(fp, /^[0-9a-f]{8}$/);
  assert.equal(partFingerprint({ files: [...p.files] }), fp, 'same contents, same fingerprint');
  assert.notEqual(partFingerprint({ files: [{ ...p.files[0]!, bytes: 2 * MB }] }), fp);
});

test('the words: sizes, counts, file names', () => {
  assert.equal(formatBytes(1.9 * GB), '1.9 GB');
  assert.equal(formatBytes(412 * MB), '412 MB');
  assert.equal(formatBytes(0), '0 bytes');
  assert.equal(formatFileCount([file('a', 1), file('b', 1)]), '2 photos');
  assert.equal(formatFileCount([file('a', 1, [], undefined, 'clip')]), '1 clip');
  assert.equal(formatFileCount([file('a', 1), file('b', 1, [], undefined, 'clip')]), '2 photos and clips');
  assert.equal(partFileName('Maria & Jose', { chapterLabel: 'Ceremony', part: 1, of: 2 }), 'Maria & Jose — Ceremony — part 1 of 2.zip');
  assert.equal(partFileName('A/B: "x"', { chapterLabel: 'Day 1', part: 1, of: 1 }), 'A B x — Day 1.zip');
  assert.equal(entryName({ id: 'p1', at: '2027-02-14T10:00:00Z', ext: 'jpg' }, 0), '2027-02-14-0001-p1.jpg');
});

test('which file goes in — originals stripped of location; after the drop the 720p copy; clips raw, else their web copy', () => {
  assert.deepEqual(pickDownloadSource('o', 'd', null, false, null), { ref: 'o', needsStrip: true, ext: 'jpg', measuredBy: 'orig_bytes' });
  assert.deepEqual(pickDownloadSource('o', 'd', '2027-05-17', false, null), { ref: 'd', needsStrip: false, ext: 'avif', measuredBy: 'display_bytes' });
  assert.deepEqual(pickDownloadSource('o', null, '2027-05-17', false, null), { ref: 'o', needsStrip: true, ext: 'jpg', measuredBy: 'orig_bytes' });
  assert.deepEqual(pickDownloadSource('o', 'd', null, true, 'w'), { ref: 'o', needsStrip: false, ext: 'mp4', measuredBy: 'none' });
  assert.deepEqual(pickDownloadSource('o', 'd', '2027-05-17', true, 'w'), { ref: 'w', needsStrip: false, ext: 'mp4', measuredBy: 'clip_web_bytes' });
  assert.equal(pickDownloadSource(null, null, null, false, null), null);
});
