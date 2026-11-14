import 'server-only';

/**
 * WHAT A BOOKED SUPPLIER HOLDS ON AN EVENT, AND THE ASK THEY HAVE WAITING — the two reads behind "Ask for access"
 * (`ask-access.tsx`), the floor console and the stage script. Moved out of the floor console's `access-actions.ts`
 * (a 'use server' file, where every export is a route) on 8 Nov 2026: they are only ever called by server components,
 * and the repo's server-action budget sits at its ceiling.
 */

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { FLOOR_REQUESTABLE_AREAS } from '@/lib/floor-command';
import type { DelegateArea, ModeratorPermissions } from '@/lib/event-moderators';
import { SUPPLIER_SEAT_ROLE, seatAreaLevel } from '@/lib/delegate-areas';

/**
 * What the host has already shared with this user on this event — as the DATABASE resolves it.
 *
 * ✋ CAPPED LIKE THE DATABASE (owner 8 Nov 2026): a supplier's seat (`wedding_planner_external`) held by a booked
 * supplier who is NOT the booked coordinator reads 'view' wherever the seat says 'edit' — `moderator_area_level` caps
 * it (migration 20271329978605), so promising Edit here would draw a control the database refuses. The cap's fact is
 * the database's own (`supplier_proposes_only`), never re-derived. A check that did not answer reads as capped — the
 * narrower promise.
 */
export async function fetchMyAreaGrants(
  eventId: string,
): Promise<Partial<Record<DelegateArea, 'edit' | 'view' | null>>> {
  // ⚡ The render's ONE sign-in answer (`getCurrentUser` is `cache()`d; the layout already asked) — this sent its own
  // auth round trip on every open (speed pass 2026-11-14). Outside a render it asks fresh, as before.
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return {};

  // RLS scopes this to rows the caller may see; the filter keeps it to their own.
  // ⚠ `accepted_at IS NOT NULL` MIRRORS THE DATABASE GATE, and it was missing.
  // `public.moderator_area_level` only ever looks at accepted, non-removed rows,
  // so an invitation nobody has accepted grants nothing — but this read counted
  // it as "already held" and quietly dropped that area from what the
  // coordinator could ask for. They would have been unable to ask for a thing
  // they did not have, on both screens at once.
  const [{ data }, proposes] = await Promise.all([
    supabase
      .from('event_moderators')
      .select('permissions_json, role_subtype, removed_at')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
      .is('removed_at', null)
      .maybeSingle(),
    supabase.rpc('supplier_proposes_only', { p_event_id: eventId }),
  ]);

  if (!data) return {};
  const seat = data as { permissions_json: ModeratorPermissions; role_subtype: string | null };
  const proposesOnly = seat.role_subtype === SUPPLIER_SEAT_ROLE && (proposes.error ? true : proposes.data === true);
  // Resolve through the SAME helper the SQL gate mirrors, so the UI's idea of
  // "already held" cannot drift from what moderator_area_level() will say.
  const out: Partial<Record<DelegateArea, 'edit' | 'view' | null>> = {};
  for (const area of FLOOR_REQUESTABLE_AREAS) out[area] = seatAreaLevel(seat.permissions_json, area, proposesOnly);
  return out;
}

/** Whether this coordinator already has an unanswered ask outstanding. */
export async function fetchMyPendingAsk(
  eventId: string,
): Promise<{ requestedAreas: DelegateArea[]; createdAt: string } | null> {
  // ⚡ The render's ONE sign-in answer (`getCurrentUser` is `cache()`d; the layout already asked) — this sent its own
  // auth round trip on every open (speed pass 2026-11-14). Outside a render it asks fresh, as before.
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return null;

  const { data } = await supabase
    .from('event_access_requests')
    .select('requested_areas, created_at')
    .eq('event_id', eventId)
    .eq('requester_user_id', user.id)
    // The line-by-line ask only — a claim ask (joined from the couple's link,
    // 2026-10-20) is the couple's Approve, not an area request.
    .eq('kind', 'areas')
    .eq('status', 'pending')
    .maybeSingle();

  if (!data) return null;
  const row = data as { requested_areas: string[]; created_at: string };
  return { requestedAreas: row.requested_areas as DelegateArea[], createdAt: row.created_at };
}

