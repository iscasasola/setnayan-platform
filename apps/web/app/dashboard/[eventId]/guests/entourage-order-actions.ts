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
  ENTOURAGE_ROLES,
  holdersOfRoleInPrintOrder,
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
  role: string,
  direction: MoveDirection,
): Promise<void> {
  // The role must be one the invitation actually prints. Anything else has no
  // list to be moved within, so an order written for it would never be read.
  if (!ENTOURAGE_ROLES.includes(role as never)) {
    redirect(backToList(eventId, { error: 'not_an_entourage_role' }));
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

  const holders = holdersOfRoleInPrintOrder(
    (data ?? []) as EntourageGuestRow[],
    role,
  );
  const from = holders.findIndex((g) => g.guest_id === guestId);
  // Not in this role, or already at the end it is being pushed towards. Both
  // are no-ops rather than errors: a host double-tapping the top row's ↑ has
  // done nothing wrong.
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= holders.length) {
    redirect(backToList(eventId, {}));
  }

  const next = [...holders];
  const moved = next[from]!;
  next.splice(from, 1);
  next.splice(to, 0, moved);

  // Write the full sequence. `.select()` is what makes a refusal visible: a
  // zero-row UPDATE is success-shaped, and an RLS refusal returns exactly
  // that — no error, no rows, and a screen that says it worked.
  let written = 0;
  for (const [index, person] of next.entries()) {
    if (!person.guest_id) continue;
    const { data: rows, error: writeErr } = await supabase
      .from('guests')
      .update({ entourage_order: index, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', person.guest_id)
      .select('guest_id');
    if (writeErr) {
      redirect(backToList(eventId, { error: encodeURIComponent(writeErr.message) }));
    }
    written += rows?.length ?? 0;
  }

  if (written === 0) {
    redirect(backToList(eventId, { error: 'order_not_saved' }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  // The invitation is what actually changed — revalidate it too, or the couple
  // checks the public page and sees the order they just replaced.
  revalidatePath('/[slug]', 'layout');
  redirect(backToList(eventId, { reordered: String(written) }));
}

/**
 * Hand one role's order back to the alphabetical default.
 *
 * Without this, a couple who drags once can never get back to "no opinion" —
 * every name in that role keeps a number forever, and the default they were
 * happy with becomes unreachable.
 */
export async function clearEntourageOrder(
  eventId: string,
  role: string,
): Promise<void> {
  if (!ENTOURAGE_ROLES.includes(role as never)) {
    redirect(backToList(eventId, { error: 'not_an_entourage_role' }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .update({ entourage_order: null, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('role', role)
    .not('entourage_order', 'is', null)
    .select('guest_id');

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath('/[slug]', 'layout');
  redirect(backToList(eventId, { order_cleared: String(data?.length ?? 0) }));
}
