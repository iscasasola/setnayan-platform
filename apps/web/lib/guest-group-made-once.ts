/**
 * guest-group-made-once.ts — 👥 THE ONE PLACE A COUPLE'S OWN GROUP IS WRITTEN (2026-10-21).
 *
 * Owner 2026-10-21, on the Guests quick-add bar's Group list (Bob · Bob · Loo · Loo · Mama · Mama · Relatives ·
 * Relatives): *"why do i see dupes on group names"*. They were not copies of one row: each pair was two `guest_groups`
 * rows with the same name on sides that share a list (a both-sides "Mama" with 6 guests beside an empty groom's-side
 * "Mama"). The table's unique key is `(event_id, lower(label), team_side)` (migration 20260607050000), so the database
 * allows that pair; the name rule (`groupNameClash`, lib/group-name-clash.ts, owner 2026-10-20 *"also not allow to have
 * a group name similarly written on the group already"*) refused it only in the Group dropdown's own create. The capture
 * bar's `#Group`, the Quick add sheet, claims, the Groups sidebar form and the map inserted without it.
 *
 * So EVERY server path that makes an own group calls `makeGuestGroupOnce`, and nothing else inserts into
 * `guest_groups` (guard: `apps/web/lib/one-group-per-name.test.ts`). Before inserting it reads the event's own groups
 * and, when the name already shows in the same list (`ownTwin` — same side, or either is both sides; case, spaces and
 * punctuation ignored), it hands back THAT group (`created: false`) instead of writing a twin. The other side's
 * namesake (a bride's "Relatives" beside a groom's) is another family's group and is still made.
 *
 * 🔑 A refused read of the groups REFUSES the write — never "no twin". A 23505 (a racing insert of the exact key) is
 * answered by re-reading and reusing that row.
 *
 * Existing twins are never merged or rewritten here — that is the owner's call. This decides only what is written next.
 *
 * Not `server-only`: it takes the caller's Supabase client (the user's, so RLS on `guest_groups` still decides), so a
 * unit test can hand it a stand-in.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GuestGroupTeamSide } from '@/lib/guests';
import { ownTwin } from '@/lib/group-name-clash';
import { pickReuseGroup } from '@/lib/guest-group-reuse';
import { logQueryError } from '@/lib/supabase/error-detect';

export type MadeGroup = { group_id: string; label: string; team_side: GuestGroupTeamSide };
export type MadeGroupResult = { ok: true; group: MadeGroup; created: boolean } | { ok: false; error: string; code?: string };

const asSide = (v: unknown): GuestGroupTeamSide => (v === 'bride' || v === 'groom' ? v : 'both');

async function ownGroups(supabase: SupabaseClient, eventId: string) {
  const { data, error } = await supabase.from('guest_groups').select('group_id, label, team_side').eq('event_id', eventId);
  if (error) {
    // The write that asked is REFUSED on this (never "no twin"); the reason is recorded here.
    logQueryError('makeGuestGroupOnce.ownGroups', error, { eventId });
    return null;
  }
  return ((data ?? []) as { group_id: string; label: string | null; team_side: string | null }[]).map((g) => ({
    groupId: g.group_id,
    label: g.label ?? '',
    teamSide: asSide(g.team_side),
  }));
}

/**
 * Find the group this `(label, side)` already is in its list, or make it. `label` is used as given (trim and length are
 * the caller's — each says its own words for an empty or long name).
 */
export async function makeGuestGroupOnce(
  supabase: SupabaseClient,
  eventId: string,
  label: string,
  rawSide: unknown,
): Promise<MadeGroupResult> {
  const side = asSide(rawSide);
  const own = await ownGroups(supabase, eventId);
  if (!own) return { ok: false, error: 'Couldn’t read your groups — nothing was made.' };
  const twin = ownTwin(label, side, own);
  if (twin) return { ok: true, group: { group_id: twin.groupId, label: twin.label, team_side: twin.teamSide }, created: false };

  const { data, error } = await supabase.from('guest_groups').insert({ event_id: eventId, label, team_side: side }).select('group_id, label');
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      const again = await ownGroups(supabase, eventId);
      const hit = again ? pickReuseGroup(again.map((g) => ({ group_id: g.groupId, label: g.label, team_side: g.teamSide })), label, side) : null;
      if (hit) return { ok: true, group: { group_id: hit.group_id, label: hit.label, team_side: side }, created: false };
      return { ok: false, error: 'A group with that name already exists.', code };
    }
    return { ok: false, error: error.message, code };
  }
  const row = ((data ?? []) as { group_id: string; label: string }[])[0];
  if (!row) return { ok: false, error: 'Couldn’t make that group.' };
  return { ok: true, group: { group_id: row.group_id, label: row.label, team_side: side }, created: true };
}
