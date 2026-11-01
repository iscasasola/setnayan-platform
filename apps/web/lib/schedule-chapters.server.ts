import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { CHAPTER_FIELDS, TASK_COLUMNS, chaptersFromBlocks, taskRowFrom, type Chapter, type TaskInput, type TaskRow } from './schedule-chapters';

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
  return { ok: true, value: chaptersFromBlocks(data as unknown as Parameters<typeof chaptersFromBlocks>[0]) };
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
