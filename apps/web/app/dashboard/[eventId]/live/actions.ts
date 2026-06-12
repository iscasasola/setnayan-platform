'use server';

/**
 * Salamisim Live Photo Wall — the day-of console actions (P3).
 *
 * Auth model: the console is a couple/coordinator surface (the coordinator is
 * exactly who runs the wall at the venue — same authority the P0 RLS and the
 * wall RPCs already grant). The mode override writes `events.live_mode_override`,
 * but the shipped `couple_can_update_event` policy is couple-keyed only, so the
 * action checks membership (couple OR coordinator) itself and applies the
 * write on the admin client — the established app-level-scoping pattern for
 * coordinator-inclusive writes.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WallMode } from '@/lib/live-wall-logic';

type ActionResult = { ok: true } | { ok: false; error: string };

const OVERRIDABLE: ReadonlyArray<WallMode> = ['pre_event', 'live', 'recap'];

async function requireCoupleOrCoordinator(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }
  return user.id;
}

/**
 * Set (or clear, with null) the wall's lifecycle override. 'Auto' = NULL —
 * the server derives the mode from the event date; an override always wins
 * (resolveWallMode). Day-of uses: force the wall LIVE before the auto window
 * opens, or freeze it to RECAP when the program ends.
 */
export async function setWallMode(
  eventId: string,
  mode: WallMode | null,
): Promise<ActionResult> {
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };
  if (mode !== null && !OVERRIDABLE.includes(mode)) {
    return { ok: false, error: 'unsupported_mode' };
  }
  await requireCoupleOrCoordinator(clean);

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ live_mode_override: mode })
    .eq('event_id', clean);
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  revalidatePath(`/dashboard/${clean}/live`);
  return { ok: true };
}
