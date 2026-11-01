import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  CHAPTER_FIELDS,
  TASK_COLUMNS,
  chaptersFromBlocks,
  momentFactsFromBlocks,
  taskRowFrom,
  type Chapter,
  type MomentFacts,
  type TaskInput,
  type TaskPeople,
  type TaskRow,
  type TaskWho,
} from './schedule-chapters';
import { fetchGuestGroupsByEventMeasured, fetchGuestsByEventMeasured, guestDisplayName, guestRoleLabel } from './guests';

/**
 * 📖 CHAPTERS AND TASKS — the server half (migration 20271300072429; the pure half is lib/schedule-chapters.ts).
 *
 * Every function runs on the CALLER'S OWN client, so RLS decides who may read or write: the couple and a helper with
 * Edit on the Schedule write; a booked supplier reads; a guest reads nothing. Nothing here uses the admin client.
 *
 * 🛑 HONEST READS AND WRITES (CLAUDE.md "a failure that renders identically to success or to emptiness"):
 *   · a refused or failed read is `{ ok: false }` — never `[]`, which would draw "No chapters yet" over a real day;
 *   · a write that reached no row (RLS answers a refused UPDATE/DELETE with ZERO rows and no error) is a failure in
 *     words, never "saved" — every write reads back what it changed.
 *
 * The task helpers are the Step 2 server half of "a moment holds parallel tasks"; their screens are Step 3.
 */

export type Read<T> = { ok: true; value: T } | { ok: false };
export type Wrote<T = string> = { ok: true; value: T } | { ok: false; error: string };

const NOT_READ = 'chapters';
const NOTHING_CHANGED = 'Nothing changed — it is gone, or this account cannot edit the schedule.';

/** The event's chapters, in time order, each with its moment count — ONE read of the event's blocks. */
export async function readChapters(supabase: SupabaseClient, eventId: string): Promise<Read<Chapter[]>> {
  const book = await readChapterBook(supabase, eventId);
  return book.ok ? { ok: true, value: book.value.chapters } : book;
}

/**
 * 📖 The chapters AND each moment's own facts (its room, Optional, travel from → to) — the SAME one read of the event's
 * blocks, split twice (Step 3b: the moment sheet edits them). Never a second read of the blocks.
 */
