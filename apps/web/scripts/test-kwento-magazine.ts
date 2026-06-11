/**
 * scripts/test-kwento-magazine.ts — unit suite for the Kwento Magazine
 * (lib/kwento-magazine.ts): the deterministic moment bucketing, the
 * Kwento-earns-its-photo curation rule, the WinAnsi sanitizer, and a REAL
 * end-to-end render from synthetic fixtures (the PDF is written to /tmp so a
 * human can open it — the renderer's proof, no browser needed).
 *
 * Run: pnpm exec tsx scripts/test-kwento-magazine.ts   (from apps/web)
 */

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import {
  bucketMoments,
  buildKwentoMagazine,
  prioritizeKwentoAnchors,
  winAnsiSafe,
  type MagazineCapture,
  type MagazineKwento,
} from '../lib/kwento-magazine';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

const T0 = Date.parse('2026-06-11T14:00:00Z');
const MIN = 60_000;
const cap = (i: number, atMs: number): MagazineCapture => ({
  sourceTable: i % 2 ? 'papic_photos' : 'papic_guest_captures',
  sourceId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  capturedAtMs: atMs,
});

/** A tiny valid JPEG (1×1) for the render test. */
const FIXTURE_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APv+iiiv/9k=',
    'base64',
  ),
);

async function main(): Promise<void> {
  console.log('kwento-magazine test suite\n');

  // ── winAnsiSafe ──
  await test('sanitizer: keeps ñ/é, curly quotes, em-dash; strips emoji', () => {
    assert.equal(winAnsiSafe('Niña’s “día” — ¡salamat!'), 'Niña’s “día” — ¡salamat!');
    assert.equal(winAnsiSafe('So happy 🥹💛 for you'), 'So happy for you');
  });

  // ── bucketing ──
  await test('bucketing: empty input → no chapters', () => {
    assert.deepEqual(bucketMoments([]), []);
  });

  await test('bucketing: a small set collapses to a single "Ang Araw" chapter', () => {
    const caps = Array.from({ length: 6 }, (_, i) => cap(i, T0 + i * MIN));
    const chapters = bucketMoments(caps);
    assert.equal(chapters.length, 1);
    assert.equal(chapters[0]?.title, 'Ang Araw');
  });

  await test('bucketing: a large gap splits chapters; ordinal PH labels apply', () => {
    // Two dense clusters of 8, separated by 90 minutes.
    const caps = [
      ...Array.from({ length: 8 }, (_, i) => cap(i, T0 + i * MIN)),
      ...Array.from({ length: 8 }, (_, i) => cap(100 + i, T0 + 90 * MIN + i * MIN)),
    ];
    const chapters = bucketMoments(caps);
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0]?.title, 'Ang Paghahanda');
    assert.equal(chapters[1]?.title, 'Ang Seremonya');
    assert.equal(chapters[0]?.captures.length, 8);
  });

  await test('curation owns the cap: bucketing keeps full groups; picks cap + count the drop', () => {
    const caps = Array.from({ length: 30 }, (_, i) => cap(i, T0 + i * MIN));
    const chapters = bucketMoments(caps);
    const kept = chapters.reduce((n, ch) => n + ch.captures.length, 0);
    assert.equal(kept, 30, 'bucketing never truncates');
    const picks = chapters.flatMap((ch) => prioritizeKwentoAnchors(ch, [], 8));
    assert.ok(picks.length < 30, 'the per-chapter cap applies at curation');
  });

  await test('bucketing: chronological order within and across chapters', () => {
    const caps = [cap(3, T0 + 3 * MIN), cap(1, T0 + MIN), cap(2, T0 + 2 * MIN)];
    const chapters = bucketMoments(caps);
    const times = chapters.flatMap((ch) => ch.captures.map((p) => p.capturedAtMs));
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  // ── curation ──
  await test('curation: a Kwento earns its photo a slot ahead of silent photos', () => {
    const caps = Array.from({ length: 12 }, (_, i) => cap(i, T0 + i * MIN));
    const chapter = bucketMoments(caps, { collapseBelow: 99 })[0];
    assert.ok(chapter);
    const last = caps[11];
    assert.ok(last);
    const kwentos: MagazineKwento[] = [
      { sourceTable: last.sourceTable, sourceId: last.sourceId, body: 'huli pero ang saya!', author: 'Tita Baby' },
    ];
    const picks = prioritizeKwentoAnchors(chapter, kwentos, 8);
    assert.equal(picks.length, 8);
    assert.equal(picks[0]?.sourceId, last.sourceId, 'the kwento-anchored photo leads');
  });

  // ── end-to-end render ──
  await test('render: a full magazine builds from fixtures (multi-page, valid PDF)', async () => {
    const caps = [
      ...Array.from({ length: 8 }, (_, i) => cap(i, T0 + i * MIN)),
      ...Array.from({ length: 8 }, (_, i) => cap(100 + i, T0 + 120 * MIN + i * MIN)),
    ];
    const chapters = bucketMoments(caps);
    const a = caps[0];
    const b = caps[9];
    assert.ok(a && b);
    const kwentos: MagazineKwento[] = [
      { sourceTable: a.sourceTable, sourceId: a.sourceId, body: 'Hindi mapigil ni Tita Niña ang luha — “grabe ang saya!”', author: 'Tita Baby' },
      { sourceTable: b.sourceTable, sourceId: b.sourceId, body: 'Best first dance ever. Promise.', author: 'Kuya Miggy' },
      { sourceTable: 'papic_photos', sourceId: 'ffffffff-0000-0000-0000-000000000000', body: 'Sana all — mahal namin kayo!', author: 'Ate Joy' },
    ];
    const images = new Map<string, Uint8Array>();
    for (const p of caps) images.set(`${p.sourceTable}:${p.sourceId}`, FIXTURE_JPEG);

    const pdf = await buildKwentoMagazine({
      coupleNames: 'Maria & José',
      eventDateIso: '2026-06-11',
      monogramInitials: 'MJ',
      prologueParagraphs: [
        'They met over halo-halo on a rainy Tuesday in Tagaytay, and the rest — as every tita in the room will tell you — was history.',
        'Seven years, two cities, and one very patient dog later, they said yes in front of everyone they love.',
      ],
      milestones: [
        { label: '2019 · First date', detail: 'Halo-halo, heavy rain' },
        { label: '2024 · The proposal', detail: 'Sunrise at the ridge' },
      ],
      specialMessage: 'Salamat sa inyong lahat — kayo ang kwento namin.',
      chapters,
      kwentos,
      images,
      totals: { photos: caps.length, kwentos: kwentos.length, guests: 148 },
    });

    assert.equal(pdf[0], 0x25, 'PDF magic %');
    assert.equal(pdf[1], 0x50, 'PDF magic P');
    assert.ok(pdf.byteLength > 10_000, `real content (${pdf.byteLength} bytes)`);
    const { PDFDocument } = await import('pdf-lib');
    const parsed = await PDFDocument.load(pdf);
    assert.ok(parsed.getPageCount() >= 5, `cover + prologue + 2 chapters + voices + salamat (got ${parsed.getPageCount()})`);
    writeFileSync('/tmp/kwento-magazine-fixture.pdf', pdf);
    console.log(`    → rendered ${parsed.getPageCount()} pages, ${Math.round(pdf.byteLength / 1024)} KB · /tmp/kwento-magazine-fixture.pdf`);
  });

  await test('render: zero kwentos → pure photo-story magazine (no voices page crash)', async () => {
    const caps = Array.from({ length: 6 }, (_, i) => cap(i, T0 + i * MIN));
    const pdf = await buildKwentoMagazine({
      coupleNames: 'A & B',
      eventDateIso: null,
      monogramInitials: 'AB',
      prologueParagraphs: [],
      milestones: [],
      specialMessage: null,
      chapters: bucketMoments(caps),
      kwentos: [],
      images: new Map(),
      totals: { photos: 6, kwentos: 0, guests: null },
    });
    const { PDFDocument } = await import('pdf-lib');
    const parsed = await PDFDocument.load(pdf);
    assert.ok(parsed.getPageCount() >= 3);
  });

  console.log(`\n${passed} passed · ${failed} failed${failed ? ` → ${failures.join(', ')}` : ''}`);
  if (failed > 0) process.exit(1);
}

void main();
