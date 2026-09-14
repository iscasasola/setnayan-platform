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
