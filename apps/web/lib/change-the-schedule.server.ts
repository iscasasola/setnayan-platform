import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { logQueryError } from './supabase/error-detect';
import { onlyWhatABookedShopMaySee } from './schedule';
import { isTimeTba } from './time-tba';
import { checkRetime } from './floor-command';
import { notifyScheduleShifted } from './schedule-shift-notify.server';
import { notifyScheduleRequest } from './schedule-request-notify.server';
import { emitNotification } from './notification-emit';
import { fetchOwnVendorProfile } from './vendor-profile';
import {
  changedWords,
  guestNotice,
  guestsSeePart,
  partsThatFollow,
  requestWords,
  type ChangeablePart,
  type CrewSkipAsk,
  type ScheduleChange,
} from './change-the-schedule';

/**
 * 🗓 CHANGE THE SCHEDULE — the server half (owner 2026-11-04; the rule and the words are `lib/change-the-schedule.ts`).
 *
 * WHO MAY (owner 2026-11-05, DECISION_LOG "WHO CHANGES THE SCHEDULE…"):
 *   · `floor` — a CHANGE, on the caller's OWN session: the booked coordinator, the couple, or a delegate the hosts lent
 *     The Day = Edit (an emcee — "Edit … only until their coverage": the shipped access window). One gate, the shipped
 *     `mayAdvance` that "Done · next" asks (`lib/run-of-show-advance.ts`); then RLS decides the write. A move is the
 *     shipped running-late write (`running_late_shift_schedule`, all or nothing), a skip an UPDATE of `run_state`.
 *   · `crew`  — a crew Member's phone ASKS, never writes (D): `crew_request_schedule_move` files the shipped requests
 *     (`event_schedule_suggestions`) and the coordinator / hosts approve them with one tap. A SKIP is asked too (owner
 *     2026-11-05, *"yes they can request"*): `crew_request_schedule_skip` files one ask of kind 'skip', the coordinator
 *     is told in the app and answers it on the floor, and an approved skip runs THIS function's own floor Skip (the ONE
 *     accept path, `decideSuggestion`). The phone cannot read the schedule under RLS, so the parts are read here on the
 *     service role, fenced exactly as the crew phone's own read is (`onlyWhatABookedShopMaySee`) — and nothing read here
 *     goes back to the caller before the database said yes.
 *
 * 🔒 A locked supplier's part: a MOVE passes (the owner's running-late ruling, DECISION_LOG 2026-11-03 (2)) and the
 * supplier is told; a SKIP is refused by the database with the lock's calm line, handed back as `locked` so the sheet
 * offers the request instead of a dead end.
 *
 * After a floor change landed: ONE notice per booked supplier and, when guests can see the part, ONE in-app notice per guest
 * account (`notifyScheduleShifted` — the shipped shift notice, never a second one).
 */

export type ChangeAnswer =
  | { ok: true; message: string; moved: readonly string[]; requested?: boolean }
  | { ok: false; error: string; locked?: string | null };

type PartRow = ChangeablePart & { is_public: boolean | null; audience: string | null; parent_block_id: string | null };

const PART_COLUMNS = 'block_id, label, start_at, run_state, time_tba, parent_block_id, is_public, audience';

const NO_EDIT = 'Nothing changed — the hosts have not given you edit access to the schedule.';

/** The lock's calm line, from the database's refusal — "<shop> isn't taking changes. Send them a request instead." */
function lockedShopOf(err: { message?: string; hint?: string | null } | null): string | null {
  if (!err?.message) return null;
  if (err.hint !== 'supplier_part_locked' && !/isn.t taking changes/.test(err.message)) return null;
  return err.message.replace(/ isn.t taking changes[\s\S]*$/, '').trim() || 'The supplier';
}

/** The crew door's refusals, as sentences a phone on the floor can act on. */
function crewRefusal(message: string | undefined): string {
  if (message?.includes('no_crew_pass')) return 'This phone is not on the crew for this event right now.';
  if (message?.includes('not_a_member')) return 'Asking to change the schedule is for a Member of the crew — ask the shop.';
  if (message?.includes('not_the_coordinator')) return 'Asking to change the schedule is for the coordinator’s crew.';
  return 'Nothing changed — try again.';
}

