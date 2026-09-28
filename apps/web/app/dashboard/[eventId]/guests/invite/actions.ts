'use server';

/**
 * Invite/Join QR rotation (Data Flow Map audit gap #9).
 *
 * `event_join_tokens.revoked_at` / `expires_at` are honored by all four read
 * sites (`/join/[eventId]` page + action ×2 · `/[slug]/invite`) but NOTHING
 * wrote them — a printed or forwarded QR stayed valid forever, with no way for
 * the couple to cut off a leaked link. This action gives the couple a
 * "Regenerate QR" control.
 *
 * The table carries a UNIQUE constraint on `event_id` (one live token row per
 * event), so rotation is a single in-place UPDATE that swaps the `token` string
 * and clears `revoked_at`. Overwriting the string is what "revokes" the old QR:
 * every read site matches on `event_id + token`, so the moment the string
 * changes the old link resolves to nothing and fails closed — exactly the
 * behaviour those sites already implement for `revoked_at`.
 *
 * New token format mirrors the DB generator `generate_event_join_token()`
 * (`encode(gen_random_bytes(16), 'hex')` — a 32-char lowercase hex string) so a
 * rotated token is byte-shape-identical to a freshly minted one. This matches
 * the existing app-side precedent in `event-qr/actions.ts`
 * (`randomBytes(16).toString('hex')`).
 *
 * Auth: couple-only, via the same `assertCouple` membership check the sibling
 * reconcile action (`guests/claims/actions.ts`) uses. Kept in this page's OWN
 * actions file (not `app/dashboard/[eventId]/actions.ts`) per the parallel-work
 * de-confliction note.
 */

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export type RegenerateInviteQrResult =
  | { ok: true }
  | { ok: false; error: string };

/** Throw unless the caller is a couple member of this event. */
async function assertCouple(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/**
 * Rotate the event's guest-invite join token: mint a fresh 32-char hex token
 * and clear any `revoked_at` on the single per-event row. Old QRs/links stop
 * working immediately.
 */
export async function regenerateInviteQr(
  eventId: string,
): Promise<RegenerateInviteQrResult> {
  try {
    await assertCouple(eventId);
  } catch {
    return { ok: false, error: 'Only the couple can regenerate the invite QR.' };
  }

  if (!eventId) {
    return { ok: false, error: 'Missing event.' };
  }

  // 32 lowercase hex chars (16 bytes · ~128 bits entropy) — identical shape to
  // the DB `generate_event_join_token()` output and the event-qr rotation.
  const nextToken = randomBytes(16).toString('hex');

  // Admin client: the write mirrors the reconcile actions' pattern (auth is
  // enforced at the action layer via assertCouple, not RLS). Scope the UPDATE
  // to this event's single token row.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_join_tokens')
    .update({ token: nextToken, revoked_at: null })
    .eq('event_id', eventId)
    .select('event_id');

  if (error) {
    return { ok: false, error: 'Could not regenerate the QR — please try again.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No invite link found for this event yet.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests/invite`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true };
}
