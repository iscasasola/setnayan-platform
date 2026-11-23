/**
 * 🧰 THE FIVE HUB TOOLS WORK (DECISION_LOG 2026-11-23: the ten most-shared unbuilt hub tools, free — this PR builds the
 * first five: Queue counter · Entourage · Paperwork checklist · Load-in & venue access · Delivery & drop-off).
 *
 * Each tool is one of the shipped templates on the live Hub page, never a screen of its own:
 *   · the three checklists ride the shot list (its rows `tool_key`, its actions' `tool`, its component's `tool`);
 *   · the Queue counter is one saved row per serve, counted "served of coming";
 *   · Entourage is the couple's own entourage (`loadMarch` → `entourageSheet`), read-only.
 * The tests EXECUTE the pure halves and the in-memory store, and read the source only for the wiring a test cannot run
 * without a database (a scope on a query, a slot on a page).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHECKLIST_TOOLS,
  CHECKLIST_TOOL_KEYS,
  QUEUE_SERVED_LABEL,
  SHOT_LABEL_MAX,
  checklistTool,
  isListToolKey,
  memoryListStore,
  normalizeShotLabel,
  queueCounterView,
} from './shot-list';
import { HUB_TOOL_LIBRARY, suggestedHubTools, HUB_TOOL_RECORDS } from './hub-tools';
import { DAY_OF_MODULES, resolveModules } from './vendor-dayof-modules';
import { dayOfModuleHref } from './vendor-dayof-module-href';
import { entourageSheet, entourageSheetCount, nameInitials } from './supplier-march';
import type { EntourageGroup } from './entourage';

const FIVE = ['queue_counter', 'entourage', 'paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off'] as const;
const web = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

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
    assert.equal(m.hubTool, true);
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

/* ── the three checklists ──────────────────────────────────────────────────────────────────────────────────────── */

test('each checklist has a title, a line naming the event, and a seed that saves as it is', () => {
  assert.deepEqual([...CHECKLIST_TOOL_KEYS], ['shot_list', 'paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off']);
  for (const key of CHECKLIST_TOOL_KEYS) {
    const t = CHECKLIST_TOOLS[key];
    assert.equal(t.key, key);
    assert.ok(t.title.length > 0 && t.line.includes('{event}'), key);
    assert.ok(t.seed.length >= 3, `${key}: a starting list`);
    for (const label of t.seed) assert.equal(normalizeShotLabel(label), label, `${key}: "${label}" would not save`);
    for (const label of t.seed) assert.ok(label.length <= SHOT_LABEL_MAX);
    assert.ok(!/vendor|website/i.test(t.title + t.line + t.seed.join(' ')), `${key}: house words`);
  }
  assert.equal(checklistTool('nope').key, 'shot_list', 'an unknown key reads as the column default');
});

test('PAPERWORK · LOAD-IN · DELIVERY: tick, add, remove and replace each touch only their own list', async () => {
  const store = memoryListStore({ shot_list: [{ label: 'The kiss' }] });
  for (const tool of ['paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off'] as const) {
    const saved = await store.replace('e1', CHECKLIST_TOOLS[tool].seed.map((label) => ({ label, done: false })), tool);
    assert.ok(saved.ok);
    const first = saved.ok ? saved.shots[0]! : null;
    assert.ok(first);
    assert.deepEqual(await store.setDone('e1', first.id, true), { ok: true });
    const added = await store.add('e1', '  Extra step  ', 99, tool);
    assert.ok(added.ok && added.shot.label === 'Extra step');
    const read = await store.load('e1', tool);
    assert.equal(read.state, 'ok');
    if (read.state === 'ok') {
      assert.equal(read.rows.length, CHECKLIST_TOOLS[tool].seed.length + 1);
      assert.equal(read.rows.filter((r) => r.captured_at).length, 1, `${tool}: the tick saved`);
    }
    if (added.ok) assert.deepEqual(await store.remove('e1', added.shot.id), { ok: true });
  }
  const shots = await store.load('e1');
  assert.equal(shots.state === 'ok' ? shots.rows.length : -1, 1, 'three other lists saved — the shot list is untouched');
});

