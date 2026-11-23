/**
 * 🧰 THE FIVE HUB TOOLS WORK (DECISION_LOG 2026-11-23: the ten most-shared unbuilt hub tools, free — this PR builds the
 * first five: Queue counter · Entourage · Paperwork checklist · Load-in & venue access · Delivery & drop-off).
 *
 * Each tool is one of the shipped templates on the live Hub page, never a screen of its own, and every row a tool keeps
 * lives in ONE home (controller, DECISION_LOG 23 Nov 2026): `vendor_hub_tool_entries`, through ONE reader
 * (`readHubToolEntries`) and ONE writer (`hubToolEntry`):
 *   · the three checklists are Checklist rows;
 *   · the Queue counter is a Counter row (its count is the row's `qty`), against the RSVP's coming guests;
 *   · Entourage is the couple's own entourage (`loadMarch` → `entourageSheet`), read-only — it keeps no rows.
 * The Shot list keeps its own couple-read table and is untouched (🔒 no-hub-tool-borrows-the-shot-list.test.ts).
 * The tests EXECUTE the pure halves and read the source only for the wiring a test cannot run without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { READ_ONLY_TOOLS, counterModel, entryTemplateOf, parseHubToolEntryOp } from './hub-tool-entries';
import { HUB_TOOL_LIBRARY, suggestedHubTools, HUB_TOOL_RECORDS } from './hub-tools';
import { DAY_OF_MODULES, resolveModules } from './vendor-dayof-modules';
import { dayOfModuleHref } from './vendor-dayof-module-href';
import { entourageSheet, entourageSheetCount, nameInitials } from './supplier-march';
import type { EntourageGroup } from './entourage';

const FIVE = ['queue_counter', 'entourage', 'paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off'] as const;
/** The four of the five that keep rows. */
const ROW_TOOLS = ['queue_counter', 'paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off'] as const;
const web = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const VIEW = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view.tsx';
const PANELS = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels.tsx';

/* ── the library ───────────────────────────────────────────────────────────────────────────────────────────────── */

test('the five are shipped, each on the template the ruling names', () => {
  const want: Record<(typeof FIVE)[number], string> = {
    queue_counter: 'counter',
    entourage: 'per_person',
    paperwork_checklist: 'checklist',
    load_in_and_venue_access: 'checklist',
    delivery_and_drop_off: 'checklist',
  };
  for (const key of FIVE) {
    const t = HUB_TOOL_LIBRARY.find((x) => x.key === key);
    assert.ok(t, `${key} is not in the library`);
    assert.equal(t.shipped, true, `${key} is not marked shipped`);
    assert.equal(t.template, want[key], `${key} is on the wrong template`);
  }
});

test('every shipped tool of the five is a day-of module any shop may switch on, drawn inline (no dead link)', () => {
  for (const key of FIVE) {
    const m = DAY_OF_MODULES.find((x) => x.id === key);
    assert.ok(m, `${key} has no day-of module — a shipped tool nobody can switch on`);
    assert.equal(m.hubTool, key, `${key}: the module draws its own library record`);
    assert.equal(m.alwaysAvailable, true, `${key}: categories suggest, never gate`);
    assert.equal(dayOfModuleHref(key, 'e1'), null, `${key} is drawn inline, never a link row`);
  }
});

/* ── suggestions: a category suggests, never gates ─────────────────────────────────────────────────────────────── */

