'use server';

/**
 * inline-actions.ts — single-guest server actions for the Living Roster's
 * IN-PLACE chip editors + capture bar (P2).
 *
 * Until now, editing one guest's side / RSVP / role / plus-one / groups meant
 * either the bulk `SelectionBar` or a full navigation to the `[guestId]` detail
 * page. These actions wire those same edits to the roster row's inline popovers
 * — so a click on a chip mutates one guest and the page revalidates in place, no
 * route change.
 *
 * They return a small `{ ok } | { ok, error }` result (NOT a redirect) so the
 * client can apply the optimistic overlay + surface an inline error toast
 * without a navigation. The field logic, validation and RLS are ported VERBATIM
 * from the canonical sources so this path can never drift softer than them:
 *   • side / RSVP / plus-one  ← `[guestId]/actions.ts › updateGuest`
 *   • single add              ← `quick-add-actions.ts › quickAddGuest`
 * All writes use the RLS-scoped couple client (`createClient`), exactly like
 * `updateGuest`; RLS is what confines the couple to their own event's guests.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { carrySideToTheirPlusOnes, checkExtraSeats, syncExtraSeats } from '@/lib/extra-seats-sync';
import {
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import type { ReleasedSeat } from '@/lib/guest-optimistic';
import { plusOneHasNoName } from '@/lib/extra-seats';
import { hostMaySetReply } from '@/lib/guest-roster-view';
import { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests } from './groups-actions';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import type { ParsedGuestDraft } from '@/lib/guest-parse';
import { runAddSingleGuest } from '@/lib/add-single-guest-core';
import {
  quickAddGuest,
  quickCreateGroup,
  type AddWriteOptions,
  type QuickAddResult,
} from './quick-add-actions';
import { refuseLimitedHelper, limitedHelperRefusal } from '@/lib/host-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import {
  freshBeforeIsValid,
  freshGuestRestore,
  freshGuestWrite,
  freshResetHasWork,
  freshSeatRestore,
  freshSeatWrite,
  seatsTheGuestNamed,
  type FreshBefore,
  type FreshSeatBefore,
} from '@/lib/guest-fresh-reset';

// Mirrors the closed sets in `[guestId]/actions.ts` — do not widen.
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];
const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

export type InlineResult = { ok: true } | { ok: false; error: string };

const guestsPath = (eventId: string) => `/dashboard/${eventId}/guests`;

/** Set one guest's side (bride / groom / both). Ported from `updateGuest`. */
export async function setGuestSide(
  eventId: string,
  guestId: string,
  side: GuestSide,
): Promise<InlineResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  if (!SIDE_VALUES.includes(side)) return { ok: false, error: 'Pick a valid side.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('guests')
    .update({ side, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) return { ok: false, error: error.message };
  // 🤝 Their +1s take the same side (lib/extra-seats-sync.ts `carrySideToTheirPlusOnes`).
  const carried = await carrySideToTheirPlusOnes(supabase, eventId, [guestId], side);
  if (!carried.ok) return carried;

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/** What a guest's reply was before a host set it — everything the Undo puts back. */
export type ReplyBefore = {
  guest_id: string;
  rsvp_status: RsvpStatus;
  rsvp_responded_at: string | null;
  rsvp_set_by: 'guest' | 'host' | null;
  /** The chair the decline freed (`free_seat_on_decline`), read before the write. */
  freedSeat: ReleasedSeat | null;
};

export type SetRsvpResult =
  | {
      ok: true;
      /** The guests whose reply this changed, as they were — the Undo's list. */
      changed: ReplyBefore[];
      /** Asked for but left alone: the couple and the honoree (always attending), or already that reply. */
      skipped: number;
      /** 🪑 Their +1 seats with no name yet, released with a "Not coming" (the Undo brings them back). */
      seats: { removedIds: string[]; releasedSeats: ReleasedSeat[] };
      /** 🔄 Reset (`{ fresh: true }`): everything it cleared, as it was — the Undo's payload. Null = nothing to clear. */
      fresh?: FreshBefore | null;
    }
  | { ok: false; error: string };

/**
 * ✋ A HOST SETS A REPLY — Select → Set reply ▾ Attending / Not coming (owner 2026-10-21, verbatim: *"How do we double
 * check those who did not answer yet. so we can manually accept them in case they just forgot to say yes?"* →
 * *"Select → Set reply ▾ Attending / Not coming, and "Marked by you" on replies I set"*). ONE write for N guests:
 *  • the couple and the honoree are skipped — they are always attending (the DB trigger, owner 2026-06-03);
 *  • `rsvp_responded_at` is stamped for attending/declined, cleared for No reply;
 *  • 🖐 `rsvp_set_by = 'host'` — the card and the list say "Marked by you"; a guest's own reply replaces it (`submitRsvp`);
 *  • declining AUTO-FREES each guest's chair via the live `free_seat_on_decline` trigger — READ first, so the Undo can
 *    put the exact chair back — and 🪑 releases their +1 seats with NO NAME YET (the one release, `bulkSoftDeleteGuestsForUndo
 *    (…, { release: true })`: their "+N" one lower per seat). A NAMED +1 is never touched — the host decides.
 * The Undo is `restoreGuestRsvpAndSeat` with what this returns.
 * 🔒 guests/_components/the-counts-filter-what-they-count.test.ts
 */
export async function setGuestRsvp(
  eventId: string,
  guestIds: string | readonly string[],
  rsvp: RsvpStatus,
  /** 🔄 `{ fresh: true }` — the card's Reset: ONE guest back to "never replied" (`lib/guest-fresh-reset.ts`). */
  opts: { fresh?: boolean } = {},
): Promise<SetRsvpResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  if (!RSVP_VALUES.includes(rsvp)) return { ok: false, error: 'Pick a valid RSVP.' };
  const ids = Array.from(new Set((typeof guestIds === 'string' ? [guestIds] : [...guestIds]).map((x) => String(x).trim()).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };
  if (opts.fresh === true) {
    if (ids.length !== 1 || rsvp !== 'pending') return { ok: false, error: 'Reset works on one guest at a time.' };
    return resetGuestToFresh(eventId, ids[0]!);
  }

  const supabase = await createClient();
  const { data: rows, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role, rsvp_status, rsvp_responded_at, rsvp_set_by')
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .is('deleted_at', null);
  if (readErr) return { ok: false, error: readErr.message };
  if (!rows || rows.length === 0) return { ok: false, error: 'Couldn’t find those guests.' };

  // The couple and the honoree are always attending — never moved by a host's pick.
  const movable = rows.filter((r) => hostMaySetReply({ role: r.role as GuestRole }) && r.rsvp_status !== rsvp);
  const skipped = ids.length - movable.length;
  const empty = { removedIds: [] as string[], releasedSeats: [] as ReleasedSeat[] };
  if (movable.length === 0) return { ok: true, changed: [], skipped, seats: empty };
  const moving = movable.map((r) => r.guest_id as string);

  // Capture the chairs the impending decline will free (the trigger fires on the rsvp→declined edge, so they are
  // still there until the update below) — the Undo puts each back.
  const freed = new Map<string, ReleasedSeat>();
  if (rsvp === 'declined') {
    const { data: seats } = await supabase
      .from('event_seat_assignments')
      .select('guest_id, table_id, seat_number, locked, event_tables(table_label)')
      .eq('event_id', eventId)
      .in('guest_id', moving);
    for (const seat of seats ?? []) {
      // The many-to-one embed can type as an object or a 1-element array; normalise both to the label string.
      const embedded = (seat as { event_tables?: unknown }).event_tables;
      const tableLabel = Array.isArray(embedded)
        ? ((embedded[0] as { table_label?: string | null })?.table_label ?? null)
        : ((embedded as { table_label?: string | null } | null)?.table_label ?? null);
      freed.set(seat.guest_id as string, {
        guest_id: seat.guest_id as string,
        table_id: seat.table_id as string,
        seat_number: (seat.seat_number as number | null) ?? null,
        locked: (seat.locked as boolean | null) ?? false,
        table_label: tableLabel,
      });
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('guests')
    .update({
      rsvp_status: rsvp,
      rsvp_responded_at: ['attending', 'declined'].includes(rsvp) ? now : null,
      // 🖐 Marked by you — "No reply" is no answer at all, so it carries no mark.
      rsvp_set_by: rsvp === 'pending' ? null : 'host',
      updated_at: now,
    })
    .eq('event_id', eventId)
    .in('guest_id', moving);
  if (error) return { ok: false, error: error.message };

  const changed: ReplyBefore[] = movable.map((r) => ({
    guest_id: r.guest_id as string,
    rsvp_status: r.rsvp_status as RsvpStatus,
    rsvp_responded_at: (r.rsvp_responded_at as string | null) ?? null,
    rsvp_set_by: (r.rsvp_set_by as 'guest' | 'host' | null) ?? null,
    freedSeat: freed.get(r.guest_id as string) ?? null,
  }));

  // 🪑 Not coming → their +1 seats with no name yet are released (named +1s stay — the host decides).
  let released = empty;
  if (rsvp === 'declined') {
    const { data: seatRows, error: seatErr } = await supabase
      .from('guests')
      .select('guest_id, plus_one_of_guest_id, first_name, last_name, plus_one_name_confirmed_at')
      .eq('event_id', eventId)
      .in('plus_one_of_guest_id', moving)
      .is('deleted_at', null);
    if (seatErr) {
      logQueryError('setGuestRsvp (their +1 seats)', seatErr, { event_id: eventId }, 'graceful_degrade');
    } else {
      const open = (seatRows ?? [])
        .filter((x) => plusOneHasNoName({ guest_id: x.guest_id as string, plus_one_of_guest_id: x.plus_one_of_guest_id as string | null, first_name: x.first_name as string | null, last_name: x.last_name as string | null, plus_one_name_confirmed_at: x.plus_one_name_confirmed_at as string | null }))
        .map((x) => x.guest_id as string);
      if (open.length > 0) {
        const res = await bulkSoftDeleteGuestsForUndo(eventId, open, { release: true });
        if (res.ok) released = { removedIds: res.removedIds, releasedSeats: res.releasedSeats };
        else logQueryError('setGuestRsvp (release their +1 seats)', { message: res.error }, { event_id: eventId }, 'graceful_degrade');
      }
    }
  }

  revalidatePath(guestsPath(eventId));
  return { ok: true, changed, skipped, seats: released };
}

/**
 * Undo a host's Set reply: every guest's PRIOR reply exactly as it was (the answer, its date, who set it), the chair a
 * decline freed, and the +1 seats it released (`restoreDeletedGuests` — the same rows, their "+N" back).
 *
 * The `free_seat_on_decline` trigger only fires on the decline EDGE, so writing a reply back to a non-declined value
 * doesn't re-free anything — the seat re-insert is safe. Seat restore is BEST-EFFORT: a single upsert on (event_id,
 * guest_id), and a re-taken chair (23505 on the PARTIAL chair-unique index) leaves the guest restored UNSEATED rather
 * than failing the undo. RLS: `event_seat_assignments_couple_write` is FOR ALL, so the couple may re-insert.
 */
export async function restoreGuestRsvpAndSeat(
  eventId: string,
  before: readonly ReplyBefore[],
  seats: { removedIds: string[]; releasedSeats: ReleasedSeat[] } | null = null,
  /** 🔄 The Undo of the card's Reset: what `setGuestRsvp(…, { fresh: true })` returned. */
  fresh: FreshBefore | null = null,
): Promise<InlineResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  if (fresh) return restoreGuestFresh(eventId, fresh);
  const prior = [...(before ?? [])];
  if (prior.some((b) => !RSVP_VALUES.includes(b.rsvp_status))) return { ok: false, error: 'Pick a valid RSVP.' };
  if (prior.some((b) => b.rsvp_set_by !== null && b.rsvp_set_by !== 'guest' && b.rsvp_set_by !== 'host')) {
    return { ok: false, error: 'Couldn’t undo that.' };
  }
  const supabase = await createClient();

  // Gate every guest to THIS event before writing. RLS scopes `event_seat_assignments` only by `event_id`, and the
  // `guest_id` FK resolves against the GLOBAL `guests` table, so a bare `guest_id` from the payload could otherwise
  // upsert a phantom seat referencing ANOTHER event's guest under this couple's own event.
  if (prior.length > 0) {
    const { data: mine, error: mineErr } = await supabase
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .in('guest_id', prior.map((b) => b.guest_id));
    if (mineErr) return { ok: false, error: mineErr.message };
    const ours = new Set((mine ?? []).map((r) => r.guest_id as string));
    if (prior.some((b) => !ours.has(b.guest_id))) return { ok: false, error: 'Couldn’t find that guest.' };
  }

  // 1. Each reply back exactly as it was — answer, date and who set it.
  for (const b of prior) {
    const { error: rsvpErr } = await supabase
      .from('guests')
      .update({
        rsvp_status: b.rsvp_status,
        rsvp_responded_at: b.rsvp_responded_at,
        rsvp_set_by: b.rsvp_set_by,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('guest_id', b.guest_id);
    if (rsvpErr) return { ok: false, error: rsvpErr.message };
  }

  // 2. Re-place each freed chair — best-effort, and only a chair of THIS event's tables (`table_id` is not scoped by
  //    RLS either); a bad table skips the re-place and the guest lands unseated.
  const chairs = prior.map((b) => b.freedSeat).filter((x): x is ReleasedSeat => Boolean(x && x.table_id));
  if (chairs.length > 0) {
    const { data: tables } = await supabase
      .from('event_tables')
      .select('table_id')
      .eq('event_id', eventId)
      .in('table_id', [...new Set(chairs.map((c) => c.table_id))]);
    const ourTables = new Set((tables ?? []).map((t) => t.table_id as string));
    const back = chairs
      .filter((c) => ourTables.has(c.table_id))
      .map((c) => ({ event_id: eventId, guest_id: c.guest_id, table_id: c.table_id, seat_number: c.seat_number, locked: c.locked }));
    if (back.length > 0) {
      const { error: seatErr } = await supabase.from('event_seat_assignments').upsert(back, { onConflict: 'event_id,guest_id' });
      // 23505 = a chair was re-taken during the undo window → benign. Anything else is non-fatal but logged.
      if (seatErr && (seatErr as { code?: string }).code !== '23505') {
        logQueryError('restoreGuestRsvpAndSeat (seat re-place)', seatErr, { event_id: eventId }, 'graceful_degrade');
      }
    }
  }

  // 3. 🪑 The +1 seats the decline released — the same rows, their guest's "+N" back.
  if (seats && seats.removedIds.length > 0) {
    const r = await restoreDeletedGuests(eventId, seats.removedIds, seats.releasedSeats);
    if (!r.ok) return { ok: false, error: r.error ?? 'Couldn’t bring their +1 seats back.' };
  }

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * 🔄 RESET — one guest back to "never replied" (owner 2026-10-26: *"So at the bottom, have (RESET) (DELETE)"*). What it
 * clears and keeps, and why, is `lib/guest-fresh-reset.ts`. Everything it clears is read FIRST and returned, so the
 * Undo (`restoreGuestFresh`) puts back exactly what was there. Gated by the caller (`setGuestRsvp`: the limited-helper
 * gate); the guest row is written with the RLS-scoped couple client, so a caller who may not write this event's guests
 * writes nothing — and only after that write lands does the service role touch the song requests (the couple's role
 * may only READ them), scoped to this event and this guest.
 * 🔒 guests/_components/reset-makes-the-invitation-fresh.test.ts
 */
async function resetGuestToFresh(eventId: string, guestId: string): Promise<SetRsvpResult> {
  const supabase = await createClient();
  const empty = { removedIds: [] as string[], releasedSeats: [] as ReleasedSeat[] };
  const { data: g, error: gErr } = await supabase
    .from('guests')
    .select(
      'guest_id, role, plus_one_of_guest_id, rsvp_status, rsvp_responded_at, rsvp_set_by, meal_preference, dietary_restrictions, guest_note, display_name, face_tagging_wanted, plus_one_name, plus_one_name_confirmed_at',
    )
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();
  if (gErr) return { ok: false, error: gErr.message };
  if (!g) return { ok: false, error: 'Couldn’t find that guest.' };
  // The couple and the honoree are always attending; a +1's reply is their guest's — Reset that guest instead.
  if (!hostMaySetReply({ role: g.role as GuestRole })) return { ok: false, error: 'The couple’s own rows are always attending — there is nothing to reset.' };
  if (g.plus_one_of_guest_id) return { ok: false, error: 'A +1 answers through their guest — reset the guest who brings them.' };

  // Their seats — the ones the REPLY named (the guest's mark on the seat), never one an account holds.
  const { data: seatRows, error: seatErr } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, name_prefix, middle_name, name_suffix, display_name, plus_one_name_confirmed_at, rsvp_status, rsvp_responded_at, rsvp_set_by, meal_preference, dietary_restrictions, created_at')
    .eq('event_id', eventId)
    .eq('plus_one_of_guest_id', guestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (seatErr) return { ok: false, error: seatErr.message };
  const live = seatRows ?? [];
  const { data: linkedRows, error: linkedErr } = live.length
    ? await supabase.from('event_members').select('guest_id').eq('event_id', eventId).in('guest_id', live.map((r) => r.guest_id as string))
    : { data: [], error: null };
  if (linkedErr) return { ok: false, error: linkedErr.message };
  const linked = new Set(((linkedRows ?? []) as Array<{ guest_id: string | null }>).map((r) => r.guest_id).filter((x): x is string => Boolean(x)));
  const named = seatsTheGuestNamed(
    live.map((r, i) => ({ ...(r as Record<string, unknown>), seat_index: i }) as unknown as FreshSeatBefore & { created_at?: string }),
    linked,
  ).map(({ created_at: _created, ...seat }) => seat as FreshSeatBefore);

  // Their song requests still waiting for the DJ (service role: the couple may only read them).
  const admin = createAdminClient();
  const { data: songRows, error: songErr } = await admin
    .from('event_song_requests')
    .select('request_id, song_id, requester_name, created_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('origin', 'guest')
    .eq('status', 'pending');
  if (songErr) return { ok: false, error: songErr.message };

  const before: FreshBefore = {
    guest: {
      guest_id: g.guest_id as string,
      rsvp_status: g.rsvp_status as RsvpStatus,
      rsvp_responded_at: (g.rsvp_responded_at as string | null) ?? null,
      rsvp_set_by: (g.rsvp_set_by as 'guest' | 'host' | null) ?? null,
      meal_preference: (g.meal_preference as FreshBefore['guest']['meal_preference']) ?? null,
      dietary_restrictions: (g.dietary_restrictions as string | null) ?? null,
      guest_note: (g.guest_note as string | null) ?? null,
      display_name: (g.display_name as string | null) ?? null,
      face_tagging_wanted: (g.face_tagging_wanted as boolean | null) ?? null,
      plus_one_name: (g.plus_one_name as string | null) ?? null,
      plus_one_name_confirmed_at: (g.plus_one_name_confirmed_at as string | null) ?? null,
    },
    seats: named,
    songs: (songRows ?? []).map((x) => ({
      request_id: x.request_id as string,
      song_id: Number(x.song_id),
      requester_name: (x.requester_name as string | null) ?? null,
      created_at: x.created_at as string,
    })),
  };
  if (!freshResetHasWork(before)) return { ok: true, changed: [], skipped: 1, seats: empty, fresh: null };

  const now = new Date().toISOString();
  // 1. Their row — the zero-row answer is a refusal, never "saved" (RLS writes nothing for a caller it does not admit).
  const { data: wrote, error: wErr } = await supabase
    .from('guests')
    .update({ ...freshGuestWrite(), updated_at: now })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .select('guest_id');
  if (wErr) return { ok: false, error: wErr.message };
  if (!wrote || wrote.length === 0) return { ok: false, error: 'Couldn’t reset that guest.' };

  // 2. The seats they named → unnamed "+N · TBA" seats, each still theirs.
  for (const seat of named) {
    const { error } = await supabase
      .from('guests')
      .update({ ...freshSeatWrite(seat.seat_index), updated_at: now })
      .eq('event_id', eventId)
      .eq('guest_id', seat.guest_id)
      .eq('plus_one_of_guest_id', guestId);
    if (error) return { ok: false, error: error.message };
  }

  // 3. Their waiting song requests.
  if (before.songs.length > 0) {
    const { error } = await admin
      .from('event_song_requests')
      .delete()
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .eq('origin', 'guest')
      .eq('status', 'pending')
      .in('request_id', before.songs.map((x) => x.request_id));
    if (error) logQueryError('resetGuestToFresh (song requests)', error, { event_id: eventId }, 'graceful_degrade');
  }

  revalidatePath(guestsPath(eventId));
  await everyCopyIsNowStale(eventId);
  return {
    ok: true,
    changed: [{ guest_id: guestId, rsvp_status: before.guest.rsvp_status, rsvp_responded_at: before.guest.rsvp_responded_at, rsvp_set_by: before.guest.rsvp_set_by, freedSeat: null }],
    skipped: 0,
    seats: empty,
    fresh: before,
  };
}

/** 🔄 The Undo of Reset: exactly what was there — the row's columns, the seats' names, the waiting songs. */
async function restoreGuestFresh(eventId: string, fresh: FreshBefore): Promise<InlineResult> {
  const guestId = fresh?.guest?.guest_id;
  if (typeof guestId !== 'string' || !freshBeforeIsValid(fresh, guestId)) return { ok: false, error: 'Couldn’t undo that.' };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: wrote, error } = await supabase
    .from('guests')
    .update({ ...freshGuestRestore(fresh.guest), updated_at: now })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('plus_one_of_guest_id', null)
    .select('guest_id');
  if (error) return { ok: false, error: error.message };
  if (!wrote || wrote.length === 0) return { ok: false, error: 'Couldn’t find that guest.' };
  for (const seat of fresh.seats) {
    // Only THEIR seat, in THIS event — a seat id from the payload that is not theirs writes nothing.
    const { error: seatErr } = await supabase
      .from('guests')
      .update({ ...freshSeatRestore(seat), updated_at: now })
      .eq('event_id', eventId)
      .eq('guest_id', seat.guest_id)
      .eq('plus_one_of_guest_id', guestId);
    if (seatErr) return { ok: false, error: seatErr.message };
  }
  if (fresh.songs.length > 0) {
    const admin = createAdminClient();
    const { error: songErr } = await admin.from('event_song_requests').upsert(
      fresh.songs.map((x) => ({
        request_id: x.request_id,
        event_id: eventId,
        guest_id: guestId,
        origin: 'guest',
        song_id: x.song_id,
        requester_name: x.requester_name,
        status: 'pending',
        created_at: x.created_at,
      })),
      { onConflict: 'request_id', ignoreDuplicates: true },
    );
    // 23505 = somebody asked for the same song meanwhile (one request per song per event) — the guest is still back.
    if (songErr && (songErr as { code?: string }).code !== '23505') {
      logQueryError('restoreGuestFresh (song requests)', songErr, { event_id: eventId }, 'graceful_degrade');
    }
  }
  revalidatePath(guestsPath(eventId));
  await everyCopyIsNowStale(eventId);
  return { ok: true };
}

/*
  ─── `setGuestRole` DELETED (2026-10-22) ─────────────────────────────────
  A thin wrapper over `quick-add-actions.ts › setGuestPrimaryRole` with no
  caller anywhere in app/ or lib/ (the role editors call the canonical action
  directly). Deleted to free one exported server action under the Vercel
  route budget (`scripts/lint-server-action-budget.mjs`) for the sign-up
  card's Terms carry (`app/auth/terms-carry-action.ts`).
*/

/*
  ─── `setGuestPlusOnes` DELETED (2026-09-03) ─────────────────────────────

  Superseded, and by three separate live writers of `plus_one_allowed`: the
  guest-detail form's own toggle further down this file, the seat-map path in
  `./map-actions.ts`, and CSV import / `addSingleGuest`. This capture-bar
  variant — which mapped a parsed COUNT onto the boolean the schema actually
  models — had no caller.
*/

/**
 * Set how many extra seats one guest may bring — 0 to 4.
 *
 * ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4. can be
 * +1/+2/+3/+4. these are for the additional seats."
 *
 * Writes ONLY `plus_one_count`; the DB trigger keeps `plus_one_allowed` equal
 * to `count > 0`, so every reader of the old boolean stays right. The row count
 * is checked: a zero-row UPDATE returns no error and would otherwise be
 * reported as saved.
 */
export async function setGuestPlusOneCount(
  eventId: string,
  guestId: string,
  count: number,
): Promise<InlineResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  if (!Number.isInteger(count) || count < 0 || count > 4) {
    return { ok: false, error: 'Pick none, or +1 to +4.' };
  }
  const supabase = await createClient();
  // A finalized list is refused BEFORE saving, so a refused change leaves
  // nothing half-written. Going below the NAMED seats is allowed (owner
  // 2026-09-29 — the host decides): the named people stay, and the row says
  // "3 named · 1 allowed" with a Remove beside each (`PlusOneSeatsNote`).
  const check = await checkExtraSeats(supabase, eventId, guestId, count);
  if (!check.ok) return { ok: false, error: check.error };

  const { data, error } = await supabase
    .from('guests')
    .update({ plus_one_count: count, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .select('guest_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Couldn’t find that guest.' };

  // ⚖ Owner 2026-09-21: "+ will have seats beside the person invited".
  const seats = await syncExtraSeats(supabase, eventId, guestId);
  if (!seats.ok) return { ok: false, error: `Saved +${count}, but the seats could not be set: ${seats.error}` };

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Add a guest to an existing custom group. Ported from `quickAddGuest`'s
 * sticky-group membership upsert: verify the group belongs to this event (RLS
 * guards too) before the idempotent membership upsert.
 */
export async function addGuestToGroup(
  eventId: string,
  guestId: string,
  groupId: string,
): Promise<InlineResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const gid = (groupId ?? '').trim();
  if (!gid) return { ok: false, error: 'Pick a group.' };

  const supabase = await createClient();
  // Gate BOTH sides on this event before writing the membership. RLS on
  // guest_group_memberships (couple_writes_membership) only scopes group_id, and
  // the table has no event_id column, so a bare guest_id from the payload would
  // otherwise let a couple attach another event's guest to their own group (the
  // FK resolves against the GLOBAL guests table). Mirror the g.event_id ===
  // eventId check the canonical single-guest role actions use.
  const [{ data: groupRow }, { data: guestRow }] = await Promise.all([
    supabase.from('guest_groups').select('event_id').eq('group_id', gid).maybeSingle(),
    supabase.from('guests').select('event_id').eq('guest_id', guestId).maybeSingle(),
  ]);
  if (!groupRow || groupRow.event_id !== eventId) {
    return { ok: false, error: 'That group isn’t part of this event.' };
  }
  if (!guestRow || guestRow.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }

  const { error } = await supabase
    .from('guest_group_memberships')
    .upsert([{ group_id: gid, guest_id: guestId }], {
      onConflict: 'group_id,guest_id',
      ignoreDuplicates: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Capture-bar single add. The pure parser (`lib/guest-parse.ts`) has already
 * split the line into a draft; this action lands it, reusing the canonical
 * quick-add validation + insert VERBATIM and layering the capture grammar's two
 * extras on top (multiple `#groups`, a `+N` plus-one permission):
 *
 *   1. `roleHint` is mapped to a concrete primary role ONLY when it's offered
 *      for this event type (`resolveRoleSetForEvent`), else it falls back to
 *      `guest` — so a wedding typing `vip` (no such wedding role) still adds a
 *      plain guest rather than erroring, and a generic event's `vip` sticks.
 *   2. Every `#Group` is find-or-created (`quickCreateGroup`, case-insensitively
 *      idempotent); the first seeds `quickAddGuest`'s seat clustering, the rest
 *      are attached as memberships.
 *   3. `plusOnes > 0` flips `plus_one_allowed` on afterwards.
 */
export async function addSingleGuest(
  eventId: string,
  draft: ParsedGuestDraft,
  opts: AddWriteOptions = {},
): Promise<QuickAddResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  // Thin wrapper: the orchestration (name-guard → mint `#groups` → role hint →
  // insert → attach extra groups / plus-one → ON-FAILURE compensate the freshly
  // minted groups) lives in the DB-free, unit-tested `runAddSingleGuest` core.
  // Here we only inject the real, RLS-scoped server actions as its deps, so the
  // verbatim quickAddGuest-reuse contract and every write are unchanged.
  return runAddSingleGuest(eventId, draft, {
    createGroup: (eid, name) => quickCreateGroup(eid, name),
    addGuest: (eid, input) => quickAddGuest(eid, opts.email ? { ...input, email: opts.email } : input, opts),
    resolveOfferedRoles: async (eid) => (await resolveRoleSetForEvent(eid)).offeredRoles,

    // Extra-group membership beyond the first (quickAddGuest attached group[0]).
    attachMembership: async (gid, guestId) => {
      const supabase = await createClient();
      await supabase
        .from('guest_group_memberships')
        .upsert([{ group_id: gid, guest_id: guestId }], {
          onConflict: 'group_id,guest_id',
          ignoreDuplicates: true,
        });
    },

    // Extra seats from the parsed `+N` (the trigger sets plus_one_allowed).
    setPlusOne: async (guestId, count) => {
      const supabase = await createClient();
      // 🚫 The one seat rule — a +1 (or a finalized list) is refused here as everywhere (`checkExtraSeats`).
      const check = await checkExtraSeats(supabase, eventId, guestId, Math.min(4, Math.max(1, count)));
      if (!check.ok) return;
      await supabase
        .from('guests')
        .update({ plus_one_count: Math.min(4, Math.max(1, count)), updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', guestId);
      // …and the seats themselves, beside the new guest (owner 2026-09-21).
      await syncExtraSeats(supabase, eventId, guestId);
    },

    // On-failed-add compensation for a group THIS call freshly minted. Guarded
    // so a group a concurrent same-couple tab already populated is left intact:
    // guest_group_memberships.group_id → guest_groups(group_id) is ON DELETE
    // CASCADE (migration 20260604170000), so an unconditional delete of a
    // now-non-empty group would silently drop that other guest's membership.
    // Absent concurrency a freshly-minted group is always empty here (its
    // group[0] membership is only attached AFTER a SUCCESSFUL insert), so the
    // guard never blocks the intended cleanup. Couple-scoped
    // `.eq('group_id').eq('event_id')` delete — the exact pattern
    // `deleteGuestGroup` (groups-actions.ts) uses, authorized by the
    // couple_writes_guest_group RLS policy. Best-effort: a failed cleanup is
    // logged and swallowed, never masking the real add error.
    deleteEmptyGroup: async (gid, eid) => {
      const supabase = await createClient();
      const { count } = await supabase
        .from('guest_group_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', gid);
      if ((count ?? 0) > 0) return;
      const { error: delErr } = await supabase
        .from('guest_groups')
        .delete()
        .eq('group_id', gid)
        .eq('event_id', eid);
      if (delErr) {
        logQueryError(
          'addSingleGuest (orphan-group compensation)',
          delErr,
          { event_id: eid, group_id: gid },
          'graceful_degrade',
        );
      }
    },

    // ⚡ `refresh: false` (a queued add): no page redraw in this answer — the queue re-reads the list once when it is empty.
    revalidate: (eid) => {
      if (opts.refresh !== false) revalidatePath(guestsPath(eid));
    },
  });
}
