'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeGuestName } from '@/lib/guest-name';
import {
  GUEST_GROUP_TEAM_SIDES,
  type GuestGroupTeamSide,
} from '@/lib/guests';

/**
 * Mind-map inline-add actions (redesign Phase 2). Result-returning (no
 * redirect) so the map stays put and just refreshes — the map's twin of
 * quickAddGuest (which the map reuses verbatim for guest nodes). All writes go
 * through the USER client, so the couple-write RLS on guest_groups/guests is
 * the authorization (same trust model as the quick-add path).
 */

export type MapActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** "+" on a side branch → a new custom group on that side. */
export async function mapAddGroup(
  eventId: string,
  rawLabel: string,
  rawTeamSide: string,
): Promise<MapActionResult> {
  const label = rawLabel.trim().slice(0, 60);
  const teamSide = (
    GUEST_GROUP_TEAM_SIDES.includes(rawTeamSide as GuestGroupTeamSide)
      ? rawTeamSide
      : 'both'
  ) as GuestGroupTeamSide;
  if (!label) return { ok: false, error: 'Give the group a name.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data, error } = await supabase
    .from('guest_groups')
    .insert({ event_id: eventId, label, team_side: teamSide })
    .select('group_id')
    .single();

  if (error || !data) {
    // Idempotent on a duplicate name (unique index): return the existing group
    // so the map just renders it, instead of leaking the raw 23505.
    if ((error as { code?: string } | null)?.code === '23505') {
      const { data: existing } = await supabase
        .from('guest_groups')
        .select('group_id')
        .eq('event_id', eventId)
        .ilike('label', label)
        .maybeSingle();
      if (existing) {
        revalidatePath(`/dashboard/${eventId}/guests`);
        return { ok: true, id: existing.group_id };
      }
      return { ok: false, error: 'A group with that name already exists.' };
    }
    return { ok: false, error: 'Couldn’t create that group.' };
  }
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, id: data.group_id };
}

/** "+" on a guest node → record their plus-one. */
export async function mapAddPlusOne(
  eventId: string,
  guestId: string,
  rawName: string,
): Promise<MapActionResult> {
  const name = normalizeGuestName(rawName).slice(0, 80);
  if (!name) return { ok: false, error: 'Give the +1 a name.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  // .select() so a zero-row match (RLS denied / wrong event / deleted guest)
  // is a real failure, not a silent ok:true.
  const { data, error } = await supabase
    .from('guests')
    .update({ plus_one_allowed: true, plus_one_name: name })
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .select('guest_id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Couldn’t update that guest — try again.' };
  }
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, id: guestId };
}
