/**
 * The second five hub tools (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB TOOLS"): Tech rider ·
 * Personalisation list · Dietary & allergies · Quantity vs guests · Set list. One test per tool for what it decides,
 * plus the wiring that would break silently: the switch that turns each on, its inline place on the live page, the
 * ONE dispatcher every row press reaches, and the honest states.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checklistProgress,
  counterModel,
  dietaryFromRpc,
  entryTemplateOf,
  initialsOf,
  mealWord,
  nextPosition,
  parseHubToolEntryOp,
  swapWithNeighbour,
  type HubToolEntry,
} from './hub-tool-entries';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { getModule, resolveModules, type DayOfModuleId } from './vendor-dayof-modules';
import { dayOfModuleHref } from './vendor-dayof-module-href';
import { deskTools } from './supplier-desk-rule';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const LIVE = 'app/vendor-dashboard/on-the-day/live/[eventId]';
const FIVE = ['tech_rider', 'personalisation_list', 'dietary_and_allergies', 'quantity_vs_guests', 'set_list'] as const;
const ID = '11111111-2222-4333-8444-555555555555';
const row = (over: Partial<HubToolEntry>): HubToolEntry => ({ id: ID, label: 'x', note: '', done: false, qty: 0, ...over });

// ── the five, as records ────────────────────────────────────────────────────

test('the five are shipped, each on the template the ruling names', () => {
  const want: Record<string, string> = {
    tech_rider: 'checklist',
    personalisation_list: 'per_person',
    dietary_and_allergies: 'per_person',
    quantity_vs_guests: 'counter',
    set_list: 'ordered_list',
  };
  for (const k of FIVE) {
    const t = HUB_TOOL_LIBRARY.find((x) => x.key === k);
    assert.ok(t, `${k} left the library`);
    assert.equal(t!.shipped, true, `${k} is built but still says shipped: false`);
    assert.equal(t!.template, want[k], `${k} moved template`);
  }
});

test('each of the five is a day-of module carrying its hub tool, drawn inline (no address of its own)', () => {
  for (const k of FIVE) {
    const m = getModule(k as DayOfModuleId);
    assert.equal(m.hubTool, k, `${k}: the module does not point at its record`);
    assert.equal(dayOfModuleHref(k as DayOfModuleId, 'E1'), null, `${k} gained an address — it is a panel on the live page`);
  }
  // …so the Event Hub's supplier desk never links to one as if it lived elsewhere.
  const desk = deskTools(FIVE.map((id) => ({ id: id as DayOfModuleId, label: id, blurb: id, enabled: true })), 'E1');
  assert.deepEqual(desk, []);
});

test('the old "Setlist" door now says where it goes, so two rows never both say Set list', () => {
  assert.equal(getModule('setlist').label, 'Song bank');
  assert.equal(dayOfModuleHref('setlist', 'E1'), '/vendor-dashboard/repertoire');
  assert.equal(getModule('set_list').label, 'Set list');
});

// ── who gets which tool switched on by default (the Hub's per-event switches can always change it) ─────────────

const on = (services: string[]) => new Set(resolveModules(services, null).filter((m) => m.enabled).map((m) => m.id));

test('a band gets Tech rider and Set list on by default; a caterer gets Dietary and Quantity; a souvenir shop gets Personalisation', () => {
  const band = on(['live_band']);
  assert.ok(band.has('tech_rider') && band.has('set_list'));
  assert.ok(!band.has('dietary_and_allergies'), 'a band is not the caterer');
  const caterer = on(['catering']);
  assert.ok(caterer.has('dietary_and_allergies') && caterer.has('quantity_vs_guests'));
  assert.ok(!caterer.has('tech_rider'));
  const souvenirs = on(['souvenir_giveaways']);
  assert.ok(souvenirs.has('personalisation_list'));
  assert.ok(!souvenirs.has('dietary_and_allergies'), 'Dietary defaults on for the food folder only, never every serve shop');
});

test('every one of the five can be switched on by any supplier (a suggestion, never a gate — 2026-10-28)', () => {
  const florist = resolveModules(['florist'], null);
  for (const k of FIVE) assert.ok(florist.some((m) => m.id === k), `${k} is not offered to a florist`);
});

test('a saved per-event choice wins over the default', () => {
  const caterer = new Set(resolveModules(['catering'], null, ['run_of_show']).filter((m) => m.enabled).map((m) => m.id));
  assert.ok(!caterer.has('dietary_and_allergies'));
});

// ── the ONE writer's decision ──────────────────────────────────────────────

test('the dispatcher adds only to a tool this table serves, with words', () => {
  assert.equal(entryTemplateOf('tech_rider'), 'checklist');
  assert.equal(entryTemplateOf('personalisation_list'), 'per_person');
  assert.equal(entryTemplateOf('quantity_vs_guests'), 'counter');
  assert.equal(entryTemplateOf('set_list'), null, 'Set list is Song Desk’s sets, not this table');
  assert.equal(entryTemplateOf('nope'), null);
  assert.deepEqual(parseHubToolEntryOp({ op: 'add', toolKey: 'set_list', label: 'x' }), { ok: false, error: 'That tool can’t hold rows.' });
  assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: 'tech_rider', label: '   ' }).ok, false);
  assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: 'personalisation_list', label: '' }).ok, false);
});

test('Tech rider: an item is trimmed, capped and carries no count', () => {
  const r = parseHubToolEntryOp({ op: 'add', toolKey: 'tech_rider', label: '  2×   wireless mic ', qty: 9 });
  assert.deepEqual(r, { ok: true, op: { op: 'add', toolKey: 'tech_rider', label: '2× wireless mic', note: null, qty: null } });
  const long = parseHubToolEntryOp({ op: 'add', toolKey: 'tech_rider', label: 'a'.repeat(500) });
  assert.ok(long.ok && long.op.op === 'add' && long.op.label.length === 140);
  assert.deepEqual(parseHubToolEntryOp({ op: 'tick', entryId: ID, done: true }), { ok: true, op: { op: 'tick', entryId: ID, done: true } });
  assert.equal(parseHubToolEntryOp({ op: 'tick', entryId: 'not-a-uuid', done: true }).ok, false);
  assert.deepEqual(checklistProgress([row({ done: true }), row({}), row({ done: true })]), { done: 2, total: 3 });
});

test('Personalisation list: a person and what goes on theirs; edits keep both', () => {
  const r = parseHubToolEntryOp({ op: 'add', toolKey: 'personalisation_list', label: 'Maria Reyes', note: ' M & J · 12.12.26 ' });
  assert.deepEqual(r, { ok: true, op: { op: 'add', toolKey: 'personalisation_list', label: 'Maria Reyes', note: 'M & J · 12.12.26', qty: null } });
  assert.deepEqual(parseHubToolEntryOp({ op: 'edit', entryId: ID, label: 'Maria R.', note: '' }), {
    ok: true,
    op: { op: 'edit', entryId: ID, label: 'Maria R.', note: null },
  });
  assert.equal(initialsOf('Maria Reyes'), 'MR');
  assert.equal(initialsOf('Lea'), 'L');
  assert.equal(initialsOf('  '), '·');
});

test('Quantity vs guests: counts start at 0, stay in range, and read against the coming guests', () => {
  const r = parseHubToolEntryOp({ op: 'add', toolKey: 'quantity_vs_guests', label: 'Giveaways' });
  assert.deepEqual(r, { ok: true, op: { op: 'add', toolKey: 'quantity_vs_guests', label: 'Giveaways', note: null, qty: 0 } });
  assert.equal(parseHubToolEntryOp({ op: 'count', entryId: ID, qty: -1 }).ok, false);
  assert.equal(parseHubToolEntryOp({ op: 'count', entryId: ID, qty: 1.5 }).ok, false);
  assert.equal(parseHubToolEntryOp({ op: 'count', entryId: ID, qty: 100_001 }).ok, false);
  assert.deepEqual(counterModel(96, 131), { qty: 96, base: 131, pct: 73, gap: { kind: 'short', by: 35 } });
  assert.deepEqual(counterModel(131, 131).gap, { kind: 'even', by: 0 });
  assert.deepEqual(counterModel(140, 131), { qty: 140, base: 131, pct: 100, gap: { kind: 'over', by: 9 } });
  // 🔒 A headcount that could not be read is NOT "of 0": no bar, no gap.
  assert.deepEqual(counterModel(12, null), { qty: 12, base: null, pct: null, gap: null });
});

test('Set list: ▲ ▼ swaps a song with its neighbour, and does nothing at either end', () => {
  const rows = [
    { id: 'a', position: 100 },
    { id: 'b', position: 200 },
    { id: 'c', position: 300 },
  ];
  assert.deepEqual(swapWithNeighbour(rows, 'b', 'up'), { a: { id: 'b', position: 100 }, b: { id: 'a', position: 200 } });
  assert.deepEqual(swapWithNeighbour(rows, 'b', 'down'), { a: { id: 'b', position: 300 }, b: { id: 'c', position: 200 } });
  assert.equal(swapWithNeighbour(rows, 'a', 'up'), null);
  assert.equal(swapWithNeighbour(rows, 'c', 'down'), null);
  // Equal positions still move visibly.
  const tied = swapWithNeighbour([{ id: 'x', position: 100 }, { id: 'y', position: 100 }], 'y', 'up');
  assert.ok(tied && tied.a.position < tied.b.position);
  assert.equal(nextPosition([]), 100);
  assert.equal(nextPosition([100, 300]), 400);
});

test('Dietary & allergies: the RSVP answers, honestly — unread, not yours, or the list', () => {
  assert.deepEqual(dietaryFromRpc(null, { message: 'boom' }), { state: 'unread' });
  assert.deepEqual(dietaryFromRpc(null, null), { state: 'unread' }, 'no answer is not an empty list');
  assert.deepEqual(dietaryFromRpc({ guests: [] }, null), { state: 'unread' }, 'a shape without `allowed` is not a yes');
  assert.deepEqual(dietaryFromRpc({ allowed: false, guests: [] }, null), { state: 'not_food' });
  const ok = dietaryFromRpc(
    {
      allowed: true,
      guests: [
        { guest_id: 'g1', name: 'Ana Cruz', meal: 'fish', dietary: 'Shellfish allergy', table: '4' },
        { guest_id: 'g2', name: 'Jose Santos', meal: 'fish', dietary: null, table: null },
        { guest_id: 'g3', name: '', meal: 'vegan', dietary: ' no pork ', table: null },
        { name: 'no id' },
      ],
    },
    null,
  );
  assert.equal(ok.state, 'ok');
  if (ok.state !== 'ok') return;
  assert.equal(ok.guests.length, 3, 'a row with no guest id is dropped, not drawn');
  assert.equal(ok.withNote, 2);
  assert.deepEqual(ok.meals, [
    { meal: 'fish', count: 2 },
    { meal: 'vegan', count: 1 },
  ]);
  assert.equal(ok.guests[2]!.name, 'Guest');
  assert.equal(ok.guests[2]!.dietary, 'no pork');
  assert.equal(mealWord('vegetarian'), 'Vegetarian');
});

// ── the wiring that would break silently ───────────────────────────────────

test('the live page draws the hub tools from the booking’s own switches, once, with the ONE headcount', () => {
  const page = read(`${LIVE}/page.tsx`);
  assert.match(page, /<HubToolPanels[\s\S]{0,400}modules=\{hubToolModules\(modules\.map/);
  assert.match(page, /attending=\{brief \? attending : null\}/, 'a brief that could not be read must reach the counter as null, never 0');
  const body = read(`${LIVE}/_components/event-day-body.tsx`);
  assert.equal(body.split('{hubTools}').length - 1, 1, 'the day body draws the hub tools slot exactly once');
});

test('the reads are one batch, scoped to the event and the shop', () => {
  const panels = read(`${LIVE}/_components/hub-tools/hub-tool-panels.tsx`);
  assert.equal(panels.split('Promise.all(').length - 1, 1);
  const srv = read('lib/hub-tool-entries.server.ts');
  assert.match(srv, /\.eq\('event_id', eventId\)\s*\.eq\('vendor_profile_id', vendorProfileId\)/);
  assert.match(srv, /out\.set\(k, \{ state: 'unread' \}\)/, 'a failed read must mark the tools unread');
});

test('every row press reaches the ONE dispatcher; the counter writes the settled number', () => {
  const tools = read(`${LIVE}/_components/hub-tools/entry-tools.tsx`);
  assert.match(tools, /import \{ hubToolEntry, type HubToolEntryResult \} from '\.\.\/\.\.\/\.\.\/\.\.\/actions'/);
  assert.match(tools, /save = hubToolEntry/);
  for (const op of ['add', 'edit', 'tick', 'count', 'remove']) assert.match(tools, new RegExp(`op: '${op}'`), `no control sends ${op}`);
  const actions = read('app/vendor-dashboard/on-the-day/actions.ts');
  assert.match(actions, /export async function hubToolEntry\(eventId: string, input: unknown\)/);
  assert.match(actions, /parseHubToolEntryOp\(input\)/);
  // No success-shaped nothing: a zero-row write is a failure.
  assert.match(actions, /if \(!data \|\| data\.length === 0\) return \{ ok: false, error: 'That row is gone — refresh\.' \}/);
});

test('Set list reuses Song Desk’s sets, open, with ▲ ▼ through the folded set action', () => {
  const view = read(`${LIVE}/_components/hub-tools/hub-tool-panels-view.tsx`);
  assert.match(view, /<SetsPanel eventId=\{eventId\} sets=\{sl\.sets\} repertoire=\{sl\.repertoire\} open \/>/);
  const sets = read(`${LIVE}/_components/song-desk/sets-panel.tsx`);
  assert.match(sets, /moveSong: \{ setSongId: s\.setSongId, dir: 'up' \}/);
  assert.match(sets, /moveSong: \{ setSongId: s\.setSongId, dir: 'down' \}/);
  const actions = read('app/vendor-dashboard/on-the-day/actions.ts');
  assert.doesNotMatch(actions, /export async function removeSongFromVendorEventSet/, 'folded into updateVendorEventSet — do not re-export it');
});

test('Dietary draws three honest states and never a typed field', () => {
  const sheet = read(`${LIVE}/_components/hub-tools/dietary-sheet.tsx`);
  assert.match(sheet, /read\.state === 'unread'[\s\S]{0,300}<ReadFailedNote/);
  assert.match(sheet, /read\.state === 'not_food'/);
  assert.doesNotMatch(sheet, /<input|<textarea/, 'the supplier never types health data');
});
