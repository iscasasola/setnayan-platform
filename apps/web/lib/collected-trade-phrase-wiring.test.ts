/**
 * GUARD — the WIRING for "it remembers what suppliers confirm" (C3,
 * 2026-08-28): that the collection mechanism is actually connected the way
 * its docblocks say, not merely that the pure logic in
 * collected-trade-phrase.test.ts is correct in isolation.
 *
 * Pinned here, each separate on purpose:
 *   1. the maker imports the shared miss-detector — never a second copy of
 *      the "Nothing matches" condition;
 *   2. the on-screen message and the miss-tracking effect both key off the
 *      SAME derived value (`kindSearchMissed`) — no drift between what the
 *      supplier is told and what gets remembered;
 *   3. every KindPill.onPick in the kind sheet routes through ONE picker;
 *   4. the hidden field only ever carries what the client believes is
 *      collectible — never the raw kindQuery;
 *   5. commitVendorService re-validates the posted category against the
 *      live taxonomy BEFORE calling the writer — the browser's claim is
 *      never trusted alone;
 *   6. the write always lands unreviewed, on the admin client, with
 *      ON CONFLICT DO NOTHING — never overwrites an existing row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const ACTIONS = 'app/vendor-dashboard/services/actions.ts';
const ALIAS_DB = 'lib/service-trade-aliases-db.ts';
const MISS_LIB = 'lib/collected-trade-phrase.ts';

test('the files under test actually read back', () => {
  for (const p of [MAKER, ACTIONS, ALIAS_DB, MISS_LIB]) {
    assert.ok(read(p).length > 200, `${p} read back empty or missing`);
  }
});

// ---------------------------------------------------------------------------
// 1 · THE MAKER IMPORTS THE SHARED MISS-DETECTOR, NEVER A SECOND COPY
// ---------------------------------------------------------------------------

test('the maker imports isTradeSearchMiss and collectiblePhraseFor, not a reimplementation', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /import \{ isTradeSearchMiss, collectiblePhraseFor \} from '@\/lib\/collected-trade-phrase';/,
    'canvas-maker.tsx stopped importing the shared miss-detection helpers',
  );
});

test('no other file re-derives the four-part "nothing matches" condition', () => {
  // The distinctive shape of the ORIGINAL inline condition this session
  // replaced: `categoryOptions.every(...o.standing === 'covered' || ...)`.
  // A second copy of it anywhere would mean the message and the collection
  // hook can disagree about what counts as a miss.
  const src = read(MAKER);
  const shapeCount = (src.match(/g\.options\.every\(/g) ?? []).length;
  assert.equal(
    shapeCount,
    0,
    'a second "every option fails to match" condition reappeared in the maker — ' +
      'the miss must be decided ONCE, by isTradeSearchMiss, and reused',
  );
});

// ---------------------------------------------------------------------------
// 2 · ONE DERIVED VALUE DRIVES BOTH THE MESSAGE AND THE MISS TRACKING
// ---------------------------------------------------------------------------

test('the "Nothing matches" message renders off kindSearchMissed, not a fresh condition', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /\{kindSearchMissed \? \(/,
    'the on-screen miss message stopped keying off kindSearchMissed',
  );
});

test('kindSearchMissed is computed via isTradeSearchMiss', () => {
  const src = read(MAKER);
  const start = src.indexOf('const kindSearchMissed');
  assert.ok(start >= 0, 'kindSearchMissed is missing');
  const body = src.slice(start, start + 300);
  assert.match(body, /isTradeSearchMiss\(/, 'kindSearchMissed does not call isTradeSearchMiss');
});

test('lastMissedQuery is only ever set from kindSearchMissed', () => {
  const src = read(MAKER);
  const start = src.indexOf('const [lastMissedQuery');
  assert.ok(start >= 0, 'lastMissedQuery state is missing');
  const body = src.slice(start, start + 500);
  assert.match(body, /if \(kindSearchMissed\)/, 'the miss-tracking effect stopped reading kindSearchMissed');
});

// ---------------------------------------------------------------------------
// 3 · EVERY PICK ROUTES THROUGH ONE FUNCTION
// ---------------------------------------------------------------------------

test('every KindPill.onPick in the kind sheet calls pickCategory — none calls setCategory directly', () => {
  const src = read(MAKER);
  const onPickBlocks = src.match(/onPick=\{\(\) => \{[\s\S]*?\}\}/g) ?? [];
  assert.ok(onPickBlocks.length >= 3, `expected at least 3 onPick handlers, found ${onPickBlocks.length}`);
  for (const block of onPickBlocks) {
    assert.doesNotMatch(
      block,
      /setCategory\(/,
      'an onPick handler calls setCategory directly instead of pickCategory — ' +
        'collectPhrase can drift out of sync with what was actually picked',
    );
    assert.match(block, /pickCategory\(/, 'an onPick handler does not call pickCategory at all');
  }
});

test('pickCategory is the only setter of collectPhrase besides its own declaration', () => {
  const src = read(MAKER);
  const setterCalls = (src.match(/setCollectPhrase\(/g) ?? []).length;
  // One inside pickCategory's own body, one for the state hook's own useState
  // call does not count (that's `useState<string \| null>(null)`, no setter
  // call). So exactly 1 call site is expected.
  assert.equal(setterCalls, 1, `expected exactly 1 setCollectPhrase(...) call, found ${setterCalls}`);
});

// ---------------------------------------------------------------------------
// 4 · THE HIDDEN FIELD CARRIES collectPhrase, NEVER THE RAW QUERY
// ---------------------------------------------------------------------------

test('the posted field is collected_kind_phrase, sourced from collectPhrase state', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /name="collected_kind_phrase" value=\{collectPhrase \?\? ''\}/,
    'the hidden collected_kind_phrase field stopped reading collectPhrase',
  );
  assert.doesNotMatch(
    src,
    /name="collected_kind_phrase" value=\{kindQuery/,
    'the hidden field posts the raw live kindQuery instead of the vetted collectPhrase — ' +
      'that would post whatever is currently typed, not only a genuine confirmed miss',
  );
});

// ---------------------------------------------------------------------------
// 5 · THE ACTION RE-VALIDATES SERVER-SIDE BEFORE WRITING
// ---------------------------------------------------------------------------

test('commitVendorService checks isCoverageLeafKind before ever calling recordCollectedTradePhrase', () => {
  const src = read(ACTIONS);
  const start = src.indexOf('collected_kind_phrase');
  assert.ok(start >= 0, 'commitVendorService no longer reads collected_kind_phrase');
  const block = src.slice(start, start + 700);
  assert.match(
    block,
    /isCoverageLeafKind\(category, collectLeaves\)/,
    'the collect hook does not re-validate `category` against the live taxonomy — ' +
      'a tampered hidden field could queue an arbitrary pairing',
  );
  assert.match(
    block,
    /recordCollectedTradePhrase\(/,
    'the collect hook is present but never calls recordCollectedTradePhrase',
  );
});

test('the collect write happens fire-and-forget, via after(), never awaited inline', () => {
  const src = read(ACTIONS);
  const start = src.indexOf('recordCollectedTradePhrase(');
  assert.ok(start >= 0);
  const before = src.slice(Math.max(0, start - 40), start);
  assert.match(before, /after\(\(\) => $/, 'recordCollectedTradePhrase is not wrapped in after(() => ...)');
});

test('the collect hook runs strictly after the RPC succeeds, not before', () => {
  const src = read(ACTIONS);
  const rpcAt = src.indexOf("createAdminClient().rpc('save_vendor_service'");
  const errAt = src.indexOf('if (error) return back(error.message);');
  const collectAt = src.indexOf('collected_kind_phrase');
  assert.ok(rpcAt >= 0 && errAt >= 0 && collectAt >= 0);
  assert.ok(rpcAt < errAt, 'the RPC call moved after the error check');
  assert.ok(errAt < collectAt, 'the collect hook runs before the save is confirmed to have succeeded');
});

// ---------------------------------------------------------------------------
// 6 · THE WRITE ITSELF: UNREVIEWED, ADMIN CLIENT, NO OVERWRITE
// ---------------------------------------------------------------------------

test('recordCollectedTradePhrase never sets reviewed_at — a collected row always lands unreviewed', () => {
  const src = read(ALIAS_DB);
  const start = src.indexOf('export async function recordCollectedTradePhrase');
  assert.ok(start >= 0, 'recordCollectedTradePhrase is missing');
  const body = src.slice(start);
  assert.doesNotMatch(
    body,
    /reviewed_at\s*:/,
    'recordCollectedTradePhrase sets reviewed_at — a collected phrase must always start unreviewed, ' +
      'same as a mined one, so it answers nobody until an admin approves it',
  );
  assert.match(body, /source:\s*'collected'/, "the written row must be marked source: 'collected'");
});

test('recordCollectedTradePhrase writes through the admin client, never the session client', () => {
  const src = read(ALIAS_DB);
  const start = src.indexOf('export async function recordCollectedTradePhrase');
  const body = src.slice(start);
  assert.match(body, /createAdminClient\(\)/, 'recordCollectedTradePhrase does not use the admin client');
});

test('recordCollectedTradePhrase never overwrites an existing phrase — onConflict + ignoreDuplicates', () => {
  const src = read(ALIAS_DB);
  const start = src.indexOf('export async function recordCollectedTradePhrase');
  const body = src.slice(start);
  assert.match(body, /onConflict:\s*'phrase'/, "the upsert is not keyed on the table's UNIQUE(phrase)");
  assert.match(body, /ignoreDuplicates:\s*true/, 'the upsert can overwrite an existing row — must ignore duplicates');
});

test('recordCollectedTradePhrase reuses normalisePhrase, never a second normaliser', () => {
  const src = read(ALIAS_DB);
  assert.match(
    src,
    /normalisePhrase/,
    'recordCollectedTradePhrase does not reuse normalisePhrase',
  );
  const start = src.indexOf('export async function recordCollectedTradePhrase');
  const body = src.slice(start);
  assert.doesNotMatch(
    stripComments(body),
    /\.toLowerCase\(\)\.replace\(\/\\s\+\/g/,
    'recordCollectedTradePhrase grew its own copy of the normalisation logic',
  );
});
