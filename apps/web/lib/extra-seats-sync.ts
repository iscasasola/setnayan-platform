import type { SupabaseClient } from '@supabase/supabase-js';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { PLACEHOLDER_FIRST_NAME, planExtraSeats, seatNumbersAfter, seatPlaceholderLabel, type ExtraSeatRow } from '@/lib/extra-seats';
import { A_PLUS_ONE_BRINGS_NO_ONE, isAPlusOne } from '@/lib/guests';

/**
 * Make a guest's seat rows match their `plus_one_count`, then seat them beside
 * the guest.
 *
 * ⚖ Owner 2026-09-21: "+ will have seats beside the person invited". The rule
 * (what to create, what may be removed, when to refuse) is `planExtraSeats`;
 * this only applies it:
 *   · missing seats → "TBA" rows linked to the guest (`plus_one_of_guest_id`),
 *     same side / group / blocks, so they belong where the guest belongs;
 *   · surplus placeholders → their seat released and the row soft-deleted,
 *     exactly as a removal from the list does;
 *   · then the seat engine re-seats the guest, which pulls every linked seat in
 *     beside them (lib/seating-reconcile.ts).
 *
 * Runs under the CALLER's client, so their RLS decides what they may write.
 * Call it with the count ALREADY saved — and `checkExtraSeats` first, which
 * refuses a change on a finalized list before anything is saved. A number
 * below the NAMED seats is allowed (owner 2026-09-29, the host decides): the
 * placeholders go, the named people stay, and the Guest List says so.
 */

type Primary = {
  guest_id: string;
  first_name: string | null;
  side: string;
  group_category: string;
  invited_to_blocks: string[] | null;
  plus_one_count: number | null;
  /** Set ⇒ this guest IS a +1, and brings nobody (`isAPlusOne`, owner 2026-10-21). */
  plus_one_of_guest_id: string | null;
};

