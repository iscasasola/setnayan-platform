import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readShopChatPeople, readThreadHostPeople } from './chat-shop-people.server';
import { WHISPER_TEAM_REACH, hostsWhisperReach, isOnHostsSide, teamSideOf, whisperFilterWho, teamWhisperRecipients, whisperRecipients, type WhisperSide } from './chat-whisper';

/**
 * 🤫 WHO A WHISPER WOULD REACH, for the thread pages (DECISION_LOG 2026-11-19 "MESSAGE ⇄ WHISPER APPROVED"; Unichat
 * part E — 19 Nov "supplier whispers to co suppliers", 20 Nov "host and coordinator can whisper to each other").
 *
 * The same reads and the same rules (`whisperRecipients` · `teamWhisperRecipients`) the send core uses — so the box
 * offers a whisper exactly when one can be sent, and says who it reaches. The page's list is only what is DRAWN;
 * `sendChatMessageCore` reads it again at Send, and the database (`chat_messages_whisper_stays_on_its_side`) decides.
 *
 *   `null`               the viewer is on no whisper side here (a host who left, a stranger) → no whisper offered.
 *   `{ ids: [] }`        on a side, alone here → the box says there is nobody to whisper to.
 *   `{ unread: true }`   the read of who is here FAILED → the box says it could not load. Never "nobody": a failure
 *                        must not render identically to emptiness (🔒 lib/a-failed-whisper-read-is-not-nobody.test.ts).
 */
export type WhisperCoHosts = { ids: string[]; unread: boolean } | null;

export const WHISPER_CO_HOSTS_UNREAD: NonNullable<WhisperCoHosts> = { ids: [], unread: true };

/** The page's whole picture: the side, the list, and the line under the Private chip ("Only you, Ana and your coordinator"). */
export type WhisperAudience = {
  side: WhisperSide;
  ids: string[];
  unread: boolean;
  /** The line the composer shows while whispering. `null` when there is nobody (or the read failed — `unread` says so). */
  reach: string | null;
  /** Who sees this side's whispers, for the Private filter line ("the hosts and Liza only" · "your team only"). */
  filterWho: string | null;
  /** The OTHER hosts only (no coordinator) — for labelling a whisper written before `whisper_side` existed. */
  legacyCoHostIds: string[];
} | null;

export const WHISPER_AUDIENCE_UNREAD = (side: WhisperSide): NonNullable<WhisperAudience> => ({
  side,
  ids: [],
  unread: true,
  reach: null,
  filterWho: null,
  legacyCoHostIds: [],
});

/** First names by id, in ONE read — `null` when the read failed (the callers then say "your co-host(s)" / "your coordinator(s)"). */
async function readFirstNamesById(admin: SupabaseClient, ids: readonly string[]): Promise<Map<string, string> | null> {
  if (ids.length === 0) return new Map();
  const res = await admin.from('users').select('user_id, first_name, display_name').in('user_id', [...ids]);
  if (res.error) {
    logQueryError('readWhisperAudience.names', res.error, { count: ids.length }, 'graceful_degrade');
    return null;
  }
  const rows = (res.data ?? []) as Array<{ user_id: string; first_name: string | null; display_name: string | null }>;
  return new Map(rows.map((r) => [r.user_id, (r.first_name ?? '').trim() || (r.display_name ?? '').trim().split(/\s+/)[0] || '']));
}

/** Names for the reach and filter lines; a failed read says "your co-host(s)" rather than inventing or dropping anyone. */
function namesFor(byId: Map<string, string> | null, ids: readonly string[], one: string, many: string, each: string): string[] {
  if (ids.length === 0) return [];
  if (!byId) return [ids.length === 1 ? one : many];
  return ids.map((id) => byId.get(id) || each);
}

