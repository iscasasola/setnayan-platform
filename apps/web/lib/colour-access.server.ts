import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import { isColourDomain, type ColourChangeRow, type ColourDomain } from './colour-access';
import { seatsThatTakeColourGrants } from './guest-access';

/**
 * MB16 · the people a couple may hand colour domains to, with what each holds
 * now and what each has changed — assembled once, for any screen that draws
 * `CoordinatorColourDomains`.
 *
 * Moved out of the Hosts page (2026-09-30, the Hosts fold): the hired planner's
 * domains now sit on their supplier workspace, and a limited helper's go on
 * their guest card next (build F2). Two screens, one assembly — so the rule
 * below cannot be kept on one and dropped on the other.
 *
 * 🔑 WHO IS ELIGIBLE IS THE SHIPPED DEFINITION, NOT A NEW ONE:
 * `set_coordinator_colour_access` requires an `event_members` row with
 * `member_type = 'coordinator'`, which `sync_delegate_membership`
 * (20271251336140) mints for a limited helper / hired planner seat. A FULL
 * co-host seat (bride, groom, partner, co-host, celebrant) becomes a `couple`
 * member instead, and already holds every colour. Listing one offered switches
 * the gate refuses, under a card that called the Bride a coordinator (owner
 * 2026-09-30: "Claire Buanhog is not a coordinator"). The rule is the pure
 * `seatsThatTakeColourGrants` (lib/guest-access.ts), which mirrors the SQL
 * split, so the screen and the gate agree.
 *
 * ⚠ `measured` IS CARRIED. A refused read renders as "nobody has any colour
 * access" and "nobody changed anything" — both indistinguishable from the
 * truth, and both wrong in the direction that matters.
 */
export type ColourGranteeSeat = {
  user_id: string | null;
  role_subtype: string;
  displayName: string;
  roleLine: string;
};

export type ColourGrantee = {
  userId: string;
  displayName: string;
  roleLine: string;
  active: ColourDomain[];
  changes: ColourChangeRow[];
};

export async function loadCoordinatorColourGrantees(
  admin: SupabaseClient,
  eventId: string,
  seats: readonly ColourGranteeSeat[],
  /** The viewer — the couple already hold every colour, so they are never listed. */
  viewerUserId: string,
): Promise<{ measured: boolean; grantees: ColourGrantee[] }> {
  const eligible = seatsThatTakeColourGrants(seats, viewerUserId);
  if (eligible.length === 0) return { measured: true, grantees: [] };

  const [{ data: grantRows, error: grantErr }, { data: changeRows, error: changeErr }] = await Promise.all([
    admin
      .from('event_colour_grants_coordinator')
      .select('user_id, domain, is_active')
      .eq('event_id', eventId)
      .eq('is_active', true),
    admin
      .from('event_colour_changes')
      .select(
        'change_id, domain, target_kind, target_key, target_index, old_value, new_value, actor_kind, actor_user_id, actor_label, vendor_id, created_at, reverted_at',
      )
      .eq('event_id', eventId)
      .eq('actor_kind', 'coordinator')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (grantErr) logQueryError('loadCoordinatorColourGrantees.grants', grantErr, { eventId }, 'graceful_degrade');
  if (changeErr) logQueryError('loadCoordinatorColourGrantees.changes', changeErr, { eventId }, 'graceful_degrade');

  const activeByUser = new Map<string, ColourDomain[]>();
  for (const raw of (grantRows ?? []) as { user_id: string; domain: string }[]) {
    if (!isColourDomain(raw.domain)) continue;
    const list = activeByUser.get(raw.user_id) ?? [];
    list.push(raw.domain);
    activeByUser.set(raw.user_id, list);
  }
  const changesByUser = new Map<string, ColourChangeRow[]>();
  for (const raw of (changeRows ?? []) as (ColourChangeRow & { actor_user_id: string | null })[]) {
    if (!raw.actor_user_id) continue;
    const list = changesByUser.get(raw.actor_user_id) ?? [];
    list.push(raw);
    changesByUser.set(raw.actor_user_id, list);
  }
  return {
    measured: !grantErr && !changeErr,
    grantees: eligible.map((s) => ({
      userId: s.user_id,
      displayName: s.displayName,
      roleLine: s.roleLine,
      active: activeByUser.get(s.user_id) ?? [],
      changes: changesByUser.get(s.user_id) ?? [],
    })),
  };
}