export async function readChapterBook(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Read<{ chapters: Chapter[]; moments: MomentFacts[] }>> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select(CHAPTER_FIELDS)
    .eq('event_id', eventId)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error || !data) {
    if (error) logQueryError(`readChapters.${NOT_READ}`, error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  const rows = data as unknown as Parameters<typeof chaptersFromBlocks>[0];
  return { ok: true, value: { chapters: chaptersFromBlocks(rows), moments: momentFactsFromBlocks(rows) } };
}

/** Every task on the event's moments — ONE read. A booked supplier gets the tasks RLS lets them see. */
export async function readMomentTasks(supabase: SupabaseClient, eventId: string): Promise<Read<TaskRow[]>> {
  const { data, error } = await supabase
    .from('event_schedule_tasks')
    .select(TASK_COLUMNS)
    .eq('event_id', eventId)
    .order('block_id', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error || !data) {
    if (error) logQueryError('readMomentTasks', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  return { ok: true, value: data as unknown as TaskRow[] };
}

/** Add one task to a moment. The database derives its event from the moment and refuses a who on another event. */
export async function addMomentTask(supabase: SupabaseClient, blockId: string, input: TaskInput, userId: string | null): Promise<Wrote> {
  const built = taskRowFrom(blockId, input);
  if (!built.ok) return built;
  const { data, error } = await supabase
    .from('event_schedule_tasks')
    .insert({ ...built.row, created_by: userId })
    .select('task_id')
    .maybeSingle();
  if (error || !data) {
    if (error) logQueryError('addMomentTask', error, { block_id: blockId }, 'graceful_degrade');
    return { ok: false, error: 'The task didn’t save — this account cannot edit the schedule, or the moment is gone.' };
  }
  return { ok: true, value: (data as { task_id: string }).task_id };
}

/** Change one task (who, what, call time, place, order). Reads back what it changed. */
export async function updateMomentTask(supabase: SupabaseClient, taskId: string, blockId: string, input: TaskInput): Promise<Wrote> {
  const built = taskRowFrom(blockId, input);
  if (!built.ok) return built;
  const { data, error } = await supabase.from('event_schedule_tasks').update(built.row).eq('task_id', taskId).select('task_id');
  if (error) {
    logQueryError('updateMomentTask', error, { task_id: taskId }, 'graceful_degrade');
    return { ok: false, error: 'The task didn’t save. Try again.' };
  }
  if (!data || data.length === 0) return { ok: false, error: NOTHING_CHANGED };
  return { ok: true, value: taskId };
}

/** Remove one task. Reads back what it removed. */
export async function deleteMomentTask(supabase: SupabaseClient, taskId: string): Promise<Wrote> {
  const { data, error } = await supabase.from('event_schedule_tasks').delete().eq('task_id', taskId).select('task_id');
  if (error) {
    logQueryError('deleteMomentTask', error, { task_id: taskId }, 'graceful_degrade');
    return { ok: false, error: 'The task wasn’t removed. Try again.' };
  }
  if (!data || data.length === 0) return { ok: false, error: NOTHING_CHANGED };
  return { ok: true, value: taskId };
}

/* ── Step 3b: who a task can name, the Papic count, and the moment sheet's one door ─────────────────────────────── */


/**
 * The event's people and groups for Who ▾ — the canonical measured reads (`lib/guests.ts`), so removed guests and
 * join requests are never offered. A refused read is `{ ok: false }`: the sheet says so, never an empty list.
 */
export async function readTaskPeople(supabase: SupabaseClient, eventId: string): Promise<Read<TaskPeople>> {
  const [guests, groups] = await Promise.all([fetchGuestsByEventMeasured(supabase, eventId), fetchGuestGroupsByEventMeasured(supabase, eventId)]);
  if (!guests.measured || !groups.measured) return { ok: false };
  const roles = new Map<string, string>();
  for (const g of guests.rows) if (g.role && g.role !== 'guest' && !roles.has(g.role)) roles.set(g.role, guestRoleLabel(g.role));
  return {
    ok: true,
    value: {
      guests: guests.rows.map((g) => ({ id: g.guest_id, name: guestDisplayName(g), role: g.role })),
      groups: groups.groups.map((g) => ({ id: g.group_id, name: g.label })),
      roles: [...roles].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

/**
 * How many Papic photos and videos were shot into a chapter (`papic_chapter_captures`, migration 20271300249267 — a
 * capture links to a CHAPTER, never a moment). A head count: no rows travel. A refused read is `{ ok: false }`.
 */
export async function countChapterPapic(supabase: SupabaseClient, chapterId: string): Promise<Read<number>> {
  const { count, error } = await supabase
    .from('papic_chapter_captures')
    .select('link_id', { count: 'exact', head: true })
    .eq('block_id', chapterId);
  if (error || typeof count !== 'number') {
    if (error) logQueryError('countChapterPapic', error, { block_id: chapterId }, 'graceful_degrade');
    return { ok: false };
  }
  return { ok: true, value: count };
}

/** The moment sheet's operations, posted as `moment_op` on the Schedule's own update door (no new server action). */
export const MOMENT_OPS = ['task_add', 'task_save', 'task_remove', 'papic_count'] as const;
export type MomentOp = (typeof MOMENT_OPS)[number];
export function isMomentOp(v: unknown): v is MomentOp {
  return typeof v === 'string' && (MOMENT_OPS as readonly string[]).includes(v);
}

const WHO_KINDS = ['supplier', 'guest', 'group', 'role', 'label'] as const;
/** A call time is posted as the stored wall clock itself (`wallIso`): "2026-12-18T07:30:00.000Z". */
const WALL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;

/** A task as posted → its input, or what is wrong in words. */
export function taskInputFromForm(fd: FormData): { ok: true; input: TaskInput } | { ok: false; error: string } {
  const kind = fd.get('who_kind');
  const ref = String(fd.get('who_ref') ?? '').trim();
  if (typeof kind !== 'string' || !(WHO_KINDS as readonly string[]).includes(kind) || !ref) return { ok: false, error: 'Pick who does it.' };
  const crew = String(fd.get('crew') ?? '').trim() || null;
  const who: TaskWho =
    kind === 'supplier'
      ? { kind: 'supplier', vendorId: ref, crew }
      : kind === 'guest'
        ? { kind: 'guest', guestId: ref }
        : kind === 'group'
          ? { kind: 'group', groupId: ref }
          : kind === 'role'
            ? { kind: 'role', role: ref }
            : { kind: 'label', label: ref };
  const callRaw = String(fd.get('call_at') ?? '').trim();
  if (callRaw && !WALL_ISO.test(callRaw)) return { ok: false, error: 'That call time could not be read.' };
  const sort = Number(fd.get('sort_order') ?? 0);
  return {
    ok: true,
    input: {
      who,
      what: String(fd.get('what') ?? ''),
      callAt: callRaw || null,
      place: String(fd.get('place') ?? ''),
      sortOrder: Number.isInteger(sort) ? sort : 0,
    },
  };
}

/**
 * 📖 THE MOMENT SHEET'S ONE DOOR (Step 3b): a task added, changed or removed, or the chapter's Papic count read for
 * Delete moment's warning — run on the CALLER'S OWN client, so RLS decides (the couple and a helper with Edit on the
 * Schedule write; nobody else). Every write reads back what it changed (`addMomentTask` and friends).
 */
export async function runMomentOp(
  supabase: SupabaseClient,
  op: MomentOp,
  blockId: string,
  fd: FormData,
  userId: string,
): Promise<Wrote<string | number>> {
  if (op === 'papic_count') {
    const n = await countChapterPapic(supabase, blockId);
    return n.ok ? n : { ok: false, error: 'The Papic photos couldn’t be counted just now.' };
  }
  if (op === 'task_remove') {
    const taskId = fd.get('task_id');
    if (typeof taskId !== 'string' || !taskId) return { ok: false, error: 'That task is gone.' };
    return deleteMomentTask(supabase, taskId);
  }
  const parsed = taskInputFromForm(fd);
  if (!parsed.ok) return parsed;
  if (op === 'task_add') return addMomentTask(supabase, blockId, parsed.input, userId);
  const taskId = fd.get('task_id');
  if (typeof taskId !== 'string' || !taskId) return { ok: false, error: 'That task is gone.' };
  return updateMomentTask(supabase, taskId, blockId, parsed.input);
}
