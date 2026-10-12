/**
 * MORE TO COMPARE (owner 2026-10-07 · Suppliers PR2).
 *
 * The marketplace list for a category is always under the couple's own cards in
 * an open row: a heading with a count, the one sort dropdown, and the suppliers'
 * service cards with "Ask for a quote". What can go wrong here goes wrong
 * quietly:
 *
 *   · a list still loading, or one that failed to load, reads "0" / "Nobody";
 *   · a supplier whose name is withheld is named by their own card's title;
 *   · a supplier already on the couple's page is offered to them again;
 *   · the search box filters a category it is not aimed at.
 *
 * Mounting ("always on, never behind a tap") is held by
 * `lib/bench-category-search.test.ts` and `lib/the-bench-card-keeps-everything
 * .test.ts`; the order and the shared-date sink by `lib/inline-more-order.test
 * .ts`. This file holds the rest.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { withholdCardNames, type BenchServiceCard } from '@/lib/bench-service-card';
import {
  INLINE_MORE_FAILED,
  INLINE_MORE_LOADING,
  INLINE_MORE_SAVE_FAILED,
  INLINE_MORE_SIGNED_OUT,
  MORE_TO_COMPARE_SAVE,
  moreToCompareEmpty,
  moreToCompareHeading,
} from '@/lib/explore-info-copy';
import { cardVerbWords } from '@/lib/supplier-card-verbs';

const WEB = join(import.meta.dirname, '..', '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const BENCH = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const ACTION = read('app/dashboard/[eventId]/vendors/_actions/inline-more-row.ts');

/** One component's source — to the next top-level function. */
function bodyOf(marker: string): string {
  const from = BENCH.indexOf(marker);
  assert.ok(from >= 0, `${marker} is gone from the bench`);
  const next = BENCH.indexOf('\nfunction ', from + 1);
  const exported = BENCH.indexOf('\nexport function ', from + 1);
  const end = [next, exported].filter((n) => n > 0).sort((a, b) => a - b)[0];
  return BENCH.slice(from, end);
}
const LIST = bodyOf('function MoreToCompare(');
const CARD = bodyOf('function InlineMoreCard(');
const VERBS = bodyOf('function CompareVerbs(');

test('the scans face real code', () => {
  assert.ok(LIST.length > 4000, `MoreToCompare read as ${LIST.length} chars`);
  assert.ok(CARD.length > 2500, `InlineMoreCard read as ${CARD.length} chars`);
  assert.ok(ACTION.length > 1500);
});

// ── the words ─────────────────────────────────────────────────────────────
test('the heading says "More" only when the couple has someone to compare WITH', () => {
  assert.equal(moreToCompareHeading(true), 'More to compare');
  assert.equal(moreToCompareHeading(false), 'To compare');
});

test('a search that matched nobody and an empty category are different sentences', () => {
  assert.equal(moreToCompareEmpty('Catering', ' lola '), 'Nobody called “lola” in Catering yet — add them as your own.');
  assert.equal(moreToCompareEmpty('Catering', ''), 'Nobody else to compare in Catering yet.');
});

test('the list says supplier, never vendor', () => {
  for (const s of [INLINE_MORE_FAILED, INLINE_MORE_LOADING, INLINE_MORE_SAVE_FAILED, INLINE_MORE_SIGNED_OUT, MORE_TO_COMPARE_SAVE]) {
    assert.ok(!/vendor/i.test(s), `"${s}" says vendor`);
  }
});

// ── a withheld name stays withheld ────────────────────────────────────────
const CARD_A: BenchServiceCard = {
  name: 'Kusina ni Lola · Plated dinner',
  priceText: 'from ₱197,000',
  discountBadge: null,
  includesLine: 'Includes: Tasting for 4',
  notIncluded: ['transport'],
  givesSetnayanGift: true,
  coverUrl: 'https://cdn.example/a.jpg',
};

test('🔑 a supplier whose name is withheld is not named by their own card', () => {
  const cards = { a: CARD_A, b: { ...CARD_A, name: 'Open Kitchen · Buffet' } };
  const out = withholdCardNames(cards, ['a', 'not-in-the-record']);
  assert.equal(out.a?.name, '', 'the title — which carries the business name — crossed to the browser');
  assert.deepEqual({ ...out.a, name: CARD_A.name }, CARD_A, 'everything else on the card is kept');
  assert.equal(out.b?.name, 'Open Kitchen · Buffet', 'a supplier with a revealed name lost their title');
  assert.equal(cards.a.name, CARD_A.name, 'the input was mutated');
});

test('🔑 the action withholds the name on the SERVER, for exactly the anonymized results', () => {
  assert.match(
    ACTION,
    /withholdCardNames\(\s*marketCards,\s*search\.results\.filter\(\(r\) => r\.nameAnonymized\)\.map\(\(r\) => r\.vendorProfileId\),?\s*\)/,
  );
  // …and the list fills the empty name with the category.
  assert.match(CARD, /\{svc\?\.name \|\| label\}/);
});

