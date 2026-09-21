'use server';

/**
 * pair-actions.ts — pairing two guests from the guest list.
 *
 * Filipino entourages walk in pairs: groomsman↔bridesmaid, ninong↔ninang. The
 * column for it (`guests.pair_with_guest_id`) has existed since the first
 * guests migration in May 2026 and, until now, NOTHING read or wrote it.
 *
 * Both writes go through the `pair_guests` / `unpair_guest` SQL functions
 * rather than issuing two UPDATEs from here. That is not ceremony: a pair is
 * MUTUAL, so two round-trips leave a window where A points at B and B points
 * at nobody — and if the second one fails, the list shows a pair that only
 * half exists. The functions write both halves in one statement, under the
 * caller's own RLS (SECURITY INVOKER), so a partial pair cannot be observed or
 * persisted.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { entourageGroupOfRole } from '@/lib/entourage';

function backToList(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

function parseGuestIds(formData: FormData): string[] {
  const repeated = formData
    .getAll('guest_ids[]')
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (repeated.length > 0) return repeated;
  const single = formData.get('guest_ids');
  return single
    ? String(single)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

/**
 * Pair the two selected guests.
 *
 * Deliberately requires EXACTLY two. "Pair these 3" has no meaning, and
 * silently pairing the first two of a larger selection would be a guess about
 * which two the host meant.
 */
export async function pairSelectedGuests(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const guestIds = parseGuestIds(formData);

  if (guestIds.length !== 2) {
    redirect(
      backToList(eventId, {
        error: encodeURIComponent('Select exactly two guests to pair them.'),
      }),
    );
  }
  const [a, b] = guestIds as [string, string];
  if (a === b) {
    redirect(
      backToList(eventId, {
        error: encodeURIComponent('A guest cannot be paired with themselves.'),
      }),
    );
  }

  const supabase = await createClient();

  /*
    ⚖ OWNER 2026-09-20: "a pair may not span two printed groups — refuse with a
    reason." A line lives inside ONE group, because that is the unit the
    invitation prints and the unit `entourage_order` numbers. A bridesmaid
    paired to a ring bearer has no line to be in: whichever group you looked at,
    half the pair would be missing from it. Refusing with the reason is the
    honest answer; silently pairing them and printing two singles is not.

    A role that does not print at all (a plain guest) is NOT refused here —
    pairing is also just "these two arrive together", and the roster shows that
    perfectly well. Only a pair that straddles two PRINTED groups is impossible.
  */
  const { data: bothRows, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role')
    .eq('event_id', eventId)
    .in('guest_id', [a, b]);
  if (readErr) {
    redirect(backToList(eventId, { error: encodeURIComponent(readErr.message) }));
  }
  const groups = ((bothRows ?? []) as Array<{ guest_id: string; role: string | null }>)
    .map((r) => (r.role ? entourageGroupOfRole(r.role) : null))
    .filter((g): g is string => Boolean(g));
  if (groups.length === 2 && groups[0] !== groups[1]) {
    redirect(
      backToList(eventId, {
        error: encodeURIComponent(
          'Those two walk in different parts of the entourage, so they cannot share a line. ' +
            'Give them the same role group first, or leave them unpaired.',
        ),
      }),
    );
  }

  const { error } = await supabase.rpc('pair_guests', {
    p_event_id: eventId,
    p_guest_a: a,
    p_guest_b: b,
  });

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(backToList(eventId, { paired: '2' }));
}

/** Break a guest's pair — clearing BOTH halves, never just the row clicked. */
export async function unpairGuestAction(
  eventId: string,
  guestId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unpair_guest', {
    p_event_id: eventId,
    p_guest_id: guestId,
  });

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(backToList(eventId, { unpaired: '1' }));
}
