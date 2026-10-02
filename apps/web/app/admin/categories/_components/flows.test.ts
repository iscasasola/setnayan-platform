/**
 * flows.test.ts — the four flows the approved prototype draws
 * (prototypes/supplier_categories_simple_2026-10-02_fable.html), held at the
 * ACTION level: each flow's form posts every field its shipped action reads
 * (measured from the generated job list, never hand-typed), and the rule the
 * action runs is executed here directly.
 *
 *   A · Add a service in one step — the near matches come first
 *   B · Approve a supplier's request by mapping it — closest service first;
 *       the supplier's word waits as a search word
 *   C · Change which event types a category shows for — set on the event
 *       type, read back on the category in the same words
 *   D · Add a religion and choose what it affects — "Asked on", read back on
 *       the event type
 *
 * SABOTAGE PERFORMED AND UNDONE, one per flow: (A) nearMatches stopped at the
 * whole-name rank; (B) the closest-first ordering was reversed; (C)
 * nextEventTypes returned the list unchanged; (D) religionsAskedOn ignored the
 * NULL-means-wedding rule. Each turned its flow red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import { nextEventTypes } from '@/lib/event-type-scope';
import {
  mapTargetsClosestFirst,
  nearMatches,
  offeredCount,
  religionKeyFromName,
  religionsAskedOn,
  showsForLabel,
  toggleAskedOn,
  type Category,
  type Religion,
  type Service,
  type SupplierRequest,
} from './model';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

function job(name: string) {
  const j = ADMIN_JOBS.find((x) => x.name === name);
  assert.ok(j, `${name} is not a known admin job — regenerate admin-jobs.generated.ts`);
  assert.equal(j!.resolvedPath, '/admin/categories', `${name} no longer lives on /admin/categories`);
  return j!;
}

/** The body of one exported action in a 'use server' file. */
function actionBody(file: string, name: string): string {
  const src = read(file);
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from ${file}`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

// ── A · Add a service in one step ───────────────────────────────────────────

const TRADES = [
  { key: 'sorbetes_cart', label: 'Sorbetes Cart', tileId: 'food_cart', aliases: [] as string[] },
  { key: 'ice_cream_cart', label: 'Ice Cream Cart', tileId: 'food_cart', aliases: [] as string[] },
  { key: 'halo_halo_station', label: 'Halo-halo Station', tileId: 'stations', aliases: [] as string[] },
  { key: 'catering', label: 'Catering', tileId: 'catering', aliases: [] as string[] },
];

test('A · the near matches for a whole new name are found word by word', () => {
  const near = nearMatches('Dirty ice cream cart', TRADES);
  const keys = near.map((n) => n.key);
  assert.equal(keys[0], 'ice_cream_cart', `the closest trade is not first: ${keys.join(', ')}`);
  assert.ok(keys.includes('sorbetes_cart'), 'a cart that shares a word was missed');
  assert.ok(!keys.includes('catering'), 'a trade sharing no word was offered as close');
  // …and "Goes under" is suggested from the closest trade's category.
  assert.equal(near[0]!.tileId, 'food_cart');
});

test('A · the + Add row posts every field createCanonicalLeaf refuses without, to that action', () => {
  const src = read('add-rows.tsx');
  assert.match(src, /action=\{isNewCategory \? createTaxonomyNode : createCanonicalLeaf\}/);
  for (const field of job('createCanonicalLeaf').refusedWhenEmpty) {
    assert.ok(src.includes(`name="${field}"`), `the add row never posts ${field}, which createCanonicalLeaf refuses without`);
  }
  for (const field of ['faith', 'is_ph', 'is_rental', 'is_tradition']) {
    assert.ok(job('createCanonicalLeaf').fields.includes(field), `createCanonicalLeaf no longer reads ${field}`);
    assert.ok(src.includes(`name="${field}"`), `the add row lost its ${field} control`);
  }
  // The honest alternative is one press away: a search word on the trade we have.
  assert.match(src, /action=\{addTradeAlias\}/);
});

test('A · saving says where it is live', () => {
  assert.match(actionBody('../actions.ts', 'createCanonicalLeaf'), /is live under \$\{tile\.label_en \?\? tileId\}\. Suppliers can pick it now\./);
});

// ── B · Approve a request by mapping it ────────────────────────────────────

const SERVICES: Service[] = TRADES.map((t) => ({
  canonical: t.key,
  en: t.label,
  tl: null,
  tileId: t.tileId,
  faith: null,
  ph: false,
  rental: false,
  tradition: false,
  hidden: false,
  dietary: null,
  secondaryTiles: [],
  eventTypes: null,
  schemaVersion: 1,
  sharedGroups: [],
  fields: [],
  words: [],
  askedFor: 0,
}));

const SORBETERO: SupplierRequest = {
  requestId: 'r1',
  proposedLabel: 'Sorbetero',
  proposedNote: null,
  supplierName: 'Mang Kanor’s Sorbetes',
  draft: {
    suggestedLabel: 'Sorbetes cart',
    suggestedTileId: 'food_cart',
    suggestedTileLabel: 'Food Cart',
    tileReason: null,
    verdict: 'existing',
    closestExisting: { canonical: 'sorbetes_cart', label: 'Sorbetes Cart' },
    nearMatches: [{ canonical: 'ice_cream_cart', label: 'Ice Cream Cart', whyNot: 'not the native kind' }],
    draftedBy: 'lexical',
  },
};

test('B · Map to ▾ lists the closest service first, then the near matches, then its category', () => {
  const t = mapTargetsClosestFirst(SORBETERO, SERVICES);
  assert.deepEqual(
    t.slice(0, 2).map((x) => x.canonical),
    ['sorbetes_cart', 'ice_cream_cart'],
  );
  assert.equal(t[0]!.closest, true, 'the closest service is not marked');
  assert.equal(t.filter((x) => x.closest).length, 1);
  assert.equal(new Set(t.map((x) => x.canonical)).size, SERVICES.length, 'a service is listed twice or missing');
});

test('B · Map to ▾ posts exactly what mapCategoryRequest reads', () => {
  const src = read('request-controls.tsx');
  for (const field of job('mapCategoryRequest').fields) {
    assert.ok(src.includes(`fd.set('${field}'`), `the map pick never posts ${field}`);
  }
});

test('B · mapping refuses an already-resolved request, then leaves the supplier’s word WAITING', () => {
  const body = actionBody('../actions.ts', 'mapCategoryRequest');
  const refuse = body.indexOf("if (!mapped) redirectBack(formData, 'error'");
  const record = body.indexOf('recordCollectedTradePhrase(mapped.proposed_label, canonical)');
  assert.ok(refuse > 0, 'a zero-row map (already resolved) reports success again');
  assert.ok(record > refuse, 'the search word is recorded before the map is known to have happened');
  const lib = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', 'lib', 'service-trade-aliases-db.ts'), 'utf8'));
  assert.match(lib, /source: 'collected'/, 'a collected word is no longer marked collected');
  assert.doesNotMatch(lib.slice(lib.indexOf('export async function recordCollectedTradePhrase')), /reviewed_at/, 'a collected word lands reviewed — it would answer suppliers before a person said yes');
});

// ── C · Which event types a category shows for ─────────────────────────────

const ACTIVE = ['wedding', 'birthday', 'christening'];
const cat = (id: string, eventTypes: string[] | null): Category => ({
  id,
  groupId: 'feast',
  label: id,
  slug: id,
  iconName: null,
  photoRaw: null,
  photoUrl: null,
  eventTypes,
  hidden: false,
  sortOrder: 0,
  serviceCount: 0,
  faithCount: 0,
  refinementCount: 0,
});

test('C · offering Cake for a Birthday moves the count and the category reads it back', () => {
  const before = [cat('cake', ['wedding']), cat('catering', null), cat('stations', ['wedding'])];
  assert.equal(offeredCount(before, 'birthday').offered, 1);
  const cakeNext = nextEventTypes(['wedding'], 'birthday', true, ACTIVE);
  assert.deepEqual(cakeNext, ['wedding', 'birthday']);
  const after = [cat('cake', cakeNext), before[1]!, before[2]!];
  assert.equal(offeredCount(after, 'birthday').offered, 2, 'the event type count did not move');
  const labels = [
    { key: 'wedding', label: 'Wedding' },
    { key: 'birthday', label: 'Birthday' },
  ];
  assert.equal(showsForLabel(cakeNext, labels), 'Wedding · Birthday', 'the category reads it back in other words');
  // Hiding it again goes back; hiding a universal category materialises "all but".
  assert.deepEqual(nextEventTypes(cakeNext, 'birthday', false, ACTIVE), ['wedding']);
  assert.deepEqual(nextEventTypes(null, 'birthday', false, ACTIVE), ['wedding', 'christening']);
});

test('C · the link is edited on the event type ONLY, and read-only on the category', () => {
  const panel = read('event-type-panel.tsx');
  assert.match(panel, /action=\{setTileEventTypeOffered\}\s*keyField="tile_id"\s*onField="offered"/);
  assert.match(panel, /hidden=\{\{ \.\.\.back, event_type: eventType \}\}/);
  for (const field of job('setTileEventTypeOffered').fields) {
    assert.ok(['tile_id', 'offered', 'event_type'].includes(field), `setTileEventTypeOffered now reads ${field}, which the pick never posts`);
  }
  const cats = read('category-panels.tsx');
  assert.match(cats, /showsForLabel\(category\.eventTypes, data\.eventLabels\)/);
  assert.doesNotMatch(cats, /setTileEventTypeOffered|setFolderEventTypeOffered|applicable_event_types/, 'the category panel grew a second editor for the same link');
});

// ── D · Add a religion and choose what it affects ──────────────────────────

const religion = (key: string, askedOn: string[] | null): Religion => ({
  key,
  label: key,
  status: 'active',
  isCivil: false,
  sortOrder: 0,
  askedOn,
  ceremonyType: null,
  launch: null,
});

test('D · a new religion gets its key from the name, and the add row posts what createFaithVocab reads', () => {
  assert.equal(religionKeyFromName('methodist'), 'Methodist');
  assert.equal(religionKeyFromName('born again'), 'Born Again');
  assert.equal(religionKeyFromName('INC'), 'INC', 'an acronym was re-cased');
  const src = read('add-rows.tsx');
  assert.match(src, /action=\{createFaithVocab\}/);
  for (const field of job('createFaithVocab').fields) {
    assert.ok(src.includes(`name="${field}"`), `the add row never posts ${field}`);
  }
});

test('D · "Asked on" is set on the religion and read back on the event type', () => {
  const methodist = religion('Methodist', null);
  // NULL = wedding only, exactly what every religion meant before the column.
  assert.deepEqual(
    religionsAskedOn([religion('Catholic', null), methodist], 'wedding').map((r) => r.key),
    ['Catholic', 'Methodist'],
  );
  assert.deepEqual(religionsAskedOn([methodist], 'christening'), []);
  const next = toggleAskedOn(methodist, 'christening');
  assert.deepEqual(next, ['christening', 'wedding'], 'adding a type dropped the wedding');
  const after = religion('Methodist', next);
  assert.equal(religionsAskedOn([after], 'christening').length, 1);
  assert.deepEqual(toggleAskedOn(after, 'wedding'), ['christening']);

  const panel = read('religion-panel.tsx');
  assert.match(panel, /action=\{setFaithAskedOn\}\s*field="event_types"/);
  assert.ok(job('setFaithAskedOn').fields.includes('faith_key'));
  assert.match(read('event-type-panel.tsx'), /religionsAskedOn\(religions, eventType\)/);
  assert.doesNotMatch(read('event-type-panel.tsx'), /setFaithAskedOn/, 'the event type panel grew a second editor for Asked on');
  assert.match(actionBody('../actions.ts', 'setFaithAskedOn'), /\.eq\('status', 'active'\)/, 'Asked on accepts a retired event type');
});
