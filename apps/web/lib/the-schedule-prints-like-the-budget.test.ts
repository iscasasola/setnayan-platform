/**
 * the-schedule-prints-like-the-budget.test.ts — 📤 THE SCHEDULE'S PRINT IS THE BUDGET PDF.
 *
 * Owner 2026-11-01: *"just like our budget design pdf. do the same for  schedule"* (DECISION_LOG "THE SCHEDULE PRINTS
 * LIKE THE BUDGET PDF"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b). Not a new print system — the shared engine.
 *
 *   1 · the file is drawn by the shared engine and carries chapters as sections, moments as rows, real counts;
 *   2 · a chapter with no moments yet still prints its own line — nothing on the schedule is left off;
 *   3 · a refused read is refused, never a file of zeros or blank "who";
 *   4 · the route gates on the Schedule's own access before it reads a moment, and answers a PDF;
 *   5 · the Schedule offers ONE Share, the shared button, on the page and under Booked, with Paper ▾.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { stripComments } from '@/lib/strip-comments';
import { ScheduleUnreadError, scheduleDoc, scheduleFigures, schedulePdf, type SchedulePdfBlock } from '@/lib/schedule-pdf';

const WEB = join(__dirname, '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

const D = '2026-12-18';
const B = (id: string, label: string, h: number, m: number, parent: string | null = null, location: string | null = null, mins = 30): SchedulePdfBlock => {
  const start = new Date(Date.UTC(2026, 11, 18, h, m));
  return { block_id: id, parent_block_id: parent, label, start_at: start.toISOString(), end_at: new Date(start.getTime() + mins * 60_000).toISOString(), location };
};
const BLOCKS: SchedulePdfBlock[] = [
  B('prep', 'Preparation', 8, 0, null, 'Seda Vertis North', 240),
  B('hmua', 'Hair & makeup', 8, 0, 'prep', 'Bridal suite', 180),
  B('cer', 'Ceremony', 14, 0, null, 'San Agustin Church', 90),
  B('proc', 'Processional', 14, 0, 'cer'),
  B('vows', 'Vows', 14, 30, 'cer'),
  B('rec', 'Reception', 18, 0, null, 'Seda Vertis North', 240), // no moments yet
];
const SUPPLIERS = new Map<string, string[]>([['hmua', ['v-glam']], ['proc', ['v-photo', 'v-music']], ['vows', ['v-photo']]]);
const WHO = new Map<string, string[]>([['hmua', ['Glam Studio']], ['proc', ['Lumière Photo', 'Strings Trio']], ['vows', ['Lumière Photo']]]);
const BASE = { eventName: 'Rosa & Ben', eventDate: 'Friday · December 18, 2026', blocks: BLOCKS, who: WHO, supplierIds: SUPPLIERS, generatedAt: new Date('2026-11-01T03:00:00Z') };

async function words(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents && 'asArray' in contents ? (contents as unknown as { asArray(): unknown[] }).asArray() : [contents];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.contents);
      const text = (stream.dict.get(PDFName.of('Filter')) ? inflateSync(raw) : raw).toString('latin1');
      for (const m of text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(m[1]!, 'hex').toString('latin1'));
    }
  }
  return out.join(' | ');
}

test('1 · chapters are sections, moments are rows (time · what · who), and page 1 carries real counts', async () => {
  assert.deepEqual(scheduleFigures(BLOCKS, SUPPLIERS), { chapters: 3, moments: 3, venues: 3, suppliers: 3 });
  const doc = scheduleDoc(BASE);
  assert.equal(doc.kind, 'Schedule');
  assert.deepEqual(doc.summary?.figures.map((f) => `${f.label} ${f.value}`), ['Chapters 3', 'Moments 3', 'Venues 3', 'Suppliers 3']);
  assert.deepEqual(doc.sections.map((s) => s.title), ['Preparation', 'Ceremony', 'Reception']);
  const cer = doc.sections[1]!;
  assert.match(cer.aside ?? '', /2:00 – 3:30 PM · San Agustin Church/);
  assert.deepEqual(cer.rows.map((r) => r.main), ['2:00 – 2:30 PM · Processional', '2:30 – 3:00 PM · Vows']);
  assert.deepEqual(cer.rows[0]!.cells, [{ text: 'Lumière Photo, Strings Trio', tone: 'soft' }]);
  // On the shared engine — the file really holds the words.
  const text = await words(await schedulePdf(BASE));
  for (const w of ['SCHEDULE', 'Rosa & Ben', 'CHAPTERS', 'Ceremony', 'Vows', 'Page 1 of']) assert.ok(text.toUpperCase().includes(w.toUpperCase()), `the file lacks “${w}”`);
});

test('2 · a chapter with no moments yet prints its own line; Include names off drops Who', () => {
  const rec = scheduleDoc(BASE).sections[2]!;
  assert.deepEqual(rec.rows.map((r) => r.main), ['6:00 – 10:00 PM · Reception']);
  const bare = scheduleDoc({ ...BASE, includeNames: false });
  assert.ok(bare.sections.every((s) => s.columns.length === 0 && s.rows.every((r) => r.cells.length === 0)), 'names printed with the switch off');
});

test('3 · a refused read is refused — never a schedule of zeros or a blank Who', () => {
  for (const gone of [{ blocks: null }, { who: null }, { supplierIds: null }]) {
    assert.throws(() => scheduleDoc({ ...BASE, ...gone }), ScheduleUnreadError, `printed with ${Object.keys(gone)[0]} unread`);
  }
});

test('4 · the route gates on the Schedule’s access before reading a moment, and answers a PDF', () => {
  const route = read('app', 'api', 'schedule', '[eventId]', 'export', 'route.ts');
  const gate = route.search(/viewerAreaLevel\(viewer, 'schedule'\) === null/);
  const firstRead = route.search(/fetchScheduleBlocks\(/);
  assert.ok(gate > 0 && firstRead > gate, 'moments are read before the access gate');
  assert.match(route, /readBlockRosMeta\(/, 'who-does-what is read through a reader that swallows its refusal');
  assert.match(route, /if \(!blocks \|\| !meta\) return unread\(\);/, 'a refused read draws a file');
  assert.match(route, /schedulePdf\(/);
  assert.match(route, /sharePdfPaper\(q\.get\('paper'\)\)/, 'Paper ▾ is not read');
  assert.match(route, /'Content-Type': 'application\/pdf'/);
});

test('5 · the Schedule offers one Share — the shared button — on its page and under Booked', () => {
  const page = read('app', 'dashboard', '[eventId]', 'schedule', 'page.tsx');
  assert.equal(page.match(/<SharePdfButton\b/g)?.length, 1, 'the Schedule must build ONE Share');
  assert.match(page, /<SharePdfButton\s+href=\{`\/api\/schedule\/\$\{eventId\}\/export`\}[\s\S]*?papers="document"/);
  assert.match(page, /share=\{shareSchedule\}/, 'Booked › Schedule lost its Share');
  assert.match(page, /<Tip align="end">\{viewNote\}<\/Tip>\s*\{shareSchedule\}/, 'the Schedule page lost its Share');
  const frame = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'schedule-one-line.tsx');
  assert.match(frame, /\{share \? <span className="ml-auto">\{share\}<\/span> : null\}/, 'the frame does not draw the Share');
});
