'use server';

/**
 * The HOST's side of the access conversation (owner ruling 2026-07-27).
 *
 * The host answers LINE BY LINE — a partial yes is a first-class outcome, not
 * a rounding error. Granting writes the mechanism that already ships:
 * `event_moderators.permissions_json.areas`, which every gated feature already
 * reads through `moderator_area_level`. Nothing new decides access.
 *
 * Deliberately host-only. `event_access_requests_host_answer` is scoped to
 * `current_event_ids()` and NOT extended to delegate moderators, because a
 * coordinator who could answer requests could answer their own.
 */

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { grantLevelFor, type AreaVerdict } from '@/lib/floor-command';
import {
  DELEGATE_AREAS,
  PERMISSION_TEMPLATES,
  type DelegateArea,
  type ModeratorPermissions,
} from '@/lib/event-moderators';

export type AnswerResult = { ok: boolean; error?: string };

function isArea(v: string): v is DelegateArea {
  return (DELEGATE_AREAS as readonly string[]).includes(v);
}

/**
 * Answer one request. `verdicts` maps each requested area to granted/declined;
 * anything the host left untouched stays unanswered and is simply not granted.
 *
 * Two writes, in this order:
 *   1. the moderator row (the actual grant — merged, never replaced, so an area
 *      the host shared last month is not silently revoked by today's answer);
 *   2. the request row (the record of what was asked and what was said).
 * If the first fails nothing is recorded as answered, which is the safe way
 * round: a lost record beats a phantom grant.
 */
export async function answerAccessRequest(
  eventId: string,
  requestId: string,
  verdicts: Record<string, AreaVerdict>,
): Promise<AnswerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: reqRow, error: reqErr } = await supabase
    .from('event_access_requests')
    .select('request_id, requester_user_id, requested_areas, status')
    .eq('request_id', requestId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (reqErr || !reqRow) return { ok: false, error: 'Could not find that request.' };
  const req = reqRow as {
    requester_user_id: string;
    requested_areas: string[];
    status: string;
  };
  if (req.status !== 'pending') return { ok: false, error: 'That request was already answered.' };

  // Only areas that were actually ASKED for can be answered — a host cannot
  // hand over something the coordinator never requested through this door.
  const asked = req.requested_areas.filter(isArea);
  const decisions: Partial<Record<DelegateArea, AreaVerdict>> = {};
  const granting: DelegateArea[] = [];
  for (const area of asked) {
    const v = verdicts[area];
    if (v !== 'granted' && v !== 'declined') continue;
    decisions[area] = v;
    if (v === 'granted') granting.push(area);
  }
  if (Object.keys(decisions).length === 0) {
    return { ok: false, error: 'Choose share or decline for at least one thing.' };
  }

  if (granting.length > 0) {
    const { data: existing } = await supabase
      .from('event_moderators')
      .select('moderator_id, permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', req.requester_user_id)
      .maybeSingle();

    const base: ModeratorPermissions =
      (existing as { permissions_json?: ModeratorPermissions } | null)?.permissions_json ??
      // 🚨 THIS USED TO SAY "the narrowest template" AND NAME
      // `wedding_planner_external`, WHICH CARRIES `edit_all: true`,
      // `checkout: true` AND `invite_hosts: true` — the WIDEST template a
      // delegate can hold. A sentence is not a mechanism. Combined with the
      // resolver's legacy fallback, a coordinator whose host granted them one
      // line came away holding EDIT on every planning area, the guest list
      // included. `viewer` is the template that is actually narrow: every flag
      // false. What they may touch comes from `areas` below — the lines the
      // host said yes to, and nothing else.
      PERMISSION_TEMPLATES.viewer;

    const merged: ModeratorPermissions = {
      ...base,
      areas: { ...(base.areas ?? {}) },
    };
    for (const area of granting) {
      merged.areas![area] = grantLevelFor(area);
    }

    const { error: modErr } = await supabase.from('event_moderators').upsert(
      {
        event_id: eventId,
        user_id: req.requester_user_id,
        role_subtype: 'wedding_planner_external',
        permissions_json: merged,
        invited_by_user_id: user.id,
        // They asked for this, so there is no invitation left to accept.
        accepted_at: new Date().toISOString(),
        removed_at: null,
      },
      { onConflict: 'event_id,user_id' },
    );
    if (modErr) return { ok: false, error: modErr.message };
  }

  const { error: updErr } = await supabase
    .from('event_access_requests')
    .update({
      status: 'answered',
      decisions,
      decided_by_user_id: user.id,
    })
    .eq('request_id', requestId)
    .eq('event_id', eventId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/dashboard/${eventId}/access-requests`);
  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  return { ok: true };
}

/**
 * Take an area back. The grant lives in one place, so revoking is one write —
 * and the feature closes on the coordinator's next request with no deploy.
 */
export async function revokeArea(
  eventId: string,
  moderatorUserId: string,
  area: string,
): Promise<AnswerResult> {
  if (!isArea(area)) return { ok: false, error: 'Unknown area.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('event_moderators')
    .select('permissions_json')
    .eq('event_id', eventId)
    .eq('user_id', moderatorUserId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Nothing to take back.' };

  const perms = (existing as { permissions_json: ModeratorPermissions }).permissions_json;
  const merged: ModeratorPermissions = { ...perms, areas: { ...(perms.areas ?? {}) } };
  // Explicit null, not delete — and it stays explicit now that an unnamed area
  // on an `areas`-carrying row already resolves to nothing. A written null is
  // the RECORD that the host took this back, which an absent key cannot be:
  // "never granted" and "granted then withdrawn" must not look identical.
  merged.areas![area] = null;

  const { error } = await supabase
    .from('event_moderators')
    .update({ permissions_json: merged })
    .eq('event_id', eventId)
    .eq('user_id', moderatorUserId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${eventId}/access-requests`);
  return { ok: true };
}
