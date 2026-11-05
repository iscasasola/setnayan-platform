/**
 * the-plan-is-one-list.test.ts — CHECKLIST MERGES INTO PLANNING STAGE (owner ruled 2026-11-01; corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §9, DECISION_LOG "CHECKLIST MERGES INTO PLANNING STAGE").
 *
 * Four properties, each run against the shipped code (a fake Supabase client that resolves the way Supabase does, or
 * the shipped source itself) — and each fails with its change reverted:
 *
 *   1 · ONE LIST — nothing outside the one list reads the plan's tasks: `event_checklist_items` is read only by
 *       `lib/checklist.ts` (`readChecklistItems`) and the seed; `readChecklistItems` is called only by
 *       `lib/preparation.ts`; the old second readers (`fetchChecklistProgress`, `fetchChecklistItems`) are gone; and
 *       every surface that counts the plan counts it through `fetchPreparationAgenda` + `planningProgress`.
 *   2 · AUTO-TICK STILL WORKS — Planning Stage tops up and auto-ticks the tasks (`ensureChecklistSeeded`) BEFORE its
 *       one read, and the reconcile still only moves pending → done.
 *   3 · NO DUPLICATE ROWS — a task and the autofill row that is the same work show once.
 *   4 · HOME COUNT = LIST COUNT — Home's To do tile, the board and the list's own filter come from one rule, and the
 *       count-only read (`only: 'todo'`) gives exactly what the full list gives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildChecklistSeed, type ChecklistItemRow } from './checklist';
import {
  assemblePlanningList,
  fetchPreparationAgenda,
  isTodoItem,
  planningProgress,
  taskItemsFrom,
  type PreparationItem,
} from './preparation';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── fixtures ────────────────────────────────────────────────────────────────

const EVENT_ID = 'e-1';
const EVENT_DATE = '2026-12-18';
const NOW = new Date('2026-11-01T12:00:00');

/** The REAL wedding template, as rows, a few ticked and one moved by the host. */
function taskRows(): ChecklistItemRow[] {
  return buildChecklistSeed(EVENT_ID, 'catholic').map((r, i) => ({
    ...r,
    item_id: `t-${r.template_key}`,
    public_id: `S89K-${i}`,
    status: ['set_budget', 'lock_theme', 'book_photo'].includes(r.template_key ?? '') ? 'done' : 'pending',
    completed_at: null,
    created_at: '2025-01-01T00:00:00Z',
    due_date_set: r.template_key === 'rings' ? '2026-11-20' : null,
  }));
}

const EVENT = { event_type: 'wedding', event_date: EVENT_DATE, created_at: '2025-01-01T00:00:00Z' };

function row(id: string, source: PreparationItem['source'], iso: string, extra: Partial<PreparationItem> = {}): PreparationItem {
  const date = new Date(`${iso}T12:00:00`);
  return {
    id,
    source,
    date,
    daysFromNow: Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date('2026-11-01T00:00:00').getTime()) / 86_400_000),
    title: id,
    subtitle: '',
    ...extra,
  };
}

/** Autofill rows: four of them are the same work as a task, two are not. */
function autofill(): PreparationItem[] {
  return [
    row('milestone:psa_cenomar_window', 'milestone', '2026-06-21', { twin: { kind: 'milestone', key: 'psa_cenomar_window' } }),
    row('paperwork:p1', 'paperwork', '2026-10-01', { twin: { kind: 'paperwork', documentType: 'marriage_license' } }),
    row('appointment:a1', 'meeting', '2026-11-14', { twin: { kind: 'meeting', appointmentType: 'food_tasting' } }),
    row('payment:deposit', 'payment', '2026-11-12', { amountPhp: 40000, twin: { kind: 'payment', category: 'catering', firstLine: true } }),
    // The caterer's SECOND line is its own money — never folded.
    row('payment:balance', 'payment', '2026-12-10', { amountPhp: 92500, twin: { kind: 'payment', category: 'catering', firstLine: false } }),
    // book_photo is DONE: its deposit line still owed shows on its own.
    row('payment:photo', 'payment', '2026-11-20', { amountPhp: 15000, twin: { kind: 'payment', category: 'photographer', firstLine: true } }),
  ];
}

