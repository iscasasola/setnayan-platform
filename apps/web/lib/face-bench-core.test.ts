/**
 * The Papic face bench (lib/face-bench-core.ts) — owner 2026-11-05, DECISION_LOG "FACE MATCHING: MAKE IT FIND EVERY
 * PHOTO OF A PERSON — APPROVED, IN SLICES, MEASURED FIRST", slice (1).
 *
 * The bench is only worth anything if it counts what the APP would do. So the centre of this file runs the bench and
 * the shipped matcher (`planAutoTags`) on the same random numbers and requires them to agree, pair for pair.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  benchPairs,
  benchReport,
  benchRow,
  detectorFaceHeight,
  formatBenchReport,
  histogram,
  pairOutcome,
  planBenchLayout,
  sweepLines,
  BENCH_SERVER_MAX_SIDE,
  DETECTOR_INPUT_SIDE,
  type BenchPhoto,
} from './face-bench-core';
import { planAutoTags, FACE_AUTO_MAX_DISTANCE, FACE_SUGGEST_MAX_DISTANCE } from './face-match-core';

const box = (h: number) => ({ x: 0, y: 0, width: h, height: h });

test('the layout: selfies enrol, a group photo copied into two folders is ONE photo with two people', () => {
  const l = planBenchLayout([
    { relPath: 'ana/selfie.jpg', hash: 's-ana' },
    { relPath: 'ana/selfie-2.JPG', hash: 's-ana2' },
    { relPath: 'ben/selfie.png', hash: 's-ben' },
    { relPath: 'ana/table-3.jpg', hash: 'h-group' },
    { relPath: 'ben/table-3-copy.jpg', hash: 'h-group' },
    { relPath: 'ben/dance.jpg', hash: 'h-dance' },
    { relPath: 'loose.jpg', hash: 'x1' },
    { relPath: 'ana/notes.txt', hash: 'x2' },
    { relPath: 'ana/.DS_Store', hash: 'x3' },
    { relPath: 'ana/deep/one.jpg', hash: 'x4' },
  ]);
  assert.deepEqual(l.selfies.get('ana'), ['ana/selfie-2.JPG', 'ana/selfie.jpg']);
  assert.deepEqual(l.selfies.get('ben'), ['ben/selfie.png']);
  assert.equal(l.photos.length, 2);
  const group = l.photos.find((p) => p.key === 'h-group');
  assert.deepEqual(group?.people, ['ana', 'ben'], 'a copy in both folders labels both people');
  assert.deepEqual(group?.paths.sort(), ['ana/table-3.jpg', 'ben/table-3-copy.jpg']);
  assert.deepEqual(l.photos.find((p) => p.key === 'h-dance')?.people, ['ben']);
  assert.deepEqual(
    l.skipped.map((s) => s.relPath).sort(),
    ['ana/.DS_Store', 'ana/deep/one.jpg', 'ana/notes.txt', 'loose.jpg'],
  );
});

test('the layout: --selfies N keeps the first N, and a selfie reused as an event photo is not counted as a hit', () => {
  const l = planBenchLayout(
    [
      { relPath: 'ana/selfie-1.jpg', hash: 'a1' },
      { relPath: 'ana/selfie-2.jpg', hash: 'a2' },
      { relPath: 'ana/selfie-3.jpg', hash: 'a3' },
      { relPath: 'ana/same-as-selfie.jpg', hash: 'a1' },
    ],
    { maxSelfies: 1 },
  );
  assert.deepEqual(l.selfies.get('ana'), ['ana/selfie-1.jpg']);
  assert.equal(l.photos.length, 0, 'the selfie copy is not an event photo');
  assert.deepEqual(l.selfieAlsoPhoto, ['ana/selfie-1.jpg']);
  assert.ok(l.skipped.some((s) => s.relPath === 'ana/selfie-3.jpg'));
});

test('a face is measured the way the detector sees it: height × 512 ÷ the longest side', () => {
  assert.equal(DETECTOR_INPUT_SIDE, 512);
  assert.equal(detectorFaceHeight(box(100), 1024, 768), 50);
  assert.equal(detectorFaceHeight(box(100), 768, 1024), 50, 'portrait: the longest side is the height');
  assert.equal(detectorFaceHeight(box(100), 0, 0), 0);
});

// 🔑 THE BENCH COUNTS WHAT THE APP DOES. Change pairOutcome's bands, or benchPairs' "closest face × closest selfie",
// and the two disagree here.
test('at the shipped lines the bench and planAutoTags make the SAME call on every pair (random photos)', () => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const vec = () => Array.from({ length: 4 }, () => rnd() * 0.5);
  const people = ['a', 'b', 'c', 'd', 'e'];
  const enrolments = people.map((p) => ({ person: p, vectors: Array.from({ length: 1 + Math.floor(rnd() * 3) }, vec) }));
  const photos: BenchPhoto[] = Array.from({ length: 60 }, (_, i) => ({
    key: `p${i}`,
    paths: [`x/p${i}.jpg`],
    people: people.filter(() => rnd() < 0.3),
    width: 1024,
    height: 768,
    faces: Array.from({ length: Math.floor(rnd() * 4) }, () => ({ vector: vec(), box: box(40), score: 0.9 })),
  }));
  const pairs = benchPairs(photos, enrolments);
  let compared = 0;
  for (const photo of photos) {
    const plan = planAutoTags({
      faceVectors: photo.faces.map((f) => f.vector),
      enrollments: enrolments.flatMap((e) => e.vectors.map((v) => ({ guestId: e.person, vector: v }))),
    });
    const auto = new Set(plan.autoTags.map((t) => t.guestId));
    const sugg = new Set(plan.suggestions.map((t) => t.guestId));
    for (const pair of pairs.filter((p) => p.photoKey === photo.key)) {
      const o = pairOutcome(pair, FACE_AUTO_MAX_DISTANCE, FACE_SUGGEST_MAX_DISTANCE);
      const app = auto.has(pair.person) ? 'auto' : sugg.has(pair.person) ? 'suggest' : 'none';
      const bench = o.startsWith('auto') ? 'auto' : o.startsWith('suggest') ? 'suggest' : 'none';
      assert.equal(bench, app, `photo ${photo.key} person ${pair.person}: bench ${bench}, app ${app}`);
      compared += 1;
    }
  }
  assert.ok(compared >= 250, `compared ${compared} pairs`);
  const row = benchRow(pairs, FACE_AUTO_MAX_DISTANCE, FACE_SUGGEST_MAX_DISTANCE);
  assert.ok(row.autoTrue + row.autoFalse > 0 && row.suggestTrue + row.suggestFalse > 0, 'the random set exercises both bands');
});

test('one row counts true and false auto-tags, suggestions, misses and quiet pairs', () => {
  // 3-d vectors so every distance is exact: ana sits at the origin; ben has two selfies, one near each photo's face.
  const photos: BenchPhoto[] = [
    // ana in it, 0.40 → auto✓ · ben not in it, 0.55 → sugg✗
    { key: 'p1', paths: [], people: ['ana'], width: 512, height: 512, faces: [{ vector: [0.4, 0, 0], box: box(30), score: 0.9 }] },
    // ana NOT in it, 0.45 → auto✗ · ben in it, 0.58 → sugg✓
    { key: 'p2', paths: [], people: ['ben'], width: 512, height: 512, faces: [{ vector: [0, 0.45, 0], box: box(20), score: 0.8 }] },
    // both in it, no face found → two misses, both "no face"
    { key: 'p3', paths: [], people: ['ana', 'ben'], width: 512, height: 512, faces: [] },
  ];
  const enrolments = [
    { person: 'ana', vectors: [[0, 0, 0]] },
    { person: 'ben', vectors: [[0.4, 0, 0.55], [0, 0.45, 0.58]] },
  ];
  const pairs = benchPairs(photos, enrolments);
  const d = (k: string, p: string) => pairs.find((x) => x.photoKey === k && x.person === p)?.distance;
  assert.ok(Math.abs((d('p1', 'ana') ?? 0) - 0.4) < 1e-9);
  assert.ok(Math.abs((d('p1', 'ben') ?? 0) - 0.55) < 1e-9);
  assert.ok(Math.abs((d('p2', 'ben') ?? 0) - 0.58) < 1e-9);
  assert.ok(Math.abs((d('p2', 'ana') ?? 0) - 0.45) < 1e-9);
  assert.equal(d('p3', 'ana'), Infinity);

  const row = benchRow(pairs, 0.5, 0.6);
  assert.equal(row.shipped, true);
  assert.equal(row.autoTrue, 1);
  assert.equal(row.autoFalse, 1);
  assert.equal(row.suggestTrue, 1);
  assert.equal(row.suggestFalse, 1);
  assert.equal(row.missed, 2);
  assert.equal(row.missedNoFace, 2);
  assert.equal(row.autoPrecision, 0.5);
  assert.equal(row.autoRecall, 1 / 4);
  assert.equal(row.reachRecall, 2 / 4);

  const strict = benchRow(pairs, 0.42, 0.42);
  assert.equal(strict.shipped, false);
  assert.equal(strict.autoTrue, 1);
  assert.equal(strict.autoFalse, 0);
  assert.equal(strict.suggestTrue + strict.suggestFalse, 0, 'no band when the suggest line is not above the auto line');
});

test('the report: the shipped row is marked, misses are split into "no face" and "a face, too far", sizes binned', () => {
  const photos: BenchPhoto[] = [
    { key: 'p1', paths: [], people: ['ana'], width: 1024, height: 768, faces: [{ vector: [0.3, 0], box: box(120), score: 0.9 }] },
    { key: 'p2', paths: [], people: ['ana'], width: 1024, height: 768, faces: [{ vector: [0.9, 0], box: box(30), score: 0.6 }] },
    { key: 'p3', paths: [], people: ['ana'], width: 1024, height: 768, faces: [] },
  ];
  const r = benchReport({
    photos,
    enrolments: [{ person: 'ana', vectors: [[0, 0]] }, { person: 'zed', vectors: [] }],
    autoLines: sweepLines(0.4, 0.6, 0.1),
  });
  assert.deepEqual(r.rows.map((x) => x.autoLine), [0.4, 0.5, 0.6]);
  assert.equal(r.rows.filter((x) => x.shipped).length, 1);
  assert.deepEqual(r.selfiesUnread, ['zed']);
  assert.equal(r.peopleEnrolled, 1);
  assert.equal(r.missesNoFace, 1);
  // p1's face: 120 × 512 / 1024 = 60 px → the 48–64 bin; p2's (missed, closest face): 15 px → "< 16".
  assert.equal(r.hitSizes.find((b) => b.label === '48–64px')?.count, 1);
  assert.equal(r.missSizes.find((b) => b.label === '< 16px')?.count, 1);
  const text = formatBenchReport(r);
  assert.match(text, /◀ shipped/);
  assert.match(text, /no face found in the photo at all: 1/);
});

test('sweepLines always includes the shipped auto line, and histogram bins are inclusive below', () => {
  assert.ok(sweepLines(0.3, 0.45, 0.05).includes(FACE_AUTO_MAX_DISTANCE));
  assert.deepEqual(sweepLines(0.3, 0.4, 0.05), [0.3, 0.35, 0.4, 0.5]);
  const h = histogram([1, 2, 2, 5, 9], [2, 5]);
  assert.deepEqual(h, [
    { label: '< 2', count: 1 },
    { label: '2–5', count: 2 },
    { label: '≥ 5', count: 2 },
  ]);
});

// ⚖ "no number moves without measured data" (owner 2026-11-05). These two lines were calibrated on 4 photos of 2
// faces in June. Moving either needs a bench run on real event photos, cited in the DECISION_LOG — then update here.
test('the shipped lines are still 0.50 and 0.60 — the bench reports, it does not move them', () => {
  assert.equal(FACE_AUTO_MAX_DISTANCE, 0.5);
  assert.equal(FACE_SUGGEST_MAX_DISTANCE, 0.6);
});

test('the bench decodes at the server embedder size, and its 512 is the library\'s own detector input', () => {
  const server = readFileSync(path.join(process.cwd(), 'lib', 'face-embed-server.ts'), 'utf8');
  const m = /export const SERVER_EMBED_MAX_SIDE = (\d+);/.exec(server);
  assert.ok(m, 'SERVER_EMBED_MAX_SIDE not found in lib/face-embed-server.ts');
  assert.equal(BENCH_SERVER_MAX_SIDE, Number(m[1]), 'the bench and the server embedder decode at different sizes');

  const ssd = readFileSync(
    path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'src', 'ssdMobilenetv1', 'SsdMobilenetv1.ts'),
    'utf8',
  );
  assert.match(ssd, new RegExp(`toBatchTensor\\(${DETECTOR_INPUT_SIDE}, false\\)`), 'the detector no longer resizes to 512');
});
