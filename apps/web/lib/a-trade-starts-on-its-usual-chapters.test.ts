/**
 * a-trade-starts-on-its-usual-chapters.test.ts — 📖 event chapters slice 2 (owner 2026-11-04; approved prototype
 * "Event chapters — 4 Nov 2026", frames 2, 5, 6):
 *
 *   1 · a trade's usual chapters are read from the category (`service_categories.default_chapters`) and matched to the
 *       event's chapters by their kind, then by their default name — never a guessed set when the read is refused;
 *   2 · once a supplier is booked and on no chapter, ONE sheet asks "Which chapters will they serve?", prefilled from
 *       them; nothing is written before Confirm, and Confirm writes through the one door (`set_supplier_where`);
 *   3 · the Booked count reads "1 needs a chapter" / "2 need a chapter";
 *   4 · a chapter lists "Suppliers in this chapter" — on it, its moments or their tasks — then the coordinators;
 *   5 · Admin › Categories edits the usual chapters through the one map write.
 * The database half: tests/db/a-trade-starts-on-its-usual-chapters.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { defaultKeyOf, keysForGroup, suggestedChapters, tradeChaptersFrom } from '@/lib/trade-chapters';
import type { WhereChapter } from '@/lib/supplier-where';
import { chapterSupplierLine, chapterSuppliers } from '@/lib/schedule-chapters';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

const ch = (blockId: string, name: string, kind: string | null): WhereChapter => ({ blockId, name, kind, location: null, startAt: null, tags: [] });
const DAY = [ch('p', 'Prep', 'pre_ceremony'), ch('c', 'Ceremony', 'ceremony'), ch('r', 'Cocktail + Reception', 'reception'), ch('a', 'After Party', 'after_party'), ch('x', 'Despedida', 'custom')];

test('1 · the usual chapters come from the category and match the event’s chapters', () => {
  const byCat = tradeChaptersFrom([
    { coarse_category: 'catering', default_chapters: ['cocktail_reception'] },
    { coarse_category: 'catering', default_chapters: ['cocktail_reception', 'bogus'] },
    { coarse_category: 'photographer', default_chapters: ['after_party', 'prep'] },
    { coarse_category: null, default_chapters: ['prep'] },
  ]);
  assert.deepEqual(byCat.get('catering'), ['cocktail_reception'], 'a junk key or a duplicate survived');
  assert.deepEqual(byCat.get('photographer'), ['prep', 'after_party'], 'not in chapter order');
  // The owner's own example: catering = Cocktail + Reception.
  assert.deepEqual(suggestedChapters(DAY, keysForGroup('catering', byCat)), ['r']);
  assert.deepEqual(suggestedChapters(DAY, keysForGroup('catering', null)), [], 'a refused read guessed a set');
  assert.deepEqual(suggestedChapters(DAY, keysForGroup('nope', byCat)), []);
  // A chapter the host made and named like a default still matches; a custom one never does.
  assert.equal(defaultKeyOf({ name: 'Ceremony', kind: 'custom' }), 'ceremony');
  assert.equal(defaultKeyOf({ name: 'Reception', kind: 'custom' }), 'cocktail_reception');
  assert.equal(defaultKeyOf({ name: 'Despedida', kind: 'custom' }), null);
  // The Booked view carries it, read once with the rest.
  const slot = code('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx');
  assert.match(slot, /readTradeChapters\(supabase\)/, 'Booked no longer reads the usual chapters');
  assert.match(slot, /tradeChapters: trade\.ok \? trade\.byCategory : null/, 'a refused read is used as an answer');
});

test('2 · the ask: one sheet, prefilled, nothing saved before Confirm, the one door', () => {
  const where = code('app/dashboard/[eventId]/vendors/_components/booked-where.tsx');
  const ask = where.slice(where.indexOf('export function WhereAsk'));
  assert.match(ask, /r\.where\?\.kind === 'set' && r\.where\.needsOne && !skipped\.has\(r\.vendorId\)/, 'the sheet asks someone who already has chapters');
  assert.match(ask, /initial=\{row\.suggestWhere/, 'the sheet is not prefilled from the trade');
  const sheet = ask.slice(ask.indexOf('function WhereAskSheet'));
  const pick = sheet.slice(sheet.indexOf('onPick='), sheet.indexOf('buttonText='));
  assert.doesNotMatch(pick, /saveWhere|setWhere|onConfirm/, 'a tick saves before Confirm');
  assert.match(ask, /standIn\.setWhere \? await standIn\.setWhere\(args\) : await saveWhere\(args\)/, 'Confirm writes some other way');
  assert.match(where, /WHERE_ASK_WORDS\.question/);
  assert.match(code('lib/supplier-where.ts'), /question: 'Which chapters will they serve\?'/);
  const body = code('app/dashboard/[eventId]/vendors/_components/booked-body.tsx');
  assert.match(body, /<WhereAsk eventId=\{eventId\} rows=\{booked\} \/>/, 'the Booked body does not ask');
});

test('3 · "1 needs a chapter"', () => {
  const body = code('app/dashboard/[eventId]/vendors/_components/booked-body.tsx');
  assert.match(body, /\{formatCount\(needWhere\)\} \{needWhere === 1 \? 'needs' : 'need'\} a chapter/);
});

test('4 · suppliers in this chapter — on it, its moments or their tasks, then the coordinators', () => {
  const suppliers = [
    { id: 'bc', name: 'Bituin Catering', trade: 'Catering' },
    { id: 'ls', name: 'Lumina Studio', trade: 'Photographer' },
    { id: 'kd', name: 'Key Designs', trade: 'Reception decor' },
    { id: 'pe', name: 'Paloma Events', trade: 'Coordinator', everyChapter: true },
    { id: 'zz', name: 'Elsewhere Band', trade: 'Band' },
  ];
  const got = chapterSuppliers(
    { block_id: 'r', vendor_ids: ['bc'] },
    [{ block_id: 'm1', parent_block_id: 'r', vendor_ids: ['ls'] }, { block_id: 'm9', parent_block_id: 'other', vendor_ids: ['zz'] }],
    [{ block_id: 'm1', vendor_id: 'kd' }, { block_id: 'm9', vendor_id: 'zz' }],
    suppliers,
  );
  assert.deepEqual(got.map((s) => s.id), ['bc', 'ls', 'kd', 'pe']);
  assert.equal(chapterSupplierLine(got[3]!), 'Coordinator · every chapter');
  assert.equal(chapterSupplierLine(got[0]!), 'Catering');
  const host = code('app/dashboard/[eventId]/schedule/_components/chapters-host.tsx');
  assert.match(host, /suppliers=\{chapterSuppliers\(current, moments, tasks, who\.suppliers\)\}/, 'the chapter page is not handed its suppliers');
  assert.match(host, /Suppliers in this chapter <Tip>/);
});

test('5 · Admin › Categories edits the usual chapters through the one map write', () => {
  const actions = code('app/admin/categories/four-level-actions.ts');
  assert.match(actions, /case 'defaultChapter':\s*return asAdmin\(\(a\) => setDefaultChapterCore\(/, 'the usual chapters have no admin door');
  const writes = code('app/admin/categories/_components/taxonomy-writes.ts');
  const fn = writes.slice(writes.indexOf('export async function setDefaultChapterCore'));
  assert.match(fn, /from\('service_categories'\)\.update\(\{ default_chapters: next/, 'the write goes somewhere else');
  assert.match(fn, /audit\(admin, \{ action: 'taxonomy\.set_default_chapters'/, 'a change is not audited');
  assert.match(code('app/admin/categories/_components/category-panels.tsx'), /title="Usual chapters"/);
});