function manual(): PreparationItem[] {
  return [
    row('manual:m1', 'manual', '2026-11-05', { isManual: true, itemId: 'm1', done: false, title: 'Pick up the barong' }),
    row('manual:m2', 'manual', '2026-10-20', { isManual: true, itemId: 'm2', done: true, title: 'Send the deposit slip' }),
  ];
}

function fullList() {
  const tasks = taskItemsFrom(taskRows(), { eventId: EVENT_ID, event: EVENT, now: NOW });
  return assemblePlanningList([...tasks, ...autofill(), ...manual()]);
}

// ── 3 · no duplicate rows ───────────────────────────────────────────────────

test('3 · a task and its autofill twin show ONCE — the task stays, the twin rides on it', () => {
  const list = fullList();
  const ids = new Set(list.items.map((i) => i.id));
  for (const gone of ['milestone:psa_cenomar_window', 'paperwork:p1', 'appointment:a1', 'payment:deposit']) {
    assert.ok(!ids.has(gone), `${gone} is the same work as an open task and must fold into it`);
  }
  const psa = list.items.find((i) => i.templateKey === 'psa_cenomar')!;
  assert.equal(psa.folded?.length, 1);
  const caterer = list.items.find((i) => i.templateKey === 'book_caterer')!;
  assert.equal(caterer.amountPhp, 40000, 'the folded deposit’s amount rides on the task');
  const license = list.items.find((i) => i.templateKey === 'marriage_license')!;
  assert.match(license.subtitle, /paperwork:p1/, 'the twin’s fact is on the task’s second line');
  // Not the same work → still shown.
  assert.ok(ids.has('payment:balance'), 'a second payment line is its own money');
  assert.ok(ids.has('payment:photo'), 'a DONE booking task does not hide the deposit still owed');
  // Every task appears exactly once.
  const taskIds = list.items.filter((i) => i.source === 'task').map((i) => i.taskItemId);
  assert.equal(new Set(taskIds).size, taskIds.length);
  assert.equal(taskIds.length, taskRows().length);
});

test('3 · a done task still swallows its milestone (a window opening means nothing once done)', () => {
  const tasks = taskItemsFrom(
    taskRows().map((r) => (r.template_key === 'psa_cenomar' ? { ...r, status: 'done' as const } : r)),
    { eventId: EVENT_ID, event: EVENT, now: NOW },
  );
  const list = assemblePlanningList([...tasks, ...autofill()]);
  assert.ok(!list.items.some((i) => i.id === 'milestone:psa_cenomar_window'));
});

test('3 · a fold never moves, adds or removes a task', () => {
  const tasks = taskItemsFrom(taskRows(), { eventId: EVENT_ID, event: EVENT, now: NOW });
  const folded = assemblePlanningList([...tasks, ...autofill()]).items.filter((i) => i.source === 'task');
  const alone = assemblePlanningList(tasks).items;
  assert.deepEqual(
    folded.map((i) => [i.taskItemId, i.dateIso]),
    alone.map((i) => [i.taskItemId, i.dateIso]),
  );
});

// ── task dates ──────────────────────────────────────────────────────────────

test('a task starts at its offset and keeps a date the host set', () => {
  const tasks = taskItemsFrom(taskRows(), { eventId: EVENT_ID, event: EVENT, now: NOW });
  const caterer = tasks.find((t) => t.templateKey === 'book_caterer')!;
  // 270 days before 2026-12-18.
  assert.equal(caterer.dateIso, '2026-03-23');
  assert.equal(caterer.planDateIso, '2026-03-23');
  assert.equal(caterer.dateSet, false);
  const rings = tasks.find((t) => t.templateKey === 'rings')!;
  assert.equal(rings.dateIso, '2026-11-20', 'the host’s own date wins');
  assert.equal(rings.planDateIso, '2026-10-19', 'and the plan’s date is still known, for "Back to the plan’s date"');
  assert.equal(rings.dateSet, true);
  const thanks = tasks.find((t) => t.templateKey === 'thank_you_notes')!;
  assert.equal(thanks.afterDay, true, 'an after-the-day task is not capped at the event day');
});

