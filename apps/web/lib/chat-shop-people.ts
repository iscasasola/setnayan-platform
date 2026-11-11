/**
 * THE SHOP SIDE OF A CONVERSATION — the pure rule `lib/chat-shop-people.server.ts` reads into (chat gaps, 8 Nov).
 *
 * Mirrors `chat_messages_member_insert` (unchanged, never widened): the owner; every owner/admin team member; a team
 * member below admin only when one of their assigned services serves THIS event. A deactivated member is out — so the
 * list can only be narrower than the database, never wider.
 */

export type ShopMemberRow = {
  vendor_team_member_id: string;
  user_id: string | null;
  role: string;
  deactivated_at: string | null;
};

export function shopChatPeopleFrom(args: {
  ownerUserId: string | null;
  team: readonly ShopMemberRow[];
  /** `vendor_team_member_id`s whose assigned service this event booked. */
  servingMemberIds: ReadonlySet<string>;
}): string[] {
  const out = new Set<string>();
  if (args.ownerUserId) out.add(args.ownerUserId);
  for (const m of args.team) {
    if (!m.user_id || m.deactivated_at) continue;
    if (m.role === 'owner' || m.role === 'admin' || args.servingMemberIds.has(m.vendor_team_member_id)) out.add(m.user_id);
  }
  return [...out];
}

/**
 * Who a message is told to — never its writer, never twice. Pure, so the fan-out's rules are one tested function.
 *
 *   · a HOST writes → `shopOwner` (the notice that already existed, as it ships), `shopTeam` (the shop's other people
 *     who may chat here — NEW, in the app only) and `hostsInApp` (the OTHER hosts in this thread and the event's
 *     coordinators — NEW, in the app only);
 *   · the SHOP writes → `hostsAsBefore` (the hosts IN this thread — the notice that already existed; a host who is not
 *     in this conversation could not open it, so is no longer told) and `hostsInApp` (the coordinators — NEW, in the
 *     app only).
 *
 * 📵 Every recipient this build ADDS is in `shopTeam` or `hostsInApp`, and those are told with `chat_message_in_app`
 * (app-only, never emailed) — so widening who is told adds no email.
 */
export function chatNoticeRecipients(args: {
  senderRole: 'couple' | 'vendor';
  senderUserId: string;
  shopOwnerUserId: string | null;
  shopPeople: readonly string[];
  threadMembers: readonly string[];
  coordinators: readonly string[];
}): { shopOwner: string | null; shopTeam: string[]; hostsAsBefore: string[]; hostsInApp: string[] } {
  const seen = new Set<string>([args.senderUserId]);
  const take = (ids: readonly string[]) => {
    const out: string[] = [];
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };
  if (args.senderRole === 'couple') {
    const shopOwner = take(args.shopOwnerUserId ? [args.shopOwnerUserId] : [])[0] ?? null;
    const shopTeam = take(args.shopPeople);
    const hostsInApp = take([...args.threadMembers, ...args.coordinators]);
    return { shopOwner, shopTeam, hostsAsBefore: [], hostsInApp };
  }
  const hostsAsBefore = take(args.threadMembers);
  const hostsInApp = take(args.coordinators);
  return { shopOwner: null, shopTeam: [], hostsAsBefore, hostsInApp };
}

/** The shop side for a block or a report: owner FIRST, then every team member, each person once. */
export function shopSideIds(owner: string | null, team: ReadonlyArray<string | null>): string[] {
  const out: string[] = [];
  for (const id of [owner, ...team]) if (id && !out.includes(id)) out.push(id);
  return out;
}
