import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { threadHostPeopleFrom } from '@/lib/chat-shop-people';

/**
 * WHO ON EACH SIDE MAY CHAT IN ONE (event × shop) CONVERSATION — the app's mirror of the policies, never wider
 * (chat gaps, owner 8 Nov 2026).
 *
 * ── THE SHOP SIDE — `readShopChatPeople` ─────────────────────────────────────
 * `chat_messages_member_insert` (20271330575424, unchanged here) admits on the shop side: the shop's OWNER
 * (`vendor_profiles.user_id`), an owner/admin team member (`current_vendor_profile_ids()`), and a team member below
 * admin on an event one of their ASSIGNED services serves (`current_vendor_ids('viewer')` ∧
 * `agent_customer_event_ids()`). Those three branches, with a deactivated member left out, are written ONCE as
 * `chat_shop_team_user_ids(shop, event)` (migration 20271355512715) and this reads it (service role, one RPC) — so
 * the send gate, the notice fan-out, the block check AND the whisper policies all use one rule. Narrower than RLS's
 * shop arm (which never looks at `deactivated_at`), never wider.
 *
 * ── THE HOSTS' SIDE — `readThreadHostPeople` ────────────────────────────────
 * Since 20271330575424 a host reads a supplier chat only as its MEMBER (a live `chat_thread_members` row); every
 * coordinator of the event is in every thread. A notice about a message goes to those people — never to an event
 * host who is not in this conversation and could not open it.
 */
export async function readShopChatPeople(
  admin: SupabaseClient,
  args: { vendorProfileId: string; eventId: string },
): Promise<{ ownerUserId: string | null; userIds: string[]; measured: boolean }> {
  // 🧭 ONE DEFINITION OF "TEAM" (controller ruling on the #8060 review, 20 Nov): the rule is written ONCE, in the
  // database — `chat_shop_team_user_ids(shop, event)` (migration 20271355512715) — and read here. The whisper
  // policies judge by the same function, so the app and the database can no longer disagree about who is the team.
  const [ownerRes, teamRes] = await Promise.all([
    admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', args.vendorProfileId).maybeSingle(),
    admin.rpc('chat_shop_team_user_ids', { p_vendor_profile_id: args.vendorProfileId, p_event_id: args.eventId }),
  ]);
  if (ownerRes.error) logQueryError('readShopChatPeople.owner', ownerRes.error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
  if (teamRes.error) logQueryError('readShopChatPeople.team', teamRes.error, { vendor_profile_id: args.vendorProfileId, event_id: args.eventId }, 'graceful_degrade');
  const ownerUserId = ((ownerRes.data as { user_id?: string | null } | null)?.user_id ?? null) || null;
  // A SETOF uuid comes back as bare strings; tolerate a `{ chat_shop_team_user_ids }` row shape too.
  const raw = (teamRes.data ?? []) as Array<string | { chat_shop_team_user_ids?: string | null } | null>;
  const ids = raw.map((r) => (typeof r === 'string' ? r : (r?.chat_shop_team_user_ids ?? null))).filter((id): id is string => Boolean(id));
  const userIds = [...new Set([...(ownerUserId ? [ownerUserId] : []), ...ids])];
  // ⚠ A FAILED READ IS NOT AN EMPTY TEAM (the whisper box says "couldn't load", never "no one" — Unichat part E).
  return { ownerUserId, userIds, measured: !ownerRes.error && !teamRes.error };
}

export async function readThreadHostPeople(
  admin: SupabaseClient,
  args: { threadId: string; eventId: string },
): Promise<{ members: string[]; coordinators: string[]; eventHosts: string[]; measured: boolean }> {
  // 🔒 A SEAT COUNTS ONLY WHILE ITS PERSON IS STILL A HOST OF THE EVENT (20271352461498, owner 19 Nov "yes fix the
  // co-host leak today"). A removed co-host's row can outlive their membership; reading the event's 'couple' rows in
  // the same trip keeps this list exactly as narrow as `current_thread_ids()`.
  const [membersRes, peopleRes] = await Promise.all([
    admin.from('chat_thread_members').select('user_id, left_at').eq('thread_id', args.threadId),
    admin.from('event_members').select('user_id, member_type').eq('event_id', args.eventId).in('member_type', ['couple', 'coordinator']),
  ]);
  if (membersRes.error) logQueryError('readThreadHostPeople.members', membersRes.error, { thread_id: args.threadId }, 'graceful_degrade');
  if (peopleRes.error) logQueryError('readThreadHostPeople.people', peopleRes.error, { event_id: args.eventId }, 'graceful_degrade');
  const people = threadHostPeopleFrom({
    seats: (membersRes.data ?? []) as Array<{ user_id: string | null; left_at: string | null }>,
    eventPeople: (peopleRes.data ?? []) as Array<{ user_id: string | null; member_type: string }>,
  });
  // ⚠ A FAILED READ IS NOT AN EMPTY CHAT. Either read refused → the lists above are empty, which is safe for who is
  // TOLD (narrower, never wider) but a lie if anybody SAYS it: `measured: false` lets the whisper box and the send core
  // say "couldn't check" instead of "no co-host is in this chat". (The guests.ts honest-read pattern.)
  return { ...people, measured: !membersRes.error && !peopleRes.error };
}