export async function changeTheSchedule(
  supabase: SupabaseClient,
  actorUserId: string,
  eventId: string,
  change: ScheduleChange,
  via: 'floor' | 'crew',
): Promise<ChangeAnswer> {
  if (change.op === 'move') {
    const check = checkRetime(change.minutes);
    if (!check.ok) return { ok: false, error: check.reason === 'too_large' ? 'That is more than 12 hours.' : 'Pick how many minutes first.' };
  } else if (change.op !== 'skip' && change.op !== 'unskip') {
    return { ok: false, error: 'Pick Move or Skip first.' };
  }

  // ── the parts, as this caller's own door may see them ──
  const reader = via === 'crew' ? createAdminClient() : supabase;
  const base = reader.from('event_schedule_blocks').select(PART_COLUMNS).eq('event_id', eventId);
  const { data, error: readErr } = await (via === 'crew' ? onlyWhatABookedShopMaySee(base) : base);
  if (readErr) {
    logQueryError('changeTheSchedule.parts', readErr, { eventId, via }, 'graceful_degrade');
    return { ok: false, error: 'Couldn’t read the schedule — try again.' };
  }
  const rows = (data ?? []) as PartRow[];
  const part = rows.find((p) => p.block_id === change.blockId) ?? null;
  if (!part) return { ok: false, error: 'That part is no longer on the schedule.' };
  // ⏰ A Time-TBA chapter has no time to move from (its 00:00 is a placeholder) — said, never "moved from 12:00 AM";
  // and a TBA chapter is never carried along by a move from a timed one.
  const fromTop = part.parent_block_id ? rows.find((b) => b.block_id === part.parent_block_id) ?? part : part;
  if (isTimeTba(part) || isTimeTba(fromTop)) return { ok: false, error: 'That part of the day has no time yet (Time TBA) — nothing to change.' };
  const parts = rows.filter((b) => !isTimeTba(b));

  // ── which rows the change touches ──
  let ids: string[];
  if (change.op === 'move') {
    // Undo hands back the exact rows the move carried, so a move earlier is undone row for row.
    const known = new Set(parts.map((p) => p.block_id));
    ids = change.ids?.length ? change.ids.filter((id) => known.has(id)) : partsThatFollow(parts, change.blockId).map((p) => p.block_id);
    if (ids.length === 0) return { ok: false, error: 'That part has already run — nothing to move.' };
  } else {
    if (change.op === 'skip' && part.run_state !== 'upcoming') return { ok: false, error: 'Only a part that has not started can be skipped.' };
    if (change.op === 'unskip' && part.run_state !== 'skipped') return { ok: false, error: 'That part is not skipped.' };
    ids = [part.block_id];
  }

  // ── a crew phone ASKS (owner 2026-11-05 (D)): requests the coordinator / hosts approve with one tap ──
  if (via === 'crew' && change.op === 'skip') return askToSkip(supabase, eventId, part);
  if (via === 'crew') {
    if (change.op !== 'move') return { ok: false, error: 'From the crew phone you can ask to move or skip a part.' };
    const { data: n, error: crewErr } = await supabase.rpc('crew_request_schedule_move', {
      p_event_id: eventId,
      p_block_ids: ids,
      p_minutes: change.minutes,
    });
    if (crewErr) {
      if (crewErr.code === 'P0002') return { ok: false, error: 'Nothing sent — the schedule moved meanwhile. Open it again.' };
      return { ok: false, error: crewRefusal(crewErr.message) };
    }
    if (n !== ids.length) return { ok: false, error: 'Nothing sent — the schedule moved meanwhile. Open it again.' };
    // Tell everyone who can approve it — the shipped request notice (the couple + a coordinator holding The Day = Edit).
    // Best-effort: the request is filed; a failed notice never undoes it.
    try {
      await notifyScheduleRequest({
        eventId,
        supplierName: 'The coordinator’s crew',
        kind: 'adjust',
        itemLabel: part.label,
        proposesChange: true,
        note: requestWords(change.minutes, part, ids.length),
      });
    } catch (e) {
      logQueryError('changeTheSchedule.requestNotice', { message: String(e) }, { eventId }, 'graceful_degrade');
    }
    return { ok: true, message: 'Sent to the hosts — they approve it with one tap.', moved: [], requested: true };
  }

  // ── the write: the coordinator, or a delegate the hosts lent The Day = Edit ──
  if (change.op === 'move') {
    // The running-late shift (20271303571970): a pure shift, all or nothing — one refused row undoes the whole day.
    const { data: n, error: moveErr } = await supabase.rpc('running_late_shift_schedule', {
      p_event_id: eventId,
      p_block_ids: ids,
      p_minutes: change.minutes,
    });
    if (moveErr) {
      if (moveErr.code === 'P0002') return { ok: false, error: NO_EDIT };
      logQueryError('changeTheSchedule.move', moveErr, { eventId }, 'graceful_degrade');
      return { ok: false, error: 'Nothing moved — try again.' };
    }
    if (n !== ids.length) return { ok: false, error: NO_EDIT };
  } else {
    const from = change.op === 'skip' ? 'upcoming' : 'skipped';
    const { data: changed, error } = await supabase
      .from('event_schedule_blocks')
      .update({ run_state: change.op === 'skip' ? 'skipped' : 'upcoming', updated_at: new Date().toISOString() })
      .eq('block_id', part.block_id)
      .eq('event_id', eventId)
      .eq('run_state', from)
      .select('block_id');
    // RLS answers a refused UPDATE with ZERO rows and no error: never "Skipped" over an unchanged day.
    if (!error && !changed?.length) return { ok: false, error: NO_EDIT };
    if (error) {
      const locked = lockedShopOf(error);
      if (locked) return { ok: false, error: error.message, locked };
      logQueryError('changeTheSchedule.skip', error, { eventId }, 'graceful_degrade');
      return { ok: false, error: 'Nothing changed — try again.' };
    }
  }

  /* ⏱ ONE notice per change, after it landed — every booked supplier, and the guests when they can see what changed.
     Best-effort by contract: the change is written; a failed notice never undoes it. */
  const touched = parts.filter((p) => ids.includes(p.block_id)).sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0));
  const seen = touched.find(guestsSeePart) ?? null;
  const following = seen ? touched.filter((p) => p !== seen && p.start_at >= seen.start_at && guestsSeePart(p)).length : 0;
  await notifyScheduleShifted({
    eventId,
    deltaMinutes: change.op === 'move' ? change.minutes : 0,
    fromStartAt: part.start_at,
    fromLabel: part.label,
    actorUserId,
    skip: change.op === 'move' ? undefined : change.op,
    // Named by the first part the GUESTS can see — a private moment's name never reaches a guest's tray.
    guests: seen ? guestNotice(change, seen, following) : null,
  });

  return { ok: true, message: changedWords(change, part, ids.length), moved: ids };
}