test('the category switches decide what starts ON; every shop can still switch any tool on', () => {
  // A florist with nothing saved reads the approved seed: Delivery & drop-off · Entourage · Load-in.
  const seed = suggestedHubTools({ categories: [{ id: 'florist', label: 'Florist' }], settings: [], switches: [], library: HUB_TOOL_RECORDS });
  for (const k of ['delivery_and_drop_off', 'entourage', 'load_in_and_venue_access']) assert.ok(seed.has(k), k);
  assert.ok(!seed.has('queue_counter'));

  // An admin who saved the florist with only the queue counter: the saved switches win over the seed.
  const saved = suggestedHubTools({
    categories: [{ id: 'florist', label: 'Florist' }],
    settings: [{ category_id: 'florist', scan_default: 'once' }],
    switches: [{ category_id: 'florist', tool_key: 'queue_counter' }],
    library: HUB_TOOL_RECORDS,
  });
  assert.deepEqual([...saved], ['queue_counter']);

  const florist = resolveModules(['florist'], ['florist'], null, { suggested: seed, inactive: new Set() });
  const on = (id: string) => florist.find((m) => m.id === id)?.enabled;
  assert.equal(on('delivery_and_drop_off'), true, 'a suggested tool starts ON');
  assert.equal(on('queue_counter'), false, 'an unsuggested tool starts off…');
  assert.ok(florist.some((m) => m.id === 'queue_counter'), '…but is still offered (never a gate)');

  // Not read (null) → nothing suggested, nothing hidden.
  const unread = resolveModules(['florist'], ['florist'], null, null);
  for (const key of FIVE) assert.ok(unread.some((m) => m.id === key && !m.enabled), key);

  // The shop's own saved switches win.
  const mine = resolveModules(['florist'], ['florist'], ['queue_counter'], { suggested: seed, inactive: new Set() });
  assert.equal(mine.find((m) => m.id === 'queue_counter')?.enabled, true);
  assert.equal(mine.find((m) => m.id === 'delivery_and_drop_off')?.enabled, false);

  // Admin's Turn off: the tool leaves every Hub.
  const off = resolveModules(['florist'], ['florist'], ['entourage'], { suggested: seed, inactive: new Set(['entourage']) });
  assert.ok(!off.some((m) => m.id === 'entourage'));
});

/* ── ONE home: vendor_hub_tool_entries ─────────────────────────────────────────────────────────────────────────── */

test('the four row tools are rows of the ONE table — the one writer takes them, on their own template', () => {
  assert.equal(entryTemplateOf('paperwork_checklist'), 'checklist');
  assert.equal(entryTemplateOf('load_in_and_venue_access'), 'checklist');
  assert.equal(entryTemplateOf('delivery_and_drop_off'), 'checklist');
  assert.equal(entryTemplateOf('queue_counter'), 'counter');
  for (const toolKey of ROW_TOOLS) {
    const add = parseHubToolEntryOp({ op: 'add', toolKey, label: '  Signed   forms ' });
    assert.ok(add.ok, `${toolKey}: the writer refuses its rows`);
    if (add.ok && add.op.op === 'add') {
      assert.equal(add.op.label, 'Signed forms');
      assert.equal(add.op.qty, toolKey === 'queue_counter' ? 0 : null, `${toolKey}: a counter row starts at 0; a checklist row has no count`);
    }
  }
  // The Queue counter's ＋ is the template's own count op on its row.
  const count = parseHubToolEntryOp({ op: 'count', entryId: '00000000-0000-4000-8000-000000000001', qty: 38 });
  assert.ok(count.ok && count.op.op === 'count' && count.op.qty === 38);
});

test('Entourage keeps NO rows: the one writer refuses it, and the reader never asks for it', () => {
  assert.ok((READ_ONLY_TOOLS as readonly string[]).includes('entourage'));
  assert.equal(entryTemplateOf('entourage'), null);
  assert.equal(entryTemplateOf('dietary_and_allergies'), null, 'the RSVP answers are read, never typed');
  const add = parseHubToolEntryOp({ op: 'add', toolKey: 'entourage', label: 'Maria Reyes' });
  assert.equal(add.ok, false);
  const panels = web(PANELS);
  assert.match(panels, /const entryKeys = keys\.filter\(\(k\) => entryTemplateOf\(k\) != null\)/, 'the read asks only for tools that keep rows');
  assert.match(panels, /readHubToolEntries\(supabase, eventId, vendorProfileId, entryKeys\)/);
});