test('the actions scope every read and every replace to ONE tool (a new list never clears another)', () => {
  const src = web('app/vendor-dashboard/on-the-day/shot-list-actions.ts');
  const load = src.slice(src.indexOf('export async function loadShotList'), src.indexOf('export async function replaceShotList'));
  assert.match(load, /\.eq\('tool_key', key\)/, 'loadShotList reads one tool');
  const replace = src.slice(src.indexOf('export async function replaceShotList'), src.indexOf('export async function addShot'));
  assert.match(replace, /\.eq\('tool_key', key\)/, 'replaceShotList clears only its own tool’s old rows');
  assert.match(replace, /tool_key: key/, 'replaceShotList writes its tool');
  const add = src.slice(src.indexOf('export async function addShot'), src.indexOf('export async function setShotCaptured'));
  assert.match(add, /tool_key: key/, 'addShot writes its tool');
  assert.ok(isListToolKey('queue_counter') && isListToolKey('paperwork_checklist') && !isListToolKey('entourage'));
  // No new export: the tool is an optional last argument (the server-action budget).
  assert.equal((src.match(/^export async function /gm) ?? []).length, 5);
});

test('the couple sees the ticks: their workspace splits one read per checklist tool', () => {
  const src = web('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(src, /\.in\('tool_key', \[\.\.\.CHECKLIST_TOOL_KEYS\]\)/, 'the read is the checklist tools only (never the queue rows)');
  assert.match(src, /r\.tool_key === 'shot_list'/, 'the shot list card shows only the shot list');
  assert.match(src, /tool=\{c\.tool\}/);
});

/* ── the queue counter ─────────────────────────────────────────────────────────────────────────────────────────── */

test('QUEUE COUNTER: served of coming, the bar capped, an unread guest count never drawn as 0', () => {
  assert.deepEqual(queueCounterView(96, 131), { served: 96, of: 131, pct: 73 });
  assert.deepEqual(queueCounterView(140, 131), { served: 140, of: 131, pct: 100 }, 'seconds still count; the bar stops full');
  assert.deepEqual(queueCounterView(5, null), { served: 5, of: null, pct: 0 }, 'not read is null, not 0');
  assert.deepEqual(queueCounterView(-2, 10), { served: 0, of: 10, pct: 0 });
});

test('QUEUE COUNTER: each ＋ is one timed row, − takes back the latest, and the count is the rows', async () => {
  const store = memoryListStore();
  const a = await store.add('e1', QUEUE_SERVED_LABEL, 0, 'queue_counter');
  const b = await store.add('e1', QUEUE_SERVED_LABEL, 1, 'queue_counter');
  assert.ok(a.ok && b.ok);
  const read = await store.load('e1', 'queue_counter');
  assert.equal(read.state === 'ok' ? read.rows.length : -1, 2);
  if (read.state === 'ok') assert.ok(read.rows.every((r) => r.captured_at), 'a serve is done the moment it is saved');
  if (b.ok) await store.remove('e1', b.shot.id);
  const after = await store.load('e1', 'queue_counter');
  assert.equal(after.state === 'ok' ? after.rows.length : -1, 1);
  const shots = await store.load('e1');
  assert.equal(shots.state === 'ok' ? shots.rows.length : -1, 0, 'serves are not shots');

  const src = web('app/vendor-dashboard/on-the-day/shot-list-actions.ts');
  assert.match(src, /key === 'queue_counter' \? \{ captured_at: new Date\(\)\.toISOString\(\) \}/, 'the action stamps the serve');
  const counter = web('app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/queue-counter.tsx');
  assert.match(counter, /state === 'unreadable'/, 'a refused read is said');
  assert.match(counter, /It is not zero\./);
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

test('the live Hub page reads the switches and draws the hub tools in their slot', () => {
  const page = web('app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx');
  assert.match(page, /readHubToolSuggestions\(supabase, eventTiles\)/);
  assert.match(page, /resolveModules\(profile\.services, eventTiles, override, hubSuggestions\)/);
  assert.match(page, /hubTools=\{\s*<HubToolsSection/);
  const body = web('app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-day-body.tsx');
  assert.match(body, /\{hubTools \?\? null\}/);
  const hub = web('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(hub, /resolveModules\(services, eventTiles, override, hubSuggestions\)/, 'the set-up switches start where the live page does');
  const section = web('app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tools-section.tsx');
  for (const k of ['queue_counter', 'entourage']) assert.match(section, new RegExp(`id === '${k}'`));
  assert.match(section, /isChecklist\(id\)\) return <ShotList/);
});
