'use server';

/**
 * entourage-order-actions.ts — the couple sets who walks first.
 *
 * ⚖ Owner 2026-09-20, having been shown the invitation's printing order: he
 * wants to arrange the people inside each role himself. Until this, there was
 * no order at all — neither entourage query carried an `ORDER BY`, so within a
 * role the names came back however Postgres felt and could reshuffle between
 * page loads. A surname sort now supplies the default; this writes the
 * couple's override on top of it (`guests.entourage_order`).
 *
 * ── WHY IT WRITES THE WHOLE ROLE, NOT THE TWO ROWS THAT MOVED ───────────────
 * A swap only touches two people IF everyone in that role already carries a
 * dense order — and on the first move nobody does, they are all NULL. Writing
 * the full 0..n-1 sequence every time means there is no "have we normalised
 * yet" state to get wrong, and the second move behaves exactly like the
 * hundredth. An entourage role is a handful of people, not a table scan.
 *
 * 🔑 THE ORDER IT ACTS ON IS THE ORDER THE INVITATION PRINTS —
 * `holdersOfRoleInPrintOrder`, imported from the same module the public page
 * builds from. Sorting here independently (or trusting the dashboard's own
 * `sort` param) would make "move her up" swap her with whoever the DASHBOARD
 * showed above her, changing the invitation somewhere the couple was not
 * looking.
 *
 * ⚠ NOT ATOMIC, AND THAT IS ACCEPTABLE HERE — unlike `pair_guests`, which must
 * be. A pair is MUTUAL: a half-written pair is a state the schema cannot
 * express and the page would render as a lie. An order is per-row and purely
 * presentational; a half-written sequence is still a valid order, just not the
 * one asked for, and the next move rewrites it. So this stays plain UPDATEs
 * rather than earning a SQL function.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  ENTOURAGE_COLUMNS,
  ENTOURAGE_GROUP_KEYS,
  entourageGroupOfRole,
  entourageLines,
  type EntourageGuestRow,
} from '@/lib/entourage';

function backToList(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

export type MoveDirection = 'up' | 'down';

/**
 * Move one guest one place within their entourage role.
 *
 * `role` is passed explicitly rather than read off the guest, because a guest
 * with `extra_roles` appears under more than one heading and only the caller
 * knows which list the host was looking at.
 */
export async function moveInEntourageOrder(
  eventId: string,
  guestId: string,
  groupKey: string,
  direction: MoveDirection,
): Promise<void> {
  /*
    ⚖ OWNER 2026-09-20 — A PAIR MOVES AS ONE LINE. This took a group key where
    it used to take a ROLE, and that is the whole change: ninong and ninang are
    two different roles, so ordering each role separately could not express a
    pair at all. Moving her up moved her past other ninangs while he stayed put.
  */
  if (!ENTOURAGE_GROUP_KEYS.includes(groupKey)) {
    redirect(backToList(eventId, { error: 'not_an_entourage_group' }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null);

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  const lines = entourageLines((data ?? []) as EntourageGuestRow[], groupKey);
  const from = lines.findIndex((ln) => ln.some((half) => half?.id === guestId));
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= lines.length) {
    redirect(backToList(eventId, {}));
  }

  const next = [...lines];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  /*
    🔑 BOTH HALVES GET THE SAME NUMBER. That is what makes the column able to
    order a pair without a schema change — it always could; nothing was ever
    writing it this way. Writing the whole group each time also means there is
    no "have we normalised yet" state: the first drag behaves like the
    hundredth.

    ⛔ NOTHING HERE TOUCHES event_seat_assignments OR seating_priority. The
    processional and the seat plan are two orderings on purpose; moving a pair
    up the aisle must never move a chair.
  */
  let written = 0;
  for (const [index, line] of next.entries()) {
    for (const half of line) {
      if (!half?.id) continue;
      const { data: rows, error: writeErr } = await supabase
        .from('guests')
        .update({ entourage_order: index, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', half.id)
        .select('guest_id');
      if (writeErr) {
        redirect(backToList(eventId, { error: encodeURIComponent(writeErr.message) }));
      }
      written += rows?.length ?? 0;
    }
  }

  if (written === 0) {
    redirect(backToList(eventId, { error: 'order_not_saved' }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath('/[slug]', 'layout');
  redirect(backToList(eventId, { reordered: String(written) }));
}

/**
 * Hand one printed GROUP's order back to the alphabetical default.
 *
 * Without this, a couple who drags once can never get back to "no opinion" —
 * every name in that role keeps a number forever, and the default they were
 * happy with becomes unreachable.
 */
export async function clearEntourageOrder(
  eventId: string,
  groupKey: string,
): Promise<void> {
  if (!ENTOURAGE_GROUP_KEYS.includes(groupKey)) {
    redirect(backToList(eventId, { error: 'not_an_entourage_group' }));
  }

  const supabase = await createClient();
  const { data: all, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (readErr) {
    redirect(backToList(eventId, { error: encodeURIComponent(readErr.message) }));
  }
  // Every role in this printed group — derived, so a group that gains a role
  // does not quietly keep half its order.
  const ids = ((all ?? []) as Array<{ guest_id: string; role: string | null }>)
    .filter((g) => g.role && entourageGroupOfRole(g.role) === groupKey)
    .map((g) => g.guest_id);
  if (ids.length === 0) {
    redirect(backToList(eventId, { order_cleared: '0' }));
  }
  const { data, error } = await supabase
    .from('guests')
    .update({ entourage_order: null, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .not('entourage_order', 'is', null)
    .select('guest_id');

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath('/[slug]', 'layout');
  redirect(backToList(eventId, { order_cleared: String(data?.length ?? 0) }));
}
