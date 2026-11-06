/**
 * 🤝 PARTNERS COME AFTER A SHARED EVENT — the pure half + the wiring (owner 2026-11-06: "cannot link until they have
 * served the same event"). The database half (trigger + read) is `tests/db/partners-after-a-shared-event.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  NO_PARTNERS_YET,
  NOT_SERVED_TOGETHER_MESSAGE,
  foldServedWithRows,
  proposableShops,
  servedTogetherLine,
  servedWhen,
  type ServedWithRow,
} from './partners-you-served-with';
import { buildGrowthRecs, withoutPartnershipRecWhenNobodyToLink } from './vendor-growth-recs';
import { BOOKED_VENDOR_STATUSES } from './vendors';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const label = (t: string) => ({ wedding: 'Wedding', debut: 'Debut' })[t] ?? t;

const row = (o: Partial<ServedWithRow>): ServedWithRow => ({
  other_vendor_profile_id: 'a',
  business_name: 'Shop A',
  is_live: true,
  event_type: 'wedding',
  event_date: '2026-03-14',
  event_date_precision: 'day',
  ...o,
});

test('fold: one entry per shop, its events newest first, shops by their latest event', () => {
  const out = foldServedWithRows([
    row({ other_vendor_profile_id: 'a', event_date: '2025-01-02' }),
    row({ other_vendor_profile_id: 'b', business_name: 'Shop B', event_date: '2026-05-01', event_type: 'debut' }),
    row({ other_vendor_profile_id: 'a', event_date: '2026-03-14' }),
  ]);
  assert.deepEqual(out.map((p) => p.vendorProfileId), ['b', 'a']);
  assert.deepEqual(out[1]!.events.map((e) => e.eventDate), ['2026-03-14', '2025-01-02']);
});

test('the row line: "Served together · ‹type› · ‹Mon YYYY›" — never a name', () => {
  const [a] = foldServedWithRows([row({})]);
  assert.equal(servedTogetherLine(a!, label), 'Served together · Wedding · Mar 2026');
  const [two] = foldServedWithRows([row({}), row({ event_date: '2024-11-30' })]);
  assert.equal(servedTogetherLine(two!, label), 'Served together · Wedding · Mar 2026 · 2 events');
  const [untyped] = foldServedWithRows([row({ event_type: 'unspecified' })]);
  assert.equal(servedTogetherLine(untyped!, label), 'Served together · Mar 2026');
  assert.equal(servedWhen({ eventDate: '2025-07-01', precision: 'year' }), '2025');
  assert.equal(servedWhen({ eventDate: '2025-12-01', precision: 'month' }), 'Dec 2025');
});

test('the picker offers only LIVE served-with shops; a failed read offers nothing (and is not "nobody")', () => {
  const partners = foldServedWithRows([row({}), row({ other_vendor_profile_id: 'c', is_live: false })]);
  assert.deepEqual(proposableShops({ measured: true, partners }).map((p) => p.vendorProfileId), ['a']);
  assert.deepEqual(proposableShops({ measured: false, partners: [] }), []);
  assert.equal(NO_PARTNERS_YET, 'Partners show here after you serve an event with another Setnayan supplier.');
  assert.equal(NOT_SERVED_TOGETHER_MESSAGE, "You can link up after you've both served the same event.");
});

test('the partnerships page lists ONLY served-with shops, each a row that opens in place', () => {
  const page = read('app/vendor-dashboard/partnerships/page.tsx');
  assert.match(page, /readPartnersYouServedWith\(supabase, myId\)/);
  assert.match(page, /proposableShops\(served\)/);
  assert.match(page, /\{NO_PARTNERS_YET\}/, 'the empty state is the ruling sentence');
  assert.match(page, /!served\.measured \?/, 'a failed read must say so before the empty state');
  assert.match(page, /<Fold[\s\S]*?line=\{servedTogetherLine\(v, eventTypeLabel\)\}/);
  // The old "all suppliers" picker and its hint are gone — no shop outside the served-with list is offered.
  assert.doesNotMatch(page, /All suppliers/);
  assert.doesNotMatch(page, /rpc\(\s*'vendor_worked_with_ids'/);
  assert.doesNotMatch(page, /\.from\('vendor_profiles'\)\s*\.select\('vendor_profile_id, business_name'\)\s*\.eq\('public_visibility'/);
});

test('a partner row is the house row: name + Live, one quiet line, no buttons until it is opened', () => {
  const page = read('app/vendor-dashboard/partnerships/page.tsx');
  const start = page.indexOf('{accepted.map((p) => {');
  const end = page.indexOf('OUTGOING PROPOSALS', start);
  assert.ok(start > 0 && end > start, 'the Partners list moved');
  const rows = page.slice(start, end);
  const foldAt = rows.indexOf('<Fold');
  assert.ok(foldAt > 0, 'a partner row must open in place through the shared Fold');
  assert.match(rows, /data="partner-accepted"/);
  assert.match(rows, /line=\{`\$\{kindLabel\} · \$\{iProposed \? 'You proposed' : 'They proposed'\}`\}/);
  // Nothing pressable before the Fold opens — the dropdown and Re-propose live INSIDE it.
  const closed = rows.slice(0, foldAt);
  assert.doesNotMatch(closed, /<form|<select|SubmitButton/, 'a button sits on the closed partner row again');
  assert.ok(rows.indexOf('changePartnershipKind') > foldAt, 'Re-propose must sit inside the opened row');
});

test('proposePartnership asks the shared reader BEFORE it inserts, and words the trigger refusal', () => {
  const src = read('app/vendor-dashboard/partnerships/actions.ts');
  const fn = src.slice(src.indexOf('export async function proposePartnership'), src.indexOf('async function respondToPartnership'));
  const askAt = fn.indexOf('servedTogetherWith(supabase, vendorProfileId, recommendedId)');
  const insertAt = fn.indexOf(".from('vendor_partnerships').insert(");
  assert.ok(askAt > 0 && insertAt > askAt, 'the served-together check must run before the insert');
  assert.match(fn, /back\(NOT_SERVED_TOGETHER_MESSAGE\)/);
  assert.match(fn, /servedTogether === null/, 'a failed read must not read as "never served together"');
  assert.equal((src.match(/isNotServedTogether\(/g) ?? []).length, 3, 'both inserts (propose + re-propose) word the trigger refusal');
});

test('the migration counts the same four booked statuses as BOOKED_VENDOR_STATUSES', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_partners_after_a_shared_event.sql'));
  assert.ok(file, 'the migration is missing');
  const sql = readFileSync(join(dir, file!), 'utf8');
  const lists = [...sql.matchAll(/status\s+IN \(([^)]+)\)/g)].map((m) =>
    m[1]!.split(',').map((s) => s.trim().replace(/'/g, '')).sort(),
  );
  assert.equal(lists.length, 2, 'both sides of the pair must be booked');
  for (const l of lists) assert.deepEqual(l, [...BOOKED_VENDOR_STATUSES].sort());
});

test('Analytics "Link up" door: does not fire when nobody is eligible; unchanged otherwise', () => {
  const recs = buildGrowthRecs(null);
  assert.ok(recs.some((r) => r.key === 'build_partnerships'));
  assert.ok(!withoutPartnershipRecWhenNobodyToLink(recs, 0).some((r) => r.key === 'build_partnerships'));
  assert.equal(withoutPartnershipRecWhenNobodyToLink(recs, 2), recs);
  assert.equal(withoutPartnershipRecWhenNobodyToLink(recs, null), recs, 'a failed read keeps the card as it was');
  const perf = read('app/vendor-dashboard/performance/page.tsx');
  assert.match(perf, /<GrowthRecsCard recs=\{shownGrowthRecs\} \/>/);
  assert.match(perf, /withoutPartnershipRecWhenNobodyToLink\(\s*growthRecs,/);
});
