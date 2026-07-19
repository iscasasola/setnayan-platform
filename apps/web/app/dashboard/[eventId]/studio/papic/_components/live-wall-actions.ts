'use server';

/**
 * Salamisim Live Photo Wall — couple-side control actions (P1).
 *
 * Auth model: screen-code rows ride the P0 RLS policy
 * (wall_display_sessions_member_manage → couple/coordinator only); the
 * hide/unhide kill switch calls the wall_retract / wall_unhide DEFINER RPCs,
 * which re-check couple/coordinator membership INTERNALLY per call (a revoked
 * coordinator 403s on the next action). Nothing here touches service-role.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDisplayCode } from '@/lib/live-wall';
import { asWallTileLayout, clampWallPhotoCount } from '@/lib/live-wall-logic';

type ActionResult = { ok: true } | { ok: false; error: string };

function papicPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/papic`;
}

/** Both surfaces that render these controls (the add-on card + the P3 console). */
function revalidateWallSurfaces(eventId: string): void {
  revalidatePath(papicPath(eventId));
  revalidatePath(`/dashboard/${eventId}/live`);
}

/**
 * Save the couple's wall display config — how many tiles + which layout (owner
 * 2026-07-08 · D5). Membership-gated (couple/coordinator), then written with the
 * admin client; inputs are clamped/sanitized to the DB-valid range so a bad
 * value can never violate the events check constraints.
 */
export async function saveWallConfig(
  eventId: string,
  photoCount: number,
  tileLayout: string,
): Promise<ActionResult> {
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', clean)
    .eq('user_id', user.id)
    .maybeSingle();
  if (
    !membership ||
    (membership.member_type !== 'couple' && membership.member_type !== 'coordinator')
  ) {
    return { ok: false, error: 'forbidden' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({
      wall_photo_count: clampWallPhotoCount(photoCount),
      wall_tile_layout: asWallTileLayout(tileLayout),
    })
    .eq('event_id', clean);
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidateWallSurfaces(clean);
  return { ok: true };
}

/** Mint a single-use venue screen code (15-minute claim window per P0). */
export async function createWallScreenCode(eventId: string): Promise<ActionResult> {
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };
  const supabase = await createClient();
  const { error } = await supabase.from('wall_display_sessions').insert({
    event_id: clean,
    display_code: generateDisplayCode(),
  });
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidateWallSurfaces(clean);
  return { ok: true };
}

/** Revoke a screen (claimed or not) — the feed route 401s on its next tick. */
export async function revokeWallScreen(
  eventId: string,
  sessionId: string,
): Promise<ActionResult> {
  if (!eventId?.trim() || !sessionId?.trim()) return { ok: false, error: 'missing_input' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('wall_display_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidateWallSurfaces(eventId);
  return { ok: true };
}

/**
 * The kill switch: pull a photo off the wall in one tap. Wall-only by
 * default (reversible; the album keeps the photo); `alsoGallery` extends to
 * the durable gallery hide — two distinct semantics, never conflated.
 */
export async function hideWallTile(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
  alsoGallery: boolean,
): Promise<ActionResult> {
  if (!sourceId?.trim()) return { ok: false, error: 'missing_input' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('wall_retract', {
    p_source_table: sourceTable,
    p_source_id: sourceId,
    p_also_gallery: alsoGallery,
  });
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidateWallSurfaces(eventId);
  return { ok: true };
}

/** Reverse a wall-only hide (the gallery hide stays a gallery decision). */
export async function unhideWallTile(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
): Promise<ActionResult> {
  if (!sourceId?.trim()) return { ok: false, error: 'missing_input' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('wall_unhide', {
    p_source_table: sourceTable,
    p_source_id: sourceId,
  });
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidateWallSurfaces(eventId);
  return { ok: true };
}