test('🔑 the action reads cards only for suppliers the search already returned, and never drops them on a later return', () => {
  assert.match(ACTION, /hideUnbookable: true,/, 'the list shows suppliers who cannot be booked on the date');
  assert.match(ACTION, /fetchMarketServiceCards\(\s*createAdminClient\(\),\s*search\.results\.map\(\(r\) => r\.vendorProfileId\),/);
  assert.match(ACTION, /canonicalServicesForTile\(tile as WeddingTile\)/);
  // A failed card read is null all the way to the browser.
  assert.match(ACTION, /const serviceCardByProfileId = marketCards\s*\?\s*withholdCardNames\([\s\S]*?\)\s*:\s*null;/);
  const after = ACTION.slice(ACTION.indexOf('const serviceCardByProfileId = marketCards'));
  const returns = after.match(/return \{.*\};/g) ?? [];
  assert.equal(returns.length, 4, 'expected the four returns after the cards are read');
  for (const r of returns) {
    assert.match(r, /results: search\.results/, 'a return dropped the results');
    assert.match(r, /serviceCardByProfileId\b/, `a return dropped the cards: ${r}`);
  }
});

// ── the list ──────────────────────────────────────────────────────────────
test('🔑 a list still loading, or one that failed, never reads as a count or as "Nobody"', () => {
  assert.match(LIST, /const \[moreLoading, setMoreLoading\] = useState\(true\);/, 'the first frame would say "Nobody"');
  assert.match(LIST, /const counted = !moreError && \(!moreLoading \|\| shown > 0\);/);
  assert.match(LIST, /\{counted \? \(\s*<>\s*\{' '\}\s*· <Count value=\{shown\} id=\{`sup-cmp-\$\{tile\}`\} \/>\s*<\/>\s*\) : null\}/);
  assert.equal((LIST.match(/<Count\b/g) ?? []).length, 1, 'a second, unguarded count');
  // Loading first; then an empty list says "Nobody" ONLY when nothing failed.
  assert.match(
    LIST,
    /\{moreLoading && shown === 0 \? \([\s\S]*?INLINE_MORE_LOADING[\s\S]*?\) : shown === 0 \? \(\s*moreError \? null : \([\s\S]*?moreToCompareEmpty\(label, moreQ\)/,
  );
  assert.match(LIST, /\{moreError \? \(\s*<div className="mrerr" role="alert">/);
  // A failed read clears the cards to null — never to "these suppliers have none".
  const failed = LIST.slice(LIST.indexOf('.catch(() => {'), LIST.indexOf('}, 0);'));
  assert.match(failed, /setMoreCards\(null\);/);
  assert.match(failed, /setMoreError\(INLINE_MORE_FAILED\);/);
});

test('🔑 the list never repeats a supplier already on the couple’s page, and the search reaches only the category in scope', () => {
  assert.match(LIST, /excludeBenchVendors\(moreRows, benchProfileIds, Object\.keys\(moreSaved\)\)/);
  assert.match(BENCH, /benchProfileIds=\{t\.vendors\.map\(\(v\) => v\.marketplaceVendorId\)\}/);
  assert.match(BENCH, /query=\{scopeTile === t\.tile \? scopedQ : ''\}/);
  // One row's list is its own: the request is keyed on this row's tile.
  assert.match(LIST, /\}, \[eventId, moreTile, moreGroupId, moreQ\]\);/);
});

test('🔑 the cards are the suppliers’ service cards, and say nothing about price when the cards were not read', () => {
  assert.match(LIST, /svc=\{moreCards\?\.\[row\.vendorProfileId\] \?\? null\}/);
  assert.match(LIST, /cardsRead=\{moreCards !== null\}/);
  assert.match(LIST, /setMoreCards\(res\.serviceCardByProfileId\);/);
  for (const line of ['svc?.discountBadge', 'svc.priceText', 'svc.includesLine', "svc.notIncluded.join(' · ')"]) {
    assert.ok(CARD.includes(line), `the marketplace card stopped printing ${line}`);
  }
  // The supplier's own name is still printed (the placeholder, when withheld).
  assert.match(CARD, /<span className="vn">\{v\.name\}<\/span>/);
});

test('the verbs follow the button rule: one row, Ask for a quote is the main verb, no hand-made button', () => {
  assert.equal(cardVerbWords('ask').label, 'Ask for a quote');
  assert.match(VERBS, /const ask = cardVerbWords\('ask'\);/);
  assert.match(VERBS, /<ActionButton tone=\{ask\.tone\} main icon=\{MessageCircle\} label=\{ask\.label\} disabled=\{busy\} onClick=\{onInquire\} \/>/);
  assert.match(VERBS, /<ActionButton tone="neutral" icon=\{Bookmark\} label=\{MORE_TO_COMPARE_SAVE\} disabled=\{busy\} onClick=\{onSave\} \/>/);
  assert.equal((VERBS.match(/\bmain\b/g) ?? []).length, 1, 'two main verbs on one card');
  for (const [name, body] of [['the card', CARD], ['its verb row', VERBS], ['the list', LIST]] as const) {
    assert.ok(!/<button\b/.test(body), `a hand-made button in ${name}`);
  }
  // 🪤 The row is fitted by the component that DRAWS it. `useFitRow` measures
  // once, on mount — called from the card, the ref is dead after an Undo.
  assert.match(VERBS, /const rowRef = useRef<HTMLDivElement>\(null\);\s*useFitRow\(rowRef\);/);
  assert.match(VERBS, /<div ref=\{rowRef\} className="verbs" data-compare-verbs="">/);
  assert.ok(!/useFitRow/.test(CARD), 'the card fits a row it only sometimes draws');
  assert.match(CARD, /<CompareVerbs busy=\{busy\} onSave=\{onSave\} onInquire=\{onInquire\} \/>/);
});

test('the sort is the bench’s ONE dropdown, and the full sheet is still one tap away', () => {
  assert.equal((BENCH.match(/label="Sort by"/g) ?? []).length, 1, 'a second sort control');
  assert.match(BENCH, /sortMenu=\{sortMenu\}/);
  assert.match(LIST, /<div className="morehead">[\s\S]*?\{sortMenu\}\s*<\/div>/);
  assert.match(BENCH, /onSeeAll=\{\(\) => openSearch\(t\.tile, t\.label\)\}/);
  assert.match(LIST, /label=\{inlineMoreSeeAllLabel\(label\)\}\s*onClick=\{onSeeAll\}/);
});