async function readSeats(supabase: SupabaseClient, eventId: string, guestId: string) {
  const [{ data: primary, error: pErr }, { data: rows, error: rErr }] = await Promise.all([
    supabase
      .from('guests')
      .select('guest_id, first_name, side, group_category, invited_to_blocks, plus_one_count, plus_one_of_guest_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('guests')
      .select('guest_id, first_name, plus_one_name_confirmed_at, created_at')
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', guestId)
      .is('deleted_at', null),
  ]);
  if (pErr || rErr || !primary) return null;
  const seats: ExtraSeatRow[] = (rows ?? []).map((r) => ({
    guest_id: r.guest_id as string,
    first_name: (r.first_name as string | null) ?? null,
    confirmed_at: (r.plus_one_name_confirmed_at as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
  }));
  return { primary: primary as Primary, seats };
}

/**
 * 🤝 A +1'S SIDE FOLLOWS THEIR GUEST — at write time (owner 2026-10-19, "the plus 1 did not connect properly to
 * the guest"). A seat is created with its guest's side (`syncExtraSeats` below), but a guest whose side was set
 * AFTER their +1 existed left the +1 behind: measured 2026-10-20, 4 of 19 live +1s read "both" while their guest
 * read "bride" — every one of them a guest edited after the +1 was made. Every write that sets a guest's side
 * calls this with the same side: the inline Side, the bulk Side, and the card's save (through `syncExtraSeats`).
 * Rows already drifted are NOT rewritten here — that is the owner's call; the List reads the guest's side for them.
 * 🔒 guests/_components/a-plus-one-sits-with-their-guest.test.ts
 */
export async function carrySideToTheirPlusOnes(
  supabase: SupabaseClient,
  eventId: string,
  guestIds: readonly string[],
  side: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (guestIds.length === 0) return { ok: true };
  const { error } = await supabase
    .from('guests')
    .update({ side, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('plus_one_of_guest_id', [...guestIds])
    .neq('side', side)
    .is('deleted_at', null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * After a Remove (or its Undo): the guests who brought the +1s that went (or came back) get their number moved to
 * match (`seatNumbersAfter`, lib/extra-seats.ts). Runs under the caller's client — the same RLS as the remove.
 */
export async function seatNumbersFollowTheRows(
  supabase: SupabaseClient,
  eventId: string,
  guestIds: readonly string[],
  dir: 'removed' | 'restored',
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (guestIds.length === 0) return { ok: true };
  const { data: changed, error: cErr } = await supabase
    .from('guests')
    .select('guest_id, plus_one_of_guest_id')
    .eq('event_id', eventId)
    .in('guest_id', [...guestIds]);
  if (cErr) return { ok: false, error: cErr.message };
  const rows = (changed ?? []) as { guest_id: string; plus_one_of_guest_id: string | null }[];
  const hostIds = [...new Set(rows.map((r) => r.plus_one_of_guest_id).filter((h): h is string => Boolean(h)))];
  if (hostIds.length === 0) return { ok: true };
  const { data: bringers, error: bErr } = await supabase
    .from('guests')
    .select('guest_id, plus_one_count, plus_one_allowed')
    .eq('event_id', eventId)
    .in('guest_id', hostIds)
    .is('deleted_at', null);
  if (bErr) return { ok: false, error: bErr.message };
  for (const u of seatNumbersAfter(rows, (bringers ?? []) as never, dir)) {
    const { error } = await supabase
      .from('guests')
      .update({ plus_one_count: u.plus_one_count, plus_one_allowed: u.plus_one_allowed, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', u.guest_id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** The sentence every finalized-list refusal uses — the RSVP lock's own words. */
export const GUEST_LIST_FINALIZED = 'Your guest list is finalized — the guest count is locked.';

/**
 * Would setting `want` be allowed? Refuses when the guest list is closed and
 * the number would change. (Named seats beyond `want` no longer refuse it —
 * `planExtraSeats` keeps them and reports `over`; owner 2026-09-29.)
 *
 * ⚖ Owner 2026-09-21 ("1. yes"): once the guest count is finalized, extra seats
 * no longer move — the head count suppliers priced against is closed, and each
 * seat is a guest row the lock already refuses to add or remove. Asked HERE,
 * before anything is saved, so a refused change never leaves a number without
 * its chairs. "Closed" is `guestListIsClosed` — the stamp OR the deadline — the
 * same answer the RSVP and the roster's finalized banner use.
 */
export async function checkExtraSeats(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
  /** The number asked for — or, for an old form that posts only the on/off box, how it moves the current one. */
  want: number | ((current: number) => number),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const read = await readSeats(supabase, eventId, guestId);
  if (!read) return { ok: false, error: 'Couldn’t read this guest’s seats — nothing was changed.' };
  const now = read.primary.plus_one_count ?? 0;
  const next = typeof want === 'function' ? want(now) : want;
  // 🚫 A +1 cannot have their own +1 (owner 2026-10-21) — refused before anything is saved.
  if (next > 0 && isAPlusOne(read.primary)) return { ok: false, error: A_PLUS_ONE_BRINGS_NO_ONE };
  if (now !== next) {
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('guest_count_locked_at, guest_list_edit_deadline, event_date')
      .eq('event_id', eventId)
      .maybeSingle();
    // Unreadable is not "open": refuse rather than risk a half-made change.
    if (evErr || !ev) return { ok: false, error: 'Couldn’t check whether your guest list is finalized — nothing was changed.' };
    if (
      guestListIsClosed({
        lockedAt: ev.guest_count_locked_at as string | null,
      })
    ) {
      return { ok: false, error: GUEST_LIST_FINALIZED };
    }
  }
  return { ok: true };
}

/** Is this guest seated while one of their live seats has no chair? A refused read answers no (nothing is moved on a guess). */
async function aSeatWaitsForItsChair(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
  seats: readonly ExtraSeatRow[],
): Promise<boolean> {
  if (seats.length === 0) return false;
  const ids = [guestId, ...seats.map((s) => s.guest_id)];
  const { data, error } = await supabase.from('event_seat_assignments').select('guest_id').eq('event_id', eventId).in('guest_id', ids);
  if (error || !Array.isArray(data)) return false;
  const seated = new Set((data as Array<{ guest_id: string }>).map((r) => r.guest_id));
  return seated.has(guestId) && seats.some((s) => !seated.has(s.guest_id));
}

export async function syncExtraSeats(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<{ ok: true; created: number; removed: number } | { ok: false; error: string }> {
  const read = await readSeats(supabase, eventId, guestId);
  if (!read) return { ok: false, error: 'Couldn’t read this guest’s seats.' };
  const { primary, seats } = read;
  // 🚫 A +1 never gets seats of their own, whatever their row says (owner 2026-10-21) — `isAPlusOne`.
  const plan = planExtraSeats(isAPlusOne(primary) ? 0 : (primary.plus_one_count ?? 0), seats);

  // The seats already there take the guest's side (the card's save changes it) — `carrySideToTheirPlusOnes`.
  if (seats.length > 0) {
    const carried = await carrySideToTheirPlusOnes(supabase, eventId, [primary.guest_id], primary.side);
    if (!carried.ok) return carried;
  }

  if (plan.create > 0) {
    const inserts = Array.from({ length: plan.create }, (_, i) => ({
      event_id: eventId,
      first_name: PLACEHOLDER_FIRST_NAME,
      last_name: '+1',
      // Numbered by SEAT — "+2 · TBA" (owner 2026-09-29), never
      // "+ TBA · brought by …": the Guest List shows whose seat it is.
      display_name: seatPlaceholderLabel(seats.length + i),
      side: primary.side,
      group_category: primary.group_category,
      role: 'guest',
      rsvp_status: 'pending',
      photo_consent: true,
      // Same invitation as the guest who brings them; the column's default otherwise.
      ...(primary.invited_to_blocks ? { invited_to_blocks: primary.invited_to_blocks } : {}),
      plus_one_of_guest_id: primary.guest_id,
      // Limited, as the add-guest form documents: a plus-one is usually
      // less-known to the couple, so account creation waits for an upgrade.
      plus_one_mode: 'limited',
    }));
    const { error } = await supabase.from('guests').insert(inserts);
    if (error) return { ok: false, error: error.message };
  }

  if (plan.remove.length > 0) {
    // Release the chairs first, as removing a guest from the list does. If that
    // fails, stop: a removed seat still holding a chair is a ghost in the plan.
    const { error: seatErr } = await supabase
      .from('event_seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .in('guest_id', plan.remove);
    if (seatErr) return { ok: false, error: seatErr.message };
    const { error } = await supabase
      .from('guests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .in('guest_id', plan.remove);
    if (error) return { ok: false, error: error.message };
  }

  // Beside the person invited: re-seating the guest pulls their seats in. 🪑 Since 2026-10-21 the DATABASE mints the
  // seats with the number (`a_plus_ones_count_is_their_rows`), so by the time this runs they usually exist already and
  // the plan is empty — the re-seat is then asked for when a seated guest has a seat with no chair yet.
  if (plan.create > 0 || plan.remove.length > 0 || (await aSeatWaitsForItsChair(supabase, eventId, primary.guest_id, seats))) {
    await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [primary.guest_id] });
  }
  return { ok: true, created: plan.create, removed: plan.remove.length };
}
