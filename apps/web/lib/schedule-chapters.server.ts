import 'server-only';
import { contactFrom, contactsByTask, type TaskContact } from '@/lib/task-contact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  CHAPTER_FIELDS,
  TASK_COLUMNS,
  chaptersFromBlocks,
  momentFactsFromBlocks,
  taskInputFromForm,
  taskRowFrom,
  type MomentOp,
  type Chapter,
  type MomentFacts,
  type MomentPapic,
  type MarchList,
  type TaskInput,
  type TaskPeople,
  type TaskRow,
} from './schedule-chapters';
import { fetchGuestGroupsByEventMeasured, fetchGuestsByEventMeasured, guestDisplayName, guestRoleLabel } from './guests';
import { crewLines, forPickOf, type ForPick } from './moment-for';

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

/**
 * 📇 Every task contact the caller may read on the event (4 additions (3), migration 20271303218631) — ONE read, by task.
 * The database decides who sees what: the couple and schedule helpers see all; a booked supplier only those on moments
 * they are on. A refused read is `{ ok: false }` (the sheet says so), never "no contacts".
 */
export async function readTaskContacts(supabase: SupabaseClient, eventId: string): Promise<Read<Record<string, TaskContact>>> {
  const { data, error } = await supabase.from('event_schedule_task_contacts').select('task_id, name, phone').eq('event_id', eventId);
  if (error || !data) {
    if (error) logQueryError('readTaskContacts', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  return { ok: true, value: Object.fromEntries(contactsByTask(data as { task_id: string; name: string; phone: string }[])) };
}

/**
 * 📇 Keep or remove one task's contact, on the caller's own client (RLS: the couple, or a helper with Edit on the
 * Schedule). Both blank removes it. Every write reads back what it changed — a refusal is said, never "saved".
 */
export async function setTaskContact(supabase: SupabaseClient, taskId: string, name: string, phone: string, userId: string | null): Promise<Wrote> {
  const parsed = contactFrom(name, phone);
  if (!parsed.ok) return parsed;
  if (!parsed.contact) {
    const { error } = await supabase.from('event_schedule_task_contacts').delete().eq('task_id', taskId);
    if (error) {
      logQueryError('setTaskContact.remove', error, { task_id: taskId }, 'graceful_degrade');
      return { ok: false, error: NOTHING_CHANGED };
    }
    return { ok: true, value: '' };
  }
  const { data, error } = await supabase
    .from('event_schedule_task_contacts')
    .upsert({ task_id: taskId, name: parsed.contact.name, phone: parsed.contact.phone, created_by: userId }, { onConflict: 'task_id' })
    .select('task_id');
  if (error || !data || data.length === 0) {
    if (error) logQueryError('setTaskContact', error, { task_id: taskId }, 'graceful_degrade');
    return { ok: false, error: 'The contact didn’t save — this account cannot edit the schedule, or the task is gone.' };
  }
  return { ok: true, value: taskId };
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
 * 📷 What deleting a moment does to Papic (migration 20271302139013): the captures of its chapter tagged with it
 * (`moment_block_id`), split into the ones it deletes and the ones that stay because they are also in another chapter
 * — the same split the database's delete trigger makes. Two head-free reads on the caller's own client (RLS: the
 * couple, or a helper with the Schedule). A refused read is `{ ok: false }`, never 0.
 */
export async function countMomentPapic(supabase: SupabaseClient, momentId: string, chapterId: string): Promise<Read<MomentPapic>> {
  const { data, error } = await supabase
    .from('papic_chapter_captures')
    .select('guest_capture_id, seat_photo_id')
    .eq('block_id', chapterId)
    .eq('moment_block_id', momentId);
  if (error || !data) {
    if (error) logQueryError('countMomentPapic', error, { block_id: momentId }, 'graceful_degrade');
    return { ok: false };
  }
  const rows = data as Array<{ guest_capture_id: string | null; seat_photo_id: string | null }>;
  if (rows.length === 0) return { ok: true, value: { removed: 0, stays: 0 } };
  const guests = rows.map((r) => r.guest_capture_id).filter((v): v is string => Boolean(v));
  const seats = rows.map((r) => r.seat_photo_id).filter((v): v is string => Boolean(v));
  const ors = [
    ...(guests.length ? [`guest_capture_id.in.(${guests.join(',')})`] : []),
    ...(seats.length ? [`seat_photo_id.in.(${seats.join(',')})`] : []),
  ];
  const { data: elsewhere, error: e2 } = await supabase
    .from('papic_chapter_captures')
    .select('guest_capture_id, seat_photo_id')
    .neq('block_id', chapterId)
    .or(ors.join(','));
  if (e2 || !elsewhere) {
    if (e2) logQueryError('countMomentPapic.elsewhere', e2, { block_id: momentId }, 'graceful_degrade');
    return { ok: false };
  }
  const away = new Set(
    (elsewhere as Array<{ guest_capture_id: string | null; seat_photo_id: string | null }>).map((r) => r.guest_capture_id ?? r.seat_photo_id),
  );
  const stays = rows.filter((r) => away.has(r.guest_capture_id ?? r.seat_photo_id)).length;
  return { ok: true, value: { removed: rows.length - stays, stays } };
}

/**
 * 📖 THE MOMENT SHEET'S ONE DOOR (Step 3b): a task added, changed or removed, or the chapter's Papic count read for
 * Delete moment's warning — run on the CALLER'S OWN client, so RLS decides (the couple and a helper with Edit on the
 * Schedule write; nobody else). Every write reads back what it changed (`addMomentTask` and friends).
 */
export async function runMomentOp(
  supabase: SupabaseClient,
  op: Exclude<MomentOp, 'march_set' | 'march_new' | 'ask_supplier'>,
  blockId: string,
  fd: FormData,
  userId: string,
): Promise<Wrote<string | number | MomentPapic>> {
  if (op === 'papic_count') {
    // `block_id` is the MOMENT; its chapter rides along — the count is that chapter's captures tagged with it.
    const chapterId = fd.get('chapter_id');
    if (typeof chapterId !== 'string' || !chapterId) return { ok: false, error: 'The Papic photos couldn’t be counted just now.' };
    const n = await countMomentPapic(supabase, blockId, chapterId);
    return n.ok ? n : { ok: false, error: 'The Papic photos couldn’t be counted just now.' };
  }
  if (op === 'task_remove') {
    const taskId = fd.get('task_id');
    if (typeof taskId !== 'string' || !taskId) return { ok: false, error: 'That task is gone.' };
    return deleteMomentTask(supabase, taskId);
  }
  if (op === 'contact_set') {
    // 📇 A task's contact (4 additions (3)): a name and a phone, or both blank to remove it.
    const taskId = fd.get('task_id');
    if (typeof taskId !== 'string' || !taskId) return { ok: false, error: 'Save the task first.' };
    return setTaskContact(supabase, taskId, String(fd.get('contact_name') ?? ''), String(fd.get('contact_phone') ?? ''), userId);
  }
  const eventId = String(fd.get('event_id') ?? '');
  if (op === 'for_set') {
    // 👷 Suppliers and crew ▾ — tick or untick one supplier, or one of their crew, on this moment.
    const pick = forPickOf(String(fd.get('for_key') ?? ''));
    if (!pick || !eventId) return { ok: false, error: 'Pick a supplier or one of their crew.' };
    return setMomentFor(supabase, eventId, blockId, pick, fd.get('on') === '1', userId);
  }
  const parsed = taskInputFromForm(fd);
  if (!parsed.ok) return parsed;
  // 👷 A line for a supplier (or their crew) puts the moment on that supplier's day — linked FIRST, so a line is never
  // written that their day cannot see.
  if (parsed.input.who.kind === 'supplier' && eventId) {
    const linked = await setMomentFor(supabase, eventId, blockId, { kind: 'supplier', vendorId: parsed.input.who.vendorId }, true, userId);
    if (!linked.ok) return linked;
  }
  if (op === 'task_add') return addMomentTask(supabase, blockId, parsed.input, userId);
  const taskId = fd.get('task_id');
  if (typeof taskId !== 'string' || !taskId) return { ok: false, error: 'That task is gone.' };
  return updateMomentTask(supabase, taskId, blockId, parsed.input);
}

/* ── 👷 Suppliers and crew ▾: who a moment is for ────────────────────────────────────────────────────────────────── */

type ForBlock = { block_id: string; parent_block_id: string | null; label: string; responsible_vendor_ids: string[] | null };

/** One block's supplier list, with `vendorId` added or taken out. Only `responsible_vendor_ids` — never `is_public`. */
async function writeBlockVendors(supabase: SupabaseClient, eventId: string, b: ForBlock, vendorId: string, on: boolean): Promise<boolean> {
  const was = b.responsible_vendor_ids ?? [];
  if (was.includes(vendorId) === on) return true;
  const next = on ? [...was, vendorId] : was.filter((v) => v !== vendorId);
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .update({ responsible_vendor_ids: next, updated_at: new Date().toISOString() })
    .eq('block_id', b.block_id)
    .eq('event_id', eventId)
    .select('block_id');
  if (error) logQueryError('setMomentFor.block', error, { block_id: b.block_id }, 'graceful_degrade');
  // RLS answers a refused UPDATE with ZERO rows and no error — counted, never "saved".
  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * 👷 A HOST'S MOMENT FOR ONE SUPPLIER OR ONE OF THEIR CREW (corpus SCHEDULE_CHAPTERS_BUILD_PLAN "A host's moment for one
 * supplier, coordinator or crew"; the pure half and its reasons are `lib/moment-for.ts`).
 *   · a SUPPLIER ticked → their booking joins the moment's `responsible_vendor_ids` AND its chapter's, so the moment is
 *     "yours" on their day (Customer › Schedule) inside a chapter they are linked to. Unticked → off the moment only
 *     (the chapter may hold their other moments); refused, in words, while they still have lines on it.
 *   · a CREW member ticked → the same link, then ONE line on the moment for them (`vendor_id` + `crew`, `what` = the
 *     moment's name — the shape the supplier's own "Who on our side" writes). Unticked → that crew's lines on it go.
 * Visible to guests is NOT touched: guests read a moment only through `onlyWhatGuestsMaySee` (`is_public` + Everyone),
 * and neither table write here names it. Every write runs on the caller's own client (RLS decides) and is read back.
 * Answers: the supplier's booking · the crew's line id · the removed line ids, comma-separated.
 */
export async function setMomentFor(
  supabase: SupabaseClient,
  eventId: string,
  momentId: string,
  pick: ForPick,
  on: boolean,
  userId: string | null,
): Promise<Wrote<string>> {
  const { data: moment, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, parent_block_id, label, responsible_vendor_ids')
    .eq('block_id', momentId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !moment) {
    if (error) logQueryError('setMomentFor.moment', error, { block_id: momentId }, 'graceful_degrade');
    return { ok: false, error: NOTHING_CHANGED };
  }
  const m = moment as ForBlock;
  const { vendorId } = pick;
  const { data: lines, error: linesErr } = await supabase
    .from('event_schedule_tasks')
    .select(TASK_COLUMNS)
    .eq('block_id', momentId)
    .eq('vendor_id', vendorId);
  if (linesErr || !lines) {
    if (linesErr) logQueryError('setMomentFor.lines', linesErr, { block_id: momentId }, 'graceful_degrade');
    return { ok: false, error: 'Their lines on this moment couldn’t be read just now — try again.' };
  }
  const theirs = lines as unknown as TaskRow[];

  if (!on && pick.kind === 'supplier') {
    if (theirs.length > 0) {
      return {
        ok: false,
        error: `They still have ${theirs.length === 1 ? 'a line' : `${theirs.length} lines`} on this moment — untick their crew or remove those tasks first.`,
      };
    }
    return (await writeBlockVendors(supabase, eventId, m, vendorId, false)) ? { ok: true, value: vendorId } : { ok: false, error: NOTHING_CHANGED };
  }

  if (!on && pick.kind === 'crew') {
    const ids = crewLines(theirs, vendorId, pick.crew).map((t) => t.task_id);
    if (ids.length === 0) return { ok: true, value: '' };
    const { data: gone, error: delErr } = await supabase.from('event_schedule_tasks').delete().in('task_id', ids).select('task_id');
    if (delErr || !gone || gone.length === 0) {
      if (delErr) logQueryError('setMomentFor.crewOff', delErr, { block_id: momentId }, 'graceful_degrade');
      return { ok: false, error: NOTHING_CHANGED };
    }
    return { ok: true, value: (gone as Array<{ task_id: string }>).map((t) => t.task_id).join(',') };
  }

  // On: the moment, then its chapter — a moment of theirs inside a chapter they are not linked to would sit under
  // "All chapters" on their day, never under "My chapters".
  if (!(await writeBlockVendors(supabase, eventId, m, vendorId, true))) return { ok: false, error: NOTHING_CHANGED };
  if (m.parent_block_id) {
    const { data: chapter } = await supabase
      .from('event_schedule_blocks')
      .select('block_id, parent_block_id, label, responsible_vendor_ids')
      .eq('block_id', m.parent_block_id)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!chapter || !(await writeBlockVendors(supabase, eventId, chapter as ForBlock, vendorId, true))) {
      return { ok: false, error: 'The moment is theirs now, but its chapter didn’t link — try again.' };
    }
  }
  if (pick.kind === 'supplier') return { ok: true, value: vendorId };

  const already = crewLines(theirs, vendorId, pick.crew)[0];
  if (already) return { ok: true, value: already.task_id };
  return addMomentTask(supabase, momentId, { who: { kind: 'supplier', vendorId, crew: pick.crew }, what: m.label || 'Their part', sortOrder: 0 }, userId);
}

/* ── 🚶 "This is a march": the marches a moment can pick (migration 20271301571290) ────────────────────────────────── */

/**
 * The couple's own marches (`march_groups`, made in Guests › March) for the moment sheet's "This is a march" dropdown —
 * ONE read, on the caller's own client. A refused read is `{ ok: false }`: the sheet says so, never "no marches".
 * (A coordinator who may not read the guest list gets no rows — not an error; a moment already linked keeps its line,
 * `marchPickOptions`.)
 */
export async function readMarchList(supabase: SupabaseClient, eventId: string): Promise<MarchList> {
  const { data, error } = await supabase
    .from('march_groups')
    .select('group_key, label')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error || !data) {
    if (error) logQueryError('readMarchList', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  return {
    ok: true,
    marches: (data as Array<{ group_key: string; label: string }>).map((r) => ({ key: r.group_key, label: r.label })),
  };
}

/**
 * A moment becomes one march, or none (`key` null) — the moment's own row and nothing else: clearing the link never
 * touches the march. The database refuses a march of another event or one that is gone (`march_not_found`). Counted:
 * a zero-row UPDATE is success-shaped.
 */
export async function linkMomentMarch(supabase: SupabaseClient, eventId: string, momentId: string, key: string | null): Promise<Wrote<string>> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .update({ march_key: key })
    .eq('block_id', momentId)
    .eq('event_id', eventId)
    .not('parent_block_id', 'is', null)
    .select('block_id');
  if (error) {
    if (/march_not_found/.test(error.message ?? '')) return { ok: false, error: 'That march is gone — pick another.' };
    logQueryError('linkMomentMarch', error, { block_id: momentId }, 'graceful_degrade');
    return { ok: false, error: 'It didn’t save — try again.' };
  }
  if (!data || data.length === 0) return { ok: false, error: NOTHING_CHANGED };
  return { ok: true, value: key ?? '' };
}
