/**
 * a-crew-tag-reaches-the-suppliers-day.test.ts — 👷 A HOST'S MOMENT FOR ONE SUPPLIER OR ONE OF THEIR CREW.
 *
 * Owner 2026-11-01: *"but for owners, they can also create a moment that is for a specific supplier/coordinator/ or a
 * supplier or coordinator's crew/their own moment, etc"* (corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md, "A host's
 * moment for one supplier, coordinator or crew": *"Picking a crew member also links their supplier to the moment and the
 * chapter. It shows on that supplier's day, marked yours, with the crew member's name … A moment isn't shown to guests
 * unless Visible to guests is on."*).
 *
 * EXECUTED, not read: the moment sheet's ONE door (`runMomentOp` → `setMomentFor`) runs against an in-memory event, and
 * what it leaves behind is handed to the SUPPLIER'S OWN day builder (`buildSupplierDay`) and to the GUESTS' ONE FENCE
 * (`onlyWhatGuestsMaySee`). Held as properties:
 *   1. a crew tag links the supplier to the moment AND its chapter, and their day shows it yours, with the crew's name;
 *   2. a task line for a supplier (the Tasks section's Who ▾) links them too — before the line is written;
 *   3. a tagged moment never reaches a guest read unless Visible to guests is on — the tag writes nothing the fence reads;
 *   4. unticking a crew takes only that crew's lines; unticking a supplier who still has lines is refused in words;
 *   5. the dropdown is two sections, Suppliers and Crew, and a typed name is offered as a new crew of each supplier.
 *
 * Sabotage (2026-11-02, each reverted, each red): the chapter link in `setMomentFor` removed (1) · the supplier link in
 * `runMomentOp`'s task path removed (2) · `is_public: true` added to `writeBlockVendors`' update (3) · `crewLines`
 * matching every crew of the supplier (4).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSupplierDay, type SupplierBlockRow } from './supplier-schedule';
import { onlyWhatGuestsMaySee } from './schedule';
import { forOptions, forPickOf, forPicked, forWords } from './moment-for';

/* ── `server-only` shim (the shape of lib/a-locked-deal-reaches-the-budget.test.ts) ───────────────────────────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_crew_tag__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

let server: typeof import('./schedule-chapters.server');
before(async () => {
  server = await import('./schedule-chapters.server');
});

/* ── an in-memory event: the two tables the door touches, and every write it makes ───────────────────────────── */

type Row = Record<string, unknown>;
type Write = { table: string; op: 'update' | 'insert' | 'delete'; payload: unknown };

function fakeEvent(blocks: Row[], tasks: Row[] = []) {
  const tables: { event_schedule_blocks: Row[]; event_schedule_tasks: Row[] } & Record<string, Row[]> = {
    event_schedule_blocks: blocks,
    event_schedule_tasks: tasks,
  };
  const writes: Write[] = [];
  let next = 1;
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | Write['op'] = 'select';
    let payload: Row | null = null;
    const run = () => {
      const all = tables[table] ?? [];
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'select') return { data: hit.map((r) => ({ ...r })), error: null };
      writes.push({ table, op, payload });
      if (op === 'update') {
        for (const r of hit) Object.assign(r, payload);
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (op === 'delete') {
        tables[table] = all.filter((r) => !hit.includes(r));
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      const row = { task_id: `task-${next++}`, ...payload };
      all.push(row);
      return { data: [{ ...row }], error: null };
    };
    const q = {
      select: () => q,
      order: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      update: (p: Row) => ((op = 'update'), (payload = p), q),
      insert: (p: Row) => ((op = 'insert'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      maybeSingle: async () => {
        const r = run();
        return { data: r.data[0] ?? null, error: null };
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  };
  return { db: { from } as unknown as SupabaseClient, tables, writes };
}

const EVENT = 'e-1';
const CHAPTER = 'b-chapter';
const MOMENT = 'b-moment';
const HMUA = 'v-hmua';

function block(id: string, parent: string | null, label: string, hhmm: string): Row {
  return {
    block_id: id,
    event_id: EVENT,
    parent_block_id: parent,
    label,
    start_at: `2026-12-18T${hhmm}:00.000Z`,
    end_at: null,
    location: 'Hotel Aurora',
    spot: null,
    time_tba: false,
    is_optional: false,
    is_public: false,
    audience: null,
    visibility: 'everyone',
    responsible_vendor_ids: [],
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
  };
}

const freshEvent = (tasks: Row[] = []) =>
  fakeEvent([block(CHAPTER, null, 'Preparation', '06:00'), block(MOMENT, CHAPTER, 'Hair and make-up starts', '06:30')], tasks);

/** What the supplier's own page builds from the same rows — their bookings on the event are `[HMUA]`. */
function theirDay(tables: { event_schedule_blocks: Row[]; event_schedule_tasks: Row[] }) {
  return buildSupplierDay({
    blocks: tables.event_schedule_blocks as unknown as SupplierBlockRow[],
    myBookingIds: [HMUA],
    tasks: tables.event_schedule_tasks as unknown as Array<{ block_id: string; vendor_id: string | null; crew: string | null }>,
    requests: [],
  });
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set('event_id', EVENT);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test('1 · a crew tag links the supplier to the moment and its chapter — their day shows it yours, with the name', async () => {
  const { db, tables } = freshEvent();
  const r = await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `n:${HMUA}:Jubert`, on: '1' }), 'u-host');
  assert.equal(r.ok, true, r.ok ? '' : r.error);

  const day = theirDay(tables);
  const chapter = day.chapters.find((c) => c.block_id === CHAPTER);
  assert.equal(chapter?.linked, true, 'the chapter is not linked to the supplier — the moment would sit outside "My chapters"');
  const moment = chapter?.moments.find((m) => m.block_id === MOMENT);
  assert.equal(moment?.mine, true, 'the moment is not "yours" on the supplier’s day');
  assert.deepEqual(moment?.crew, ['Jubert'], 'the crew member’s name does not reach the supplier’s day');
  // The line the crew is on carries the moment's name, as the supplier's own "Who on our side" writes it.
  assert.equal(tables.event_schedule_tasks.length, 1);
  assert.equal(tables.event_schedule_tasks[0]!.what, 'Hair and make-up starts');

  // Ticking the same crew again adds no second line.
  const again = await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `c:${HMUA}:jubert`, on: '1' }), 'u-host');
  assert.equal(again.ok, true);
  assert.equal(tables.event_schedule_tasks.length, 1, 'a second tick of one crew wrote a second line');
});

