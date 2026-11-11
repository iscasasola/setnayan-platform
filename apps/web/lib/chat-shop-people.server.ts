import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { shopChatPeopleFrom, type ShopMemberRow } from '@/lib/chat-shop-people';

/**
 * WHO ON EACH SIDE MAY CHAT IN ONE (event × shop) CONVERSATION — the app's mirror of the policies, never wider
 * (chat gaps, owner 8 Nov 2026).
 *
 * ── THE SHOP SIDE — `readShopChatPeople` ─────────────────────────────────────
 * `chat_messages_member_insert` (20271330575424, unchanged here) admits on the shop side: the shop's OWNER
 * (`vendor_profiles.user_id`), an owner/admin team member (`current_vendor_profile_ids()`), and a team member below
 * admin on an event one of their ASSIGNED services serves (`current_vendor_ids('viewer')` ∧
 * `agent_customer_event_ids()`). `lib/chat-send.ts` used to admit only the owner, so an admin team member — whom the
 * policy admits — was told `not_member`. This reads the same three branches (service role, read-only, ONE trip per
 * table), so the send gate, the notice fan-out and the block check all agree with the database. A deactivated
 * member is left out, so this can only ever be NARROWER than RLS, never wider. The pure rule is
 * `lib/chat-shop-people.ts` (`shopChatPeopleFrom`) and its guard.
 *
 * ── THE HOSTS' SIDE — `readThreadHostPeople` ────────────────────────────────
 * Since 20271330575424 a host reads a supplier chat only as its MEMBER (a live `chat_thread_members` row); every
 * coordinator of the event is in every thread. A notice about a message goes to those people — never to an event
 * host who is not in this conversation and could not open it.
 */
export async function readShopChatPeople(
  admin: SupabaseClient,
  args: { vendorProfileId: string; eventId: string },
): Promise<{ ownerUserId: string | null; userIds: string[] }> {
  const [ownerRes, teamRes] = await Promise.all([
    admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', args.vendorProfileId).maybeSingle(),
    admin
      .from('vendor_team_members')
      .select('vendor_team_member_id, user_id, role, deactivated_at')
      .eq('vendor_profile_id', args.vendorProfileId),
  ]);
  if (ownerRes.error) logQueryError('readShopChatPeople.owner', ownerRes.error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
  if (teamRes.error) logQueryError('readShopChatPeople.team', teamRes.error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
  const ownerUserId = ((ownerRes.data as { user_id?: string | null } | null)?.user_id ?? null) || null;
  const team = (teamRes.data ?? []) as ShopMemberRow[];

  // Below admin: which of them hold an assigned service THIS event booked. Asked only when there is somebody to ask.
  const below = team.filter((m) => m.role !== 'owner' && m.role !== 'admin' && !m.deactivated_at);
  let servingMemberIds: Set<string> = new Set();
  if (below.length > 0) {
    const assigned = await admin
      .from('vendor_service_agents')
      .select('vendor_team_member_id, vendor_service_id')
      .in('vendor_team_member_id', below.map((m) => m.vendor_team_member_id));
    if (assigned.error) logQueryError('readShopChatPeople.assigned', assigned.error, { event_id: args.eventId }, 'graceful_degrade');
    const rows = (assigned.data ?? []) as Array<{ vendor_team_member_id: string; vendor_service_id: string }>;
    if (rows.length > 0) {
      const booked = await admin
        .from('event_vendors')
        .select('service_id')
        .eq('event_id', args.eventId)
        .in('service_id', [...new Set(rows.map((r) => r.vendor_service_id))]);
      if (booked.error) logQueryError('readShopChatPeople.booked', booked.error, { event_id: args.eventId }, 'graceful_degrade');
      const bookedIds = new Set(((booked.data ?? []) as Array<{ service_id: string | null }>).map((b) => b.service_id));
      servingMemberIds = new Set(rows.filter((r) => bookedIds.has(r.vendor_service_id)).map((r) => r.vendor_team_member_id));
    }
  }
  return { ownerUserId, userIds: shopChatPeopleFrom({ ownerUserId, team, servingMemberIds }) };
}

export async function readThreadHostPeople(
  admin: SupabaseClient,
  args: { threadId: string; eventId: string },
): Promise<{ members: string[]; coordinators: string[] }> {
  const [membersRes, coordRes] = await Promise.all([
    admin.from('chat_thread_members').select('user_id, left_at').eq('thread_id', args.threadId),
    admin.from('event_members').select('user_id').eq('event_id', args.eventId).eq('member_type', 'coordinator'),
  ]);
  if (membersRes.error) logQueryError('readThreadHostPeople.members', membersRes.error, { thread_id: args.threadId }, 'graceful_degrade');
  if (coordRes.error) logQueryError('readThreadHostPeople.coordinators', coordRes.error, { event_id: args.eventId }, 'graceful_degrade');
  const members = new Set<string>();
  for (const m of (membersRes.data ?? []) as Array<{ user_id: string; left_at: string | null }>) {
    if (m.user_id && !m.left_at) members.add(m.user_id);
  }
  const coordinators = new Set<string>();
  for (const c of (coordRes.data ?? []) as Array<{ user_id: string | null }>) {
    if (c.user_id && !members.has(c.user_id)) coordinators.add(c.user_id);
  }
  return { members: [...members], coordinators: [...coordinators] };
}
