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
import { generateDisplayCode } from '@/lib/live-wall';

type ActionResult = { ok: true } | { ok: false; error: string };

function papicPath(eventId: string): string {
  return `/dashboard/${eventId}/add-ons/papic`;
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
  revalidatePath(papicPath(clean));
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
  revalidatePath(papicPath(eventId));
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
  revalidatePath(papicPath(eventId));
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
  revalidatePath(papicPath(eventId));
  return { ok: true };
}
