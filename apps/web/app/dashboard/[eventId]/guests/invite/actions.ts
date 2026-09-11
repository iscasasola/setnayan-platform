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
import { redirect } from 'next/navigation';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { INVITE_THEMES, isInviteThemeId, type InviteThemeId } from '@/lib/invite-themes';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';

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

/**
 * Save the invite link's theme (lib/invite-themes.ts · owner 2026-09-10).
 *
 * Couple-only, like everything else on this page (`assertCouple`). A Pro theme
 * also needs Event Hub Pro RIGHT NOW — re-checked here, server-side, because the
 * picker's disabled radio is a courtesy and a crafted post is not. The write goes
 * through the admin client after those checks: `events.invite_theme` carries a
 * SELECT grant only (migration 20271219583821), so no session write grant
 * widens the surface for a writer that does not need one.
 *
 * Unready skins are refused, so a crafted post cannot save a theme that would
 * only render as House.
 *
 * 🔒 AND SO ARE PRO THEMES ON A CELEBRATION THAT CANNOT HAVE ONE (owner Q7 = A,
 * 2026-09-11): the fence is `resolveWeddingOnlyParts(profile).save_the_date_film`
 * — the reveal's own, not a second opinion about it. The picker already hides
 * them there, and that is a courtesy; this is the refusal. It sits beside the
 * ownership re-check for the same reason and in the same place: after the couple
 * check, before the write.
 */
export async function setInviteTheme(eventId: string, formData: FormData): Promise<void> {
  try {
    await assertCouple(eventId);
  } catch {
    redirect(`/dashboard/${eventId}`);
  }
  const raw = formData.get('invite_theme');
  if (!isInviteThemeId(raw) || !INVITE_THEMES[raw].ready) {
    redirect(`/dashboard/${eventId}/guests/invite`);
  }
  const theme = raw as InviteThemeId;
  const admin = createAdminClient();
  if (INVITE_THEMES[theme].tier === 'pro') {
    // WEDDINGS ONLY first — it is the cheaper read and the one no purchase can
    // change, so a birthday is sent back to the picker rather than to a buy
    // page for something it could never use.
    const { data: row } = await admin
      .from('events')
      .select('event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    const mayShowStdFilm = await resolveProfile((row?.event_type as string | null) ?? '')
      .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
      // An unmeasured type is not a wedding. A refused read must never be the
      // reason a paid theme is saved.
      .catch(() => false);
    if (!mayShowStdFilm) redirect(`/dashboard/${eventId}/guests/invite`);
    const ownsPro = await eventCoupleWebsiteProActive(admin, eventId);
    if (!ownsPro) redirect(`/dashboard/${eventId}/studio/website-pro`);
  }
  const { error } = await admin.from('events').update({ invite_theme: theme }).eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/guests/invite?theme=error`);
  }
  revalidatePath(`/dashboard/${eventId}/guests/invite`);
  redirect(`/dashboard/${eventId}/guests/invite?theme=saved`);
}
