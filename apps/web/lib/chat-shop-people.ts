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

/**
 * THE HOSTS' SIDE OF ONE SUPPLIER CONVERSATION — the pure rule `readThreadHostPeople` reads into.
 *
 * Mirrors `current_thread_ids()` (20271352461498): a live `chat_thread_members` seat counts only while its person is
 * still a host ('couple') of the event — a removed co-host is never listed, so is never told about a message they
 * could not open. Every coordinator of the event is in every supplier conversation (no seat needed). `eventHosts` is
 * every host of the event, seated or not — never on the shop's team side here (`teamSideOf`). If the event's
 * people could not be read, nobody is listed — narrower than the database, never wider.
 */
export function threadHostPeopleFrom(args: {
  seats: ReadonlyArray<{ user_id: string | null; left_at: string | null }>;
  eventPeople: ReadonlyArray<{ user_id: string | null; member_type: string }>;
}): { members: string[]; coordinators: string[]; eventHosts: string[] } {
  const hosts = new Set<string>();
  const coordinatorIds = new Set<string>();
  for (const p of args.eventPeople) {
    if (!p.user_id) continue;
    if (p.member_type === 'couple') hosts.add(p.user_id);
    else if (p.member_type === 'coordinator') coordinatorIds.add(p.user_id);
  }
  const members = new Set<string>();
  for (const m of args.seats) {
    if (m.user_id && !m.left_at && hosts.has(m.user_id)) members.add(m.user_id);
  }
  const coordinators = new Set<string>();
  for (const id of coordinatorIds) if (!members.has(id)) coordinators.add(id);
  // Every host of the event, seated here or not — on the hosts' side whatever their shop role (`teamSideOf`).
  return { members: [...members], coordinators: [...coordinators], eventHosts: [...hosts] };
}