/** The hosts' side: the hosts seated in this chat + the event's coordinators; a coordinator may whisper too (20 Nov). */
export async function readHostsWhisper(
  admin: SupabaseClient,
  args: { threadId: string; eventId: string; vendorProfileId: string; viewerId: string },
): Promise<WhisperAudience> {
  const [hostPeople, shop] = await Promise.all([
    readThreadHostPeople(admin, { threadId: args.threadId, eventId: args.eventId }),
    readShopChatPeople(admin, { vendorProfileId: args.vendorProfileId, eventId: args.eventId }),
  ]);
  // Either read refused → say so (a shop login could otherwise be named on the hosts' list).
  if (!hostPeople.measured || !shop.measured) return WHISPER_AUDIENCE_UNREAD('hosts');
  const isHost = hostPeople.members.includes(args.viewerId);
  const isCoordinator = hostPeople.coordinators.includes(args.viewerId);
  // 🧭 A host of the event is on the hosts' side here, whatever their shop role (controller ruling on #8060, 20 Nov):
  // the shop's team side never holds a host. A COORDINATOR on the shop's team is the supplier here — never OFFERED a
  // hosts' whisper they cannot send (#8071 ruling): the same `isOnHostsSide` the send core refuses by.
  const shopUserIds = teamSideOf({ teamUserIds: shop.userIds, eventHostIds: hostPeople.eventHosts });
  if (!isOnHostsSide({ viewerId: args.viewerId, hostMemberIds: hostPeople.members, coordinatorIds: hostPeople.coordinators, teamSideIds: shopUserIds })) return null;
  const ids = whisperRecipients({
    hostMemberIds: hostPeople.members,
    coordinatorIds: hostPeople.coordinators,
    shopUserIds,
    senderUserId: args.viewerId,
  });
  const hostIds = ids.filter((id) => hostPeople.members.includes(id));
  const coordinatorIds = ids.filter((id) => !hostPeople.members.includes(id));
  const byId = await readFirstNamesById(admin, ids);
  const names = namesFor(byId, hostIds, 'your co-host', 'your co-hosts', 'a co-host');
  const viewerIsCoordinator = isCoordinator && !isHost;
  return {
    side: 'hosts',
    ids,
    unread: false,
    reach: hostsWhisperReach({ names, coordinators: coordinatorIds.length, viewerIsCoordinator }),
    // 🔎 The Private filter's "the hosts and Liza only" — the same list, the same read.
    filterWho: whisperFilterWho({
      side: 'hosts',
      coordinatorNames: namesFor(byId, coordinatorIds, 'your coordinator', 'your coordinators', 'your coordinator'),
      viewerIsCoordinator,
    }),
    legacyCoHostIds: whisperRecipients({ hostMemberIds: hostPeople.members, shopUserIds, senderUserId: args.viewerId }),
  };
}

/** The shop's side: the ONE team rule (`chat_shop_team_user_ids`) minus every host of the event. Hosts and coordinators never. */
export async function readTeamWhisper(
  admin: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; viewerId: string },
): Promise<WhisperAudience> {
  const [shop, hostsRes] = await Promise.all([
    readShopChatPeople(admin, { vendorProfileId: args.vendorProfileId, eventId: args.eventId }),
    admin.from('event_members').select('user_id').eq('event_id', args.eventId).eq('member_type', 'couple'),
  ]);
  if (hostsRes.error) logQueryError('readTeamWhisper.hosts', hostsRes.error, { event_id: args.eventId }, 'graceful_degrade');
  if (!shop.measured || hostsRes.error) return WHISPER_AUDIENCE_UNREAD('team');
  // 🧭 The ONE team rule, every host of the event taken out — a host whispers as a host (controller ruling, 20 Nov).
  const eventHostIds = ((hostsRes.data ?? []) as Array<{ user_id: string | null }>).map((r) => r.user_id ?? '').filter(Boolean);
  const team = teamSideOf({ teamUserIds: shop.userIds, eventHostIds });
  if (!team.includes(args.viewerId)) return null;
  const ids = teamWhisperRecipients({ teamUserIds: team, senderUserId: args.viewerId });
  return { side: 'team', ids, unread: false, reach: ids.length > 0 ? WHISPER_TEAM_REACH : null, filterWho: whisperFilterWho({ side: 'team' }), legacyCoHostIds: [] };
}

/** The 19 Nov shape (ids + unread), kept for its callers and guard: the hosts' side, coordinators now included. */
export async function readWhisperCoHostIds(
  admin: SupabaseClient,
  args: { threadId: string; eventId: string; vendorProfileId: string; viewerId: string },
): Promise<WhisperCoHosts> {
  const a = await readHostsWhisper(admin, args);
  if (!a) return null;
  if (a.unread) return WHISPER_CO_HOSTS_UNREAD;
  return { ids: a.ids, unread: false };
}