test('no event date → tasks are undated, gathered last under "No date yet", never dropped', () => {
  const tasks = taskItemsFrom(taskRows(), { eventId: EVENT_ID, event: { event_type: 'wedding', event_date: null }, now: NOW });
  const list = assemblePlanningList([...tasks, ...manual()]);
  assert.equal(list.items.filter((i) => i.source === 'task').length, taskRows().length);
  const last = list.groups[list.groups.length - 1]!;
  assert.equal(last.label, 'No date yet');
});

// ── 4 · Home count = list count ─────────────────────────────────────────────

type Result = { data: unknown; error: unknown; count?: number };
function query(result: Result) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'is', 'not', 'neq', 'or']) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
  return q;
}
function client(tables: Record<string, Result>) {
  const asked: string[] = [];
  return {
    asked,
    c: { from: (t: string) => (asked.push(t), query(tables[t] ?? { data: [], error: null })) } as never,
  };
}
const TABLES: Record<string, Result> = {
  event_checklist_items: { data: taskRows(), error: null },
  event_preparation_items: {
    data: [
      { item_id: 'm1', vendor_profile_id: null, due_date: '2026-11-05', label: 'Pick up the barong', notes: null, source_tag: 'couple_manual', kind: 'task', completed_at: null },
      { item_id: 'm2', vendor_profile_id: null, due_date: '2026-10-20', label: 'Send the deposit slip', notes: null, source_tag: 'couple_manual', kind: 'task', completed_at: '2026-10-21T00:00:00Z' },
    ],
    error: null,
  },
  event_vendor_line_items: { data: [{ line_item_id: 'l1', vendor_id: 'v1', label: 'Deposit', amount_php: 40000, due_date: '2026-11-12' }], error: null },
  event_vendors: { data: [{ vendor_id: 'v1', vendor_name: 'Casa Catering', category: 'catering' }], error: null },
  event_appointments: { data: [{ appointment_id: 'a1', vendor_profile_id: null, kind: 'in_person', type: 'food_tasting', custom_label: null, location: null, scheduled_at: '2026-11-14T06:00:00Z' }], error: null },
};

test('4 · the count-only read (Home, the board) equals the full list’s To do count', async () => {
  const base = { eventId: EVENT_ID, eventDate: EVENT_DATE, ceremonyType: 'catholic', now: NOW, event: EVENT };
  const full = await fetchPreparationAgenda({ ...base, supabase: client(TABLES).c });
  const todoOnly = client(TABLES);
  const count = await fetchPreparationAgenda({ ...base, supabase: todoOnly.c, only: 'todo' });
  assert.deepEqual(planningProgress(count.items), planningProgress(full.items));
  // The full list really did fold something (or this proves nothing about folds).
  assert.ok(full.items.some((i) => (i.folded?.length ?? 0) > 0));
  // And the count-only read asked for nothing it does not count.
  assert.deepEqual([...new Set(todoOnly.asked)].sort(), ['event_checklist_items', 'event_preparation_items']);
  const p = planningProgress(full.items);
  assert.equal(p.total, full.items.filter(isTodoItem).length);
  assert.equal(p.total, taskRows().length + 2, 'every task plus both hand-added rows');
  assert.equal(p.done, 3 + 1, 'three ticked tasks plus the ticked hand-added row');
});

