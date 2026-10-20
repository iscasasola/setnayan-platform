'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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

/*
 * 🪦 `mapAddPlusOne` LIVED HERE AND IS GONE (2026-10-20). Its only caller, the
 * mind-map editor's "+" on a guest node, was retired with the 2026-10-07 List
 * and Map rewrite; nothing in app/, lib/ or the tests named it. Removed to keep
 * the server-action count under `lint-server-action-budget.mjs`'s ceiling for
 * `moveSupplierToCategory` (preference 2 in that script: un-export what nothing
 * imports). A plus-one is recorded through the guest sheet's own path.
 */
