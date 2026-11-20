import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readShopChatPeople, readThreadHostPeople } from './chat-shop-people.server';
import { WHISPER_TEAM_REACH, hostsWhisperReach, teamWhisperRecipients, whisperRecipients, type WhisperSide } from './chat-whisper';

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
  /** The OTHER hosts only (no coordinator) — for labelling a whisper written before `whisper_side` existed. */
  legacyCoHostIds: string[];
} | null;

export const WHISPER_AUDIENCE_UNREAD = (side: WhisperSide): NonNullable<WhisperAudience> => ({
  side,
  ids: [],
  unread: true,
  reach: null,
  legacyCoHostIds: [],
});

/** First names for the reach line; a failed read says "your co-host(s)" rather than inventing or dropping anyone. */
async function readFirstNames(admin: SupabaseClient, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const res = await admin.from('users').select('user_id, first_name, display_name').in('user_id', [...ids]);
  if (res.error) {
    logQueryError('readWhisperAudience.names', res.error, { count: ids.length }, 'graceful_degrade');
    return [ids.length === 1 ? 'your co-host' : 'your co-hosts'];
  }
  const rows = (res.data ?? []) as Array<{ user_id: string; first_name: string | null; display_name: string | null }>;
  const byId = new Map(rows.map((r) => [r.user_id, (r.first_name ?? '').trim() || (r.display_name ?? '').trim().split(/\s+/)[0] || '']));
  return ids.map((id) => byId.get(id) || 'a co-host');
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
  if (!isHost && !isCoordinator) return null;
  const shopUserIds = [...shop.userIds, ...(shop.ownerUserId ? [shop.ownerUserId] : [])];
  // One login can host the event AND run the shop: on this page it is a host, but it never whispers past itself.
  if (shopUserIds.includes(args.viewerId)) return null;
  const ids = whisperRecipients({
    hostMemberIds: hostPeople.members,
    coordinatorIds: hostPeople.coordinators,
    shopUserIds,
    senderUserId: args.viewerId,
  });
  const hostIds = ids.filter((id) => hostPeople.members.includes(id));
  const coordinatorCount = ids.filter((id) => !hostPeople.members.includes(id)).length;
  const names = await readFirstNames(admin, hostIds);
  return {
    side: 'hosts',
    ids,
    unread: false,
    reach: hostsWhisperReach({ names, coordinators: coordinatorCount, viewerIsCoordinator: isCoordinator && !isHost }),
    legacyCoHostIds: whisperRecipients({ hostMemberIds: hostPeople.members, shopUserIds, senderUserId: args.viewerId }),
  };
}

/** The shop's side: its own people who may chat here (owner + live members). Hosts and coordinators never. */
export async function readTeamWhisper(
  admin: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; viewerId: string },
): Promise<WhisperAudience> {
  const shop = await readShopChatPeople(admin, { vendorProfileId: args.vendorProfileId, eventId: args.eventId });
  if (!shop.measured) return WHISPER_AUDIENCE_UNREAD('team');
  const team = [...new Set([...(shop.ownerUserId ? [shop.ownerUserId] : []), ...shop.userIds])];
  if (!team.includes(args.viewerId)) return null;
  const ids = teamWhisperRecipients({ teamUserIds: team, senderUserId: args.viewerId });
  return { side: 'team', ids, unread: false, reach: ids.length > 0 ? WHISPER_TEAM_REACH : null, legacyCoHostIds: [] };
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