test('4 · a refused task read says so — never a count of zero', async () => {
  const refused = { data: null, error: { code: '42501', message: 'permission denied' } };
  const agenda = await fetchPreparationAgenda({
    supabase: client({ ...TABLES, event_checklist_items: refused }).c,
    eventId: EVENT_ID,
    eventDate: EVENT_DATE,
    ceremonyType: null,
    now: NOW,
    only: 'todo',
  });
  assert.deepEqual(agenda.unread, ['task']);
});

test('4 · Home’s To do list, the board and the list’s own filter all count with planningProgress', () => {
  const home = src('lib/home-control.server.ts');
  assert.match(home, /fetchPreparationAgenda\(/, 'Home reads the one list');
  // (Home asks for four rows — its To do shows three, the fourth fills in when Now holds one; the counts are the same.)
  assert.match(home, /planningProgress\(agenda\.items(, 4)?\)/, 'Home counts with the one rule');
  const board = src('lib/planning-progress.server.ts');
  assert.match(board, /fetchPreparationAgenda\(/);
  assert.match(board, /planningProgress\(agenda\.items\)/);
  for (const caller of ['app/dashboard/(launcher)/page.tsx', 'lib/events-you-run.server.ts', 'app/dashboard/[eventId]/_components/event-dashboard.tsx']) {
    assert.match(src(caller), /readPlanningProgress\(/, `${caller} counts the plan through the one list`);
  }
  const view = src('app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx');
  assert.match(view, /const progress = planningProgress\(agenda\.items\)/);
  assert.match(view, /todoCount=\{progress\.total\}/, 'the filter shows the SAME total Home shows');
});

// ── 1 · one list ────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const PRODUCT = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))].map((p) => ({
  rel: relative(WEB, p),
  code: stripComments(readFileSync(p, 'utf8')),
}));

test('1 · the plan’s tasks are read in ONE place, and only the one list calls it', () => {
  const tableReaders = PRODUCT.filter((f) => /from\(\s*['"]event_checklist_items['"]\s*\)/.test(f.code)).map((f) => f.rel).sort();
  assert.deepEqual(tableReaders, ['app/dashboard/[eventId]/checklist-actions.ts', 'lib/checklist.ts'], 'only the reader and the seed/tick writes touch the table');
  const callers = PRODUCT.filter((f) => /\breadChecklistItems\(/.test(f.code) && f.rel !== 'lib/checklist.ts').map((f) => f.rel);
  assert.deepEqual(callers, ['lib/preparation.ts'], 'only the one list calls the reader');
  for (const f of PRODUCT) {
    assert.ok(!/\b(fetchChecklistProgress|fetchChecklistItems)\b/.test(f.code), `${f.rel}: a second checklist read is back`);
  }
});

test('1 · the old Checklist address forwards to Planning Stage’s To do filter and reads nothing', () => {
  const page = src('app/dashboard/[eventId]/checklist/page.tsx');
  assert.match(page, /redirect\(planningTodoHref\(eventId\)\)/);
  assert.ok(!/supabase|from\(/.test(page));
  const anchor = src('lib/checklist-anchor.ts');
  assert.match(anchor, /schedule\?view=preparation&filter=todo/);
});

// ── 2 · auto-tick still works ───────────────────────────────────────────────

test('2 · Planning Stage tops up and auto-ticks the tasks BEFORE its one read', () => {
  const page = src('app/dashboard/[eventId]/schedule/page.tsx');
  const seed = page.indexOf('await ensureChecklistSeeded(eventId)');
  const read = page.indexOf('await fetchPreparationAgenda(');
  assert.ok(seed > 0, 'the schedule page seeds + reconciles the tasks');
  assert.ok(read > seed, 'and does it before the list is read, so a tick lands on this render');
});

test('2 · the reconcile still only moves pending → done', () => {
  const actions = src('app/dashboard/[eventId]/checklist-actions.ts');
  assert.match(actions, /\.update\(\{ status: 'done' \}\)\s*\.eq\('event_id', eventId\)\s*\.eq\('status', 'pending'\)/);
});
