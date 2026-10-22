/**
 * own-supplier-items.test.ts — a supplier on your own event is always findable
 * by its name, in your own search.
 *
 * Owner, 22 Oct 2026: he searched "seda" — Seda Vertis North, a supplier he had
 * BOOKED, added by hand, never published — and search said no supplier
 * matched. The index held no suppliers at all, and the marketplace only holds
 * published shops, so the supplier he was surest of was the one search could
 * never find.
 *
 * The property, executed over the real functions both search surfaces call:
 *   · every named, not-put-away supplier row on an event you organise becomes
 *     a row — booked, considering, hand-added, with or without a Setnayan
 *     account (nothing about publishing is read);
 *   · that row matches its own name, whole or in part, any case;
 *   · it is in scope on Discover AND on the events board ("Search your
 *     events"), and passes the results page's own-things filter;
 *   · it wears "On your event" and opens that supplier's room on that event;
 *   · the shared index actually calls this (a pure function nobody calls
 *     finds nothing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { matchesCommandQuery } from './command-match';
import { itemInScope } from './search-scope';
import { ON_YOUR_EVENT, OWN_SUPPLIER_COLUMNS, ownSupplierHref, ownSupplierItems, type OwnSupplierRow } from './own-supplier-items';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const EVENTS = [
  { event_id: 'S89E-CALEICE001', display_name: 'Cale & Ice' },
  { event_id: 'S89E-DEBUT00002', display_name: 'Bea’s debut' },
];

const ROWS: OwnSupplierRow[] = [
  // The owner's case: hand-added, no Setnayan account, booked.
  { vendor_id: 'v-seda', event_id: 'S89E-CALEICE001', vendor_name: 'Seda Vertis North', archived_at: null },
  { vendor_id: 'v-saysay', event_id: 'S89E-CALEICE001', vendor_name: 'Saysay Studio', archived_at: null },
  { vendor_id: 'v-lights', event_id: 'S89E-DEBUT00002', vendor_name: '  Ilaw Lights & Sound  ' },
];

/** The results page's own-things filter — the same expression, pinned below. */
const resultsKeeps = (i: { kind: string; label: string; sublabel: string; terms?: string }, q: string) =>
  i.kind !== 'action' && matchesCommandQuery(i as Parameters<typeof matchesCommandQuery>[0], q);

test('every supplier on your events is findable by its name — whole, part, any case', () => {
  const items = ownSupplierItems(EVENTS, ROWS);
  assert.equal(items.length, ROWS.length, 'a supplier on your event produced no search row');
  let checked = 0;
  for (const row of ROWS) {
    const name = row.vendor_name!.trim();
    const item = items.find((i) => i.id === `supplier-${row.vendor_id}`);
    assert.ok(item, `${name}: no row`);
    for (const q of [name, name.toLowerCase(), name.toUpperCase(), name.split(' ')[0]!.slice(0, 4)]) {
      assert.ok(matchesCommandQuery(item, q), `${name}: "${q}" does not find it`);
      for (const scope of ['discover', 'events'] as const) {
        assert.ok(itemInScope(item.kind, scope), `${name}: out of scope on ${scope}`);
      }
      assert.ok(resultsKeeps(item, q), `${name}: the results page drops it`);
      checked += 1;
    }
    assert.ok(item.sublabel.startsWith(`${ON_YOUR_EVENT} · `), `${name}: not tagged "${ON_YOUR_EVENT}"`);
    assert.equal(item.href, ownSupplierHref(row.event_id, row.vendor_id), `${name}: opens the wrong room`);
    assert.equal(item.href, `/dashboard/${row.event_id}/vendors/${row.vendor_id}/workspace`);
  }
  assert.equal(checked, ROWS.length * 4);
});

test('"seda" finds Seda Vertis North and names the event', () => {
  const items = ownSupplierItems(EVENTS, ROWS).filter((i) => matchesCommandQuery(i, 'seda'));
  assert.deepEqual(items.map((i) => i.label), ['Seda Vertis North']);
  assert.equal(items[0]!.sublabel, `${ON_YOUR_EVENT} · Cale & Ice`);
});

test('only YOUR events, only rows still on the event, only rows with a name', () => {
  const items = ownSupplierItems(EVENTS, [
    { vendor_id: 'x1', event_id: 'S89E-SOMEONEELS', vendor_name: 'Not yours' },
    { vendor_id: 'x2', event_id: 'S89E-CALEICE001', vendor_name: 'Put away', archived_at: '2026-10-01T00:00:00Z' },
    { vendor_id: 'x3', event_id: 'S89E-CALEICE001', vendor_name: '   ' },
    { vendor_id: 'x4', event_id: 'S89E-CALEICE001', vendor_name: null },
  ]);
  assert.deepEqual(items, []);
});

test('the guests box keeps no palette rows — suppliers included', () => {
  assert.equal(itemInScope('supplier', 'guests'), false);
});

test('the shared index reads the suppliers and hands them to this function', () => {
  const src = code('app/_components/frontdoor/command-data.ts');
  assert.match(src, /\.from\('event_vendors'\)\s*\.select\(OWN_SUPPLIER_COLUMNS\)/, 'the index stopped reading your suppliers');
  assert.match(src, /\.in\('event_id', organiser\.map\(\(e\) => e\.event_id\)\)/, 'the read is no longer the events you organise');
  assert.match(src, /items\.push\(\.\.\.ownSupplierItems\(organiser,/, 'the rows read are never added to the index');
  for (const col of OWN_SUPPLIER_COLUMNS.split(',').map((c) => c.trim())) {
    assert.match(readFileSync(join(WEB, '..', '..', 'supabase', 'security', 'prod-schema.snapshot.txt'), 'utf8'), new RegExp(`^event_vendors\\.${col}$`, 'm'), `event_vendors.${col} is not a column`);
  }
});

test('the results page keeps every non-action row of yours — the filter this file executes', () => {
  const src = code('app/_components/frontdoor/front-door-results.tsx');
  assert.match(
    src,
    /const own = commandItems\.filter\(\s*\(i\) => i\.kind !== 'action' && matchesCommandQuery\(i, query\),?\s*\);/,
    'the results page changed which of your rows it keeps — update `resultsKeeps` above to the new rule',
  );
  assert.match(src, /item\.kind === 'supplier'[\s\S]{0,200}ON_YOUR_EVENT/, 'the results card no longer tags your supplier "On your event"');
});
