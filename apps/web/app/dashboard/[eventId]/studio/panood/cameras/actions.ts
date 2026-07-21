'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import { reissuePanoodCameraToken } from '@/lib/panood-camera-seats';

/**
 * Reissue a camera's claim link — the couple's remedy when an operator drops out, loses their
 * phone, or was simply the wrong person. Mints a fresh token and unbinds the old holder, so the
 * seat returns to "open" and can be handed to someone else.
 *
 * The old link dies immediately: `panood_claim_camera` only matches a LIVE, non-revoked token,
 * so a stale QR (printed, screenshotted, forwarded) can never re-bind. That is the point.
 *
 * Gated on control-room membership — the same boundary as the console itself.
 */
export async function reissuePanoodCamera(
  eventId: string,
  cameraId: number,
): Promise<{ ok: true } | { error: string }> {
  if (!eventId || !Number.isFinite(cameraId)) return { error: 'Missing camera.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) return { error: 'You don’t have control-room access for this event.' };

  const token = await reissuePanoodCameraToken(supabase, eventId, cameraId);
  if (!token) return { error: 'Could not reissue that camera link. Please try again.' };

  revalidatePath(`/dashboard/${eventId}/studio/panood/cameras`);
  return { ok: true };
}