/**
 * 🗓 A crew Member asks to skip a part (owner 2026-11-05, *"yes they can request"*). The database files the ask (gates,
 * the lock's line, one open ask per part); the coordinator is told IN THE APP only (`schedule_ask` — not emailed: no new
 * emails), opening the floor, where they approve or decline with one tap.
 */
async function askToSkip(supabase: SupabaseClient, eventId: string, part: PartRow): Promise<ChangeAnswer> {
  const { data: n, error } = await supabase.rpc('crew_request_schedule_skip', { p_event_id: eventId, p_block_id: part.block_id });
  if (error) {
    const locked = lockedShopOf(error);
    if (locked) return { ok: false, error: error.message, locked };
    if (error.code === 'P0002') return { ok: false, error: 'Nothing sent — that part has started or is no longer on the schedule.' };
    return { ok: false, error: crewRefusal(error.message) };
  }
  if (n === 0) return { ok: true, message: 'Already asked — the coordinator has it.', moved: [], requested: true };
  // Tell the coordinator's shop — best-effort: the ask is filed; a failed notice never undoes it.
  try {
    const admin = createAdminClient();
    const { data: ask } = await admin
      .from('event_schedule_suggestions')
      .select('suggested_by_name, vendor_profile_id')
      .eq('block_id', part.block_id)
      .eq('kind', 'skip')
      .eq('status', 'open')
      .maybeSingle();
    const row = ask as { suggested_by_name: string | null; vendor_profile_id: string | null } | null;
    if (row?.vendor_profile_id) {
      const { data: shop } = await admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', row.vendor_profile_id).maybeSingle();
      const owner = (shop as { user_id: string | null } | null)?.user_id;
      if (owner) {
        const who = row.suggested_by_name?.split(' · ')[0]?.trim() || 'Your crew';
        await emitNotification({
          userId: owner,
          type: 'schedule_ask',
          title: `${who} asks to skip ${part.label}`.slice(0, 160),
          body: 'Approve or decline it on your floor.',
          relatedUrl: `/vendor-dashboard/on-the-day/live/${eventId}`,
        });
      }
    }
  } catch (e) {
    logQueryError('changeTheSchedule.skipAskNotice', { message: String(e) }, { eventId }, 'graceful_degrade');
  }
  return { ok: true, message: 'Sent to the coordinator — they approve it with one tap.', moved: [], requested: true };
}

/**
 * 🗓 The floor's list: the open skip asks of THIS coordinator's own crew on this event, oldest first. The caller's own
 * session names their shop; the asks are read on the service role, scoped to that shop and this event (the floor shows
 * only its own crew's asks). A refused read is logged and lists none — the hosts still see every ask on their Schedule.
 */
export async function readCrewSkipAsks(supabase: SupabaseClient, eventId: string): Promise<CrewSkipAsk[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_schedule_suggestions')
    .select('suggestion_id, block_id, suggested_by_name, created_at')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('kind', 'skip')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('readCrewSkipAsks', error, { eventId }, 'graceful_degrade');
    return [];
  }
  const rows = (data ?? []) as { suggestion_id: string; block_id: string | null; suggested_by_name: string | null }[];
  const ids = rows.flatMap((r) => (r.block_id ? [r.block_id] : []));
  if (ids.length === 0) return [];
  const { data: blocks, error: bErr } = await admin.from('event_schedule_blocks').select('block_id, label, start_at, time_tba').in('block_id', ids);
  if (bErr) {
    logQueryError('readCrewSkipAsks.parts', bErr, { eventId }, 'graceful_degrade');
    return [];
  }
  const byId = new Map(((blocks ?? []) as { block_id: string; label: string; start_at: string }[]).map((b) => [b.block_id, b]));
  return rows.flatMap((r) => {
    const b = r.block_id ? byId.get(r.block_id) : null;
    if (!b) return [];
    return [{ suggestionId: r.suggestion_id, blockId: b.block_id, who: r.suggested_by_name?.split(' · ')[0]?.trim() || 'Your crew', label: b.label, startAt: b.start_at }];
  });
}