test('each row tool is drawn by its template with its own words and mark', () => {
  const view = web(VIEW);
  for (const key of ROW_TOOLS) {
    assert.match(view, new RegExp(`\\n  ${key}: \\{\\n    placeholder: '`), `${key}: no add-box words`);
    assert.match(view, new RegExp(`\\n  ${key}: [A-Z][A-Za-z0-9]+,`), `${key}: no mark`);
  }
  assert.match(view, /template === 'checklist'\) \{\s*body = <ChecklistTool/);
  assert.match(view, /body = <CounterTool/);
  assert.match(view, /if \(key === 'entourage'\) \{\s*body = <EntourageSheet sections=\{reads\.entourage \?\? null\} \/>/);
});

test('QUEUE COUNTER: counted against the coming guests; an unread guest count is never drawn as 0', () => {
  assert.deepEqual(counterModel(96, 131), { qty: 96, base: 131, pct: 73, gap: { kind: 'short', by: 35 } });
  assert.equal(counterModel(140, 131).pct, 100, 'seconds still count; the bar stops full');
  assert.deepEqual(counterModel(5, null), { qty: 5, base: null, pct: null, gap: null }, 'not read is null, not 0');
});

test('the couple reads none of the new tools: their workspace reads the shot list only, as main does', () => {
  const page = web('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  const card = web('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/shot-list-card.tsx');
  for (const src of [page, card]) {
    assert.ok(!/tool_key|CHECKLIST_TOOL_KEYS|vendor_hub_tool_entries/.test(src), 'a couple surface reads a supplier hub tool');
  }
});

/* ── entourage ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const person = (id: string, name: string, role: string, walk: number | null = null) => ({
  id,
  name,
  role: role as never,
  walk,
  place: 0,
  ceremonyOnly: false,
});

test('ENTOURAGE: one row per person under the couple’s section words, walkers and the not-walking tray together', () => {
  const walking: EntourageGroup[] = [
    { key: 'sponsors', label: 'Principal Sponsors', rows: [[person('g1', 'Atty. Ramon Dizon', 'principal_sponsor'), person('g2', 'Liza Dizon', 'principal_sponsor')]], names: {} },
    { key: 'maids', label: 'Bride’s Crew', rows: [[person('g3', 'Maria Reyes', 'maid_of_honor'), null]], names: {} },
  ];
  const out: EntourageGroup[] = [{ key: 'maids', label: 'Bride’s Crew', rows: [[person('g4', 'Ana Cruz', 'bridesmaid'), null]], names: {} }];
  const sheet = entourageSheet(walking, out);
  assert.deepEqual(sheet.map((s) => s.label), ['Principal Sponsors', 'Bride’s Crew'], 'a section in both halves is drawn once');
  assert.deepEqual(sheet[1]!.people.map((p) => p.name), ['Maria Reyes', 'Ana Cruz'], 'walkers first, then the tray');
  assert.equal(entourageSheetCount(sheet), 4);
  assert.equal(sheet[0]!.people[0]!.initials, 'RD', 'a title is skipped in the mark');
  assert.ok(sheet.every((s) => s.people.every((p) => p.role === null || p.role.length > 0)));
  assert.deepEqual(entourageSheet([], null), [], 'nobody named: empty, which the sheet says in words');
  // 🔒 Only the printed entourage: a march-only walker (the couple, read for the band and coordinator) never shows.
  const withCouple = entourageSheet([{ key: 'couple', label: 'The Couple', rows: [[person('c1', 'Claire Santos', 'bride'), null]], names: {} }], null);
  assert.deepEqual(withCouple, [], 'the march-only couple is not on the sheet');
  assert.equal(nameInitials('Dr. José Rizal'), 'JR');
  assert.equal(nameInitials('Cher'), 'C');
});

test('ENTOURAGE: read from the march’s own loader, and an unread entourage is said, never drawn as nobody', () => {
  const page = web('app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx');
  assert.match(page, /has\('entourage'\) \? \(march \?\? \(await loadMarch\(createAdminClient\(\), eventId\)\)\)/);
  assert.match(page, /!entourageMarch\.unread \? entourageSheet\(entourageMarch\.walking, entourageMarch\.out\) : null/);
  const sheet = web('app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/entourage-sheet.tsx');
  assert.match(sheet, /sections == null/);
  assert.match(sheet, /We couldn’t load the couple’s entourage/);
});

/* ── the live page draws them ──────────────────────────────────────────────────────────────────────────────────── */

test('the live Hub page reads the switches and draws every hub tool in its ONE slot', () => {
  const page = web('app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx');
  assert.match(page, /readHubToolSuggestions\(supabase, eventTiles\)/);
  assert.match(page, /resolveModules\(profile\.services, eventTiles, override, hubSuggestions\)/);
  assert.match(page, /hubTools=\{\s*<HubToolPanels/);
  assert.match(page, /entourage=\{entourage\}/);
  assert.equal((page.match(/hubTools=\{/g) ?? []).length, 1, 'one hub-tools slot, one drawer');
  const body = web('app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-day-body.tsx');
  assert.equal((body.match(/hubTools\?: ReactNode/g) ?? []).length, 1);
  const hub = web('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(hub, /resolveModules\(services, eventTiles, override, hubSuggestions\)/, 'the set-up switches start where the live page does');
});