test('2 · a task line for a supplier links them first — the Tasks section’s Who ▾ reaches their day too', async () => {
  const { db, tables } = freshEvent();
  const r = await server.runMomentOp(
    db,
    'task_add',
    MOMENT,
    form({ who_kind: 'supplier', who_ref: HMUA, crew: 'Team B', what: 'Bridesmaids’ hair', call_at: '', place: '', sort_order: '0' }),
    'u-host',
  );
  assert.equal(r.ok, true, r.ok ? '' : r.error);
  const moment = theirDay(tables).chapters.find((c) => c.block_id === CHAPTER)?.moments.find((m) => m.block_id === MOMENT);
  assert.equal(moment?.mine, true, 'a supplier’s line was written on a moment their day does not call theirs');
  assert.deepEqual(moment?.crew, ['Team B']);
});

test('3 · a tagged moment never reaches a guest read unless Visible to guests is on', async () => {
  const { db, tables, writes } = freshEvent();
  assert.equal((await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `n:${HMUA}:Jubert`, on: '1' }), 'u-host')).ok, true);
  assert.equal((await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `s:${HMUA}`, on: '1' }), 'u-host')).ok, true);

  // The tag writes nothing the guests' fence reads.
  for (const w of writes) {
    for (const k of ['is_public', 'audience', 'visibility']) {
      assert.equal(Object.prototype.hasOwnProperty.call(w.payload ?? {}, k), false, `a tag wrote ${k} on ${w.table}`);
    }
  }
  const guestsSee = async () =>
    ((await onlyWhatGuestsMaySee(db.from('event_schedule_blocks').select('block_id').eq('event_id', EVENT))) as unknown as { data: Row[] }).data.map(
      (r) => r.block_id,
    );
  assert.deepEqual(await guestsSee(), [], 'a hidden moment tagged for a crew reached the guests’ read');

  // Visible to guests — the one switch that shows it.
  const m = tables.event_schedule_blocks.find((b) => b.block_id === MOMENT)!;
  m.is_public = true;
  assert.deepEqual(await guestsSee(), [MOMENT]);
});

test('4 · untick a crew takes only its lines; untick a supplier who still has lines is refused in words', async () => {
  const { db, tables } = freshEvent([
    { task_id: 't-a', block_id: MOMENT, event_id: EVENT, vendor_id: HMUA, crew: 'Team A', what: 'Bride' },
    { task_id: 't-b', block_id: MOMENT, event_id: EVENT, vendor_id: HMUA, crew: 'Team B', what: 'Bridesmaids' },
  ]);
  tables.event_schedule_blocks.find((b) => b.block_id === MOMENT)!.responsible_vendor_ids = [HMUA];

  const refused = await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `s:${HMUA}`, on: '0' }), 'u-host');
  assert.equal(refused.ok, false, 'a supplier with lines on the moment was taken off it, leaving lines their day cannot see');
  assert.match(refused.ok ? '' : refused.error, /2 lines/);

  const off = await server.runMomentOp(db, 'for_set', MOMENT, form({ for_key: `c:${HMUA}:team a`, on: '0' }), 'u-host');
  assert.equal(off.ok, true);
  assert.deepEqual(
    tables.event_schedule_tasks.map((t) => t.task_id),
    ['t-b'],
    'unticking one crew removed another crew’s line',
  );
});

test('5 · the dropdown: Suppliers and Crew, ticks from the moment, a typed name offered as a new crew', () => {
  const suppliers = [
    { id: HMUA, name: 'Glow HMUA' },
    { id: 'v-photo', name: 'Lightbox Studio' },
  ];
  const crews = [{ vendorId: HMUA, crew: 'Team B' }];
  const all = forOptions({ suppliers, crews, query: '' });
  assert.deepEqual([...new Set(all.map((o) => o.group))], ['Suppliers', 'Crew']);
  assert.ok(all.some((o) => o.key === `c:${HMUA}:Team B` && o.label === 'Team B · Glow HMUA'));

  const typed = forOptions({ suppliers, crews, query: 'Jubert' });
  assert.deepEqual(
    typed.filter((o) => o.group === 'Crew').map((o) => o.key),
    [`n:${HMUA}:Jubert`, 'n:v-photo:Jubert'],
    'a typed name is not offered as a new crew of each supplier',
  );
  assert.deepEqual(forPickOf(`n:${HMUA}:Jubert`), { kind: 'crew', vendorId: HMUA, crew: 'Jubert' });

  const momentTasks = [{ vendor_id: HMUA, crew: 'Team B' }];
  assert.deepEqual(forPicked([HMUA], momentTasks), [`s:${HMUA}`, `c:${HMUA}:Team B`]);
  assert.equal(forWords([HMUA], momentTasks, suppliers), 'Glow HMUA · Team B');
  assert.equal(forWords([], [], suppliers), 'Nobody in particular');
});
