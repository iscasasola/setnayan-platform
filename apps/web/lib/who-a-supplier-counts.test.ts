/**
 * 🧮 WHO A SUPPLIER COUNTS (owner 2026-11-04; migration 20271307968824). The SQL — the readers' counts, the unbooked
 * tick, the flat-priced service, what a supplier can read — is held by tests/db/who-a-supplier-counts.db.test.ts. This
 * file holds the rest:
 *
 *   1 · the arithmetic (pure, the SQL's mirror): `only` = the picked roles and groups that are attending, each guest
 *       once, minus the ticks; `except` = attending minus the picked, minus the ticks;
 *   2 · the words: the guest card's result line, the list's hints, the supplier's ⓘ;
 *   3 · the places: Suppliers › an opened per-head service › "Who they count" (a PickMenu, a tick list, Done in place);
 *       the supplier's Headcount card; Admin › Events;
 *   4 · the fence: no supplier-side file reads the couple's roster or the rule table — numbers only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  ALL_ATTENDING,
  audienceOf,
  breakdownWords,
  countFor,
  countNoun,
  keysOfRule,
  notCountedResult,
  ruleLabels,
  ruleOfKeys,
  ruleRoleLabels,
  ruleWords,
  serviceHint,
  type CountedService,
  type RosterEntry,
} from '@/lib/supplier-count';

const WEB = join(__dirname, '..');

test('2b · a rule is said in the couple’s words for a role — the sheet, the tick list and the supplier’s tile alike', () => {
  const names = { bridesmaid: { one: "Bride's Crew" } };
  const rule = ruleOfKeys('only', ['r:bridesmaids', 'g:kids']);
  const groups = [{ id: 'kids', label: 'Kids' }];
  assert.deepEqual(ruleLabels(rule, groups, names), ["Bride's Crew", 'Kids']);
  assert.deepEqual(ruleLabels(rule, groups), ['Bridesmaids', 'Kids'], 'no words given → the usual word');
  assert.deepEqual(ruleRoleLabels(rule.roles, names), ruleLabels(rule, [], names), 'the supplier’s tile and the couple’s sheet disagree');
  const roster: RosterEntry[] = [{ r: ['bridesmaid'], g: [], t: [] }];
  assert.equal(audienceOf(roster, groups, [], names).find((o) => o.key === 'r:bridesmaids')?.label, "Bride's Crew");
});
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, full));
  }
  return out;
}

// The db test's own event: 7 attending — two principal sponsors, a groomsman, Mia (flower girl, Kids), a kid, two others.
const KIDS = 'kids-group';
const roster: RosterEntry[] = [
  { r: ['principal_sponsor_ninong'], g: [], t: [] },
  { r: ['principal_sponsor_ninang'], g: [], t: [] },
  { r: ['groomsman'], g: [], t: [] },
  { r: ['flower_girl'], g: [KIDS], t: [] },
  { r: ['guest'], g: [KIDS], t: ['bloom'] },
  { r: ['guest'], g: [], t: ['bloom'] },
  { r: ['guest'], g: [], t: ['juan'] },
];

test('1 · ONLY = the picked roles and groups that are attending (each guest once), minus the ticks', () => {
  const sponsors = ruleOfKeys('only', ['r:principal_sponsors']);
  assert.deepEqual(countFor(roster, sponsors, 'juan'), { attending: 7, notCounted: 0, outsideRule: 5, counted: 2 });
  // Sponsors + flower girl + Kids: Mia matches twice and is counted once; the kid ticked for bloom is subtracted.
  const wide = ruleOfKeys('only', ['r:principal_sponsors', 'r:bearers_flower_girl', `g:${KIDS}`]);
  assert.deepEqual(countFor(roster, wide, 'bloom'), { attending: 7, notCounted: 1, outsideRule: 3, counted: 3 });
  // A tick on a guest already outside the rule is not subtracted twice (the one ticked "Other" for bloom).
  assert.equal(countFor(roster, wide, 'bloom').outsideRule + countFor(roster, wide, 'bloom').notCounted, 4);
});

test('1 · EXCEPT = attending minus the picked, minus the ticks; ALL = attending minus the ticks', () => {
  const noKids = ruleOfKeys('except', [`g:${KIDS}`]);
  assert.deepEqual(countFor(roster, noKids, 'juan'), { attending: 7, notCounted: 1, outsideRule: 2, counted: 4 });
  assert.deepEqual(countFor(roster, ALL_ATTENDING, 'juan'), { attending: 7, notCounted: 1, outsideRule: 0, counted: 6 });
  // A rule of nothing picked: Only… counts nobody, Everyone except… counts everyone.
  assert.equal(countFor(roster, ruleOfKeys('only', []), 'x').counted, 0);
  assert.equal(countFor(roster, ruleOfKeys('except', []), 'x').counted, 7);
});

test('1 · a role group stores every role it holds, and reads back as one tick', () => {
  const rule = ruleOfKeys('only', ['r:principal_sponsors', 'g:abc']);
  assert.ok(rule.roles.includes('principal_sponsor_ninong') && rule.roles.includes('principal_sponsor_ninang'));
  assert.ok(rule.roles.includes('principal_sponsor'), 'the retired role is left out of its group');
  assert.deepEqual(keysOfRule(rule).sort(), ['g:abc', 'r:principal_sponsors']);
  assert.deepEqual(ruleOfKeys('all', ['r:principal_sponsors']), ALL_ATTENDING, '"Everyone attending" kept picks');
});

const juan: CountedService = {
  id: 'juan',
  category: 'catering',
  label: 'Catering',
  shop: 'Juan’s Kitchen',
  booked: true,
  rule: ALL_ATTENDING,
  attending: 180,
  notCounted: 11,
  outsideRule: 0,
  counted: 169,
};

test('2 · the guest card’s line: "<shop> counts N, not N+1 · Every other service still counts <first name>."', () => {
  const mia = { attending: true, roles: ['flower_girl'], groupIds: [KIDS], firstName: 'Mia' };
  assert.equal(
    notCountedResult([juan], ['juan'], [], mia),
    'Juan’s Kitchen counts 168, not 169 · Every other service still counts Mia.',
  );
  // Already saved: the count already left her out — not subtracted twice.
  assert.equal(notCountedResult([{ ...juan, counted: 168 }], ['juan'], ['juan'], mia), 'Juan’s Kitchen counts 168, not 169 · Every other service still counts Mia.');
  // Nothing ticked, not attending, or outside the service's rule (the tick moves nothing) → nothing said.
  assert.equal(notCountedResult([juan], [], [], mia), null);
  assert.equal(notCountedResult([juan], ['juan'], [], { ...mia, attending: false }), null);
  assert.equal(notCountedResult([{ ...juan, rule: ruleOfKeys('except', [`g:${KIDS}`]) }], ['juan'], [], mia), null);
});

test('2 · the hints, the rule words, the supplier’s ⓘ', () => {
  assert.equal(serviceHint({ shop: 'Juan’s Kitchen', booked: true }), 'Juan’s Kitchen · Booked');
  assert.equal(serviceHint({ shop: 'Lens & Light', booked: false }), 'Lens & Light · Quoted · applies once booked');
  assert.equal(ruleWords('all', []), 'Everyone attending');
  assert.equal(ruleWords('only', ['Principal Sponsors']), 'Only Principal Sponsors');
  assert.equal(ruleWords('except', ['Kids', 'Crew & helpers']), 'Everyone except Kids, Crew & helpers');
  assert.equal(breakdownWords({ attending: 180, notCounted: 12, outsideRule: 0 }), '180 attending · 12 not counted by the couple · 0 outside their rule');
  assert.equal(countNoun('catering'), 'to serve');
  assert.equal(countNoun('gifts_and_giveaways'), 'to give');
});

test('3 · Suppliers › an opened service › "Who they count" — only for a per-head service, a PickMenu, Done in place', () => {
  const row = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');
  // The row is drawn only for a service the SQL listed — and it lists per-head services only.
  assert.match(row, /const counted = counts\?\.services\.find\(\(s\) => s\.id === row\.vendorId\) \?\? null;/);
  assert.match(row, /\{counted && counts \? <BookedCountRule eventId=\{eventId\} service=\{counted\}/);
  const sheet = read('app/dashboard/[eventId]/vendors/_components/booked-count-rule.tsx');
  assert.match(sheet, /<PickMenu\s+label="Who they count"/, 'the mode is not the PickMenu dropdown');
  assert.match(sheet, /options=\{COUNT_MODES\.map/);
  assert.match(sheet, /countFor\(roster, rule, service\.id\)/, 'the sheet’s count does not move with the ticks');
  assert.match(sheet, /\{shop\} counts \{c\.counted\}/);
  assert.match(sheet, /label=\{pending \? 'Saving…' : 'Done'\}/);
  const action = read('app/dashboard/[eventId]/vendors/_actions/count-rule.ts');
  assert.doesNotMatch(action, /redirect\(|revalidatePath\(/, 'a save that resets the screen');
  assert.doesNotMatch(action, /createAdminClient|service_role/, 'the rule must be written on the couple’s own session');
  assert.match(action, /limitedHelperRefusal\(eventId, 'vendors'\)/);
  // One request, in the slot's own batch.
  const slot = read('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx');
  assert.match(slot, /bookedIds\.length > 0 \? readEventServiceCounts\(supabase, eventId\) : Promise\.resolve\(null\),\s*\]\);/);
});

test('3 · the supplier’s Headcount card and Admin › Events', () => {
  const page = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /isBooked && feeUnlocked \? readVendorHeadcountRule\(supabase, eventId\) : Promise\.resolve\(null\),/);
  assert.match(page, /\{headcountRule \? \(\s*<SupplierCountTile count=\{headcountRule\} names=\{headcountNames\} \/>/);
  // The rule is said in the couple's words, on the supplier's side as on theirs.
  assert.match(page, /isBooked && feeUnlocked \? loadRoleNames\(admin, eventId, 'vendorClientCard\.roleNames'\) : Promise\.resolve\(null\),/);
  const tile = read('app/vendor-dashboard/clients/[eventId]/_components/supplier-count-tile.tsx');
  assert.match(tile, /ruleRoleLabels\(count\.roles, names\)/);
  assert.match(tile, /<InfoTip label=\{countNoun\(count\.category\)\}[^>]*>\s*\{breakdownWords\(count\)\}/);
  for (const words of ['Their rule', 'Not counted', 'The couple picked them · names stay private', 'Moves with', 'Every reply']) {
    assert.ok(tile.includes(words), `the supplier's card lost "${words}"`);
  }
  const admin = read('app/admin/events/[eventId]/page.tsx');
  assert.match(admin, /readEventServiceCounts\(admin, eventId\)/);
  assert.match(admin, /data-admin-service-counts=""/);
});

test('4 · a supplier never reads who: no supplier-side file reads the couple’s roster, the rule table or the left-out helper', () => {
  const supplierSide = sources(join(WEB, 'app', 'vendor-dashboard'))
    .concat(sources(join(WEB, 'app', '[slug]')))
    .concat(sources(join(WEB, 'app', 'api')));
  assert.ok(supplierSide.length > 50, 'the supplier-side sweep lost its targets');
  const leaks = supplierSide.filter((f) =>
    /get_event_service_counts|event_vendor_count_rules|event_vendor_left_out|readEventServiceCounts/.test(read(f)),
  );
  assert.deepEqual(leaks, [], 'a supplier-side file reads the couple’s side of the count');
  // The supplier's own read hands back numbers and the rule's words — its type has no guest field.
  const server = read('lib/supplier-count.ts');
  const shape = server.slice(server.indexOf('export type SupplierHeadcount'), server.indexOf('};', server.indexOf('export type SupplierHeadcount')));
  assert.ok(shape.length > 40, 'the supplier’s count type moved — re-point this check');
  assert.doesNotMatch(shape, /guest_?id|first_?name|display_?name|\bnames?\s*:/i, 'the supplier’s count carries a guest field');
});
