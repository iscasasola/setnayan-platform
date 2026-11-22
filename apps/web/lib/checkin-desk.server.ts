import 'server-only';

/**
 * 🛂 WHO MAY OPEN WHICH PART OF THE CHECK-IN DESK — the read (lib/checkin-desk.ts holds the rules).
 *
 * ONE answer for the desk page and its actions, so a part the page does not draw is a part the action refuses —
 * never a button that works for somebody the hosts turned Off, and never a screen that hides what the action allows.
 *
 * Four facts, read together in one round trip, every one of them something the event already holds:
 *   · the viewer's own seat (`event_moderators.role_subtype`, their own row — RLS lets them read it);
 *   · `is_booked_coordinator(event)` and `supplier_proposes_only(event)` — the caller's own answers (SECURITY DEFINER,
 *     granted to authenticated; migrations 20271329284628 / 20271329978605);
 *   · the hosts' choice, `events.checkin_desk_access` — service role only (migration 20271357880360), so it is read
 *     ONLY after the caller passed the page's / action's door-crew check.
 *
 * 🔌 A REFUSED READ IS SAID, NEVER GUESSED: `unread: true` comes back and the caller decides (the page says it could
 * not load the parts; an action answers "try again", which the offline queue retries — never "not allowed").
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { seatIsFullCohost } from '@/lib/guest-access';
import { logQueryError } from '@/lib/supabase/error-detect';
import { deskPartsFor, deskRoleOf, parseDeskAccess, type DeskAccess, type DeskPart, type DeskRole } from '@/lib/checkin-desk';

export type DeskViewer = {
  role: DeskRole | null;
  parts: DeskPart[];
  access: DeskAccess;
  /** One of the four reads did not answer. */
  unread: boolean;
};

export async function readDeskViewer(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  facts: { isCouple: boolean; isCoordinatorMember: boolean },
): Promise<DeskViewer> {
  const admin = createAdminClient();
  const [seatRes, coordRes, supplierRes, accessRes] = await Promise.all([
    supabase
      .from('event_moderators')
      .select('role_subtype')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .is('removed_at', null)
      .not('accepted_at', 'is', null)
      .maybeSingle(),
    supabase.rpc('is_booked_coordinator', { p_event_id: eventId }),
    supabase.rpc('supplier_proposes_only', { p_event_id: eventId }),
    admin.from('events').select('checkin_desk_access').eq('event_id', eventId).maybeSingle(),
  ]);
  const errs = [
    ['seat', seatRes.error],
    ['bookedCoordinator', coordRes.error],
    ['supplierProposesOnly', supplierRes.error],
    ['access', accessRes.error],
  ] as const;
  for (const [what, e] of errs) {
    if (e) logQueryError(`readDeskViewer.${what}`, e, { event_id: eventId }, 'graceful_degrade');
  }
  const seatRole = (seatRes.data as { role_subtype?: string | null } | null)?.role_subtype ?? null;
  const access = parseDeskAccess((accessRes.data as { checkin_desk_access?: unknown } | null)?.checkin_desk_access ?? null);
  const role = deskRoleOf({
    isHost: facts.isCouple || (seatRole != null && seatIsFullCohost(seatRole)),
    bookedCoordinator: coordRes.data === true,
    supplierProposesOnly: supplierRes.data === true,
    seatRole,
    isCoordinatorMember: facts.isCoordinatorMember,
  });
  const unread = errs.some(([, e]) => Boolean(e));
  return {
    role,
    parts: deskPartsFor(role, access, userId, unread),
    access,
    unread,
  };
}

/**
 * 🛂 THE SUPPLIER AT THE DOOR'S WAY IN (owner 16 Nov 2026; BUILD_RULES "every capability has one reachable place per
 * role"). A booked supplier who is not the coordinator has no "Events you run" row, so their Event Hub's Scanner view
 * asks this instead: the parts the hosts gave THIS person as the supplier at the door — or none. Read with the service
 * role (the column has no user grant), and it answers only about the caller: another person's pick reads as none.
 * `null` = the read did not answer (the Hub says nothing rather than a door that may not open).
 */
export async function readMyDeskDoorParts(eventId: string, userId: string): Promise<DeskPart[] | null> {
  const { data, error } = await createAdminClient()
    .from('events')
    .select('checkin_desk_access')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    logQueryError('readMyDeskDoorParts', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const door = parseDeskAccess((data as { checkin_desk_access?: unknown } | null)?.checkin_desk_access ?? null).door;
  return door && door.userId === userId ? [...door.parts] : [];
}
