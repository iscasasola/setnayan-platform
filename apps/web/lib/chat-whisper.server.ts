import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readShopChatPeople, readThreadHostPeople } from './chat-shop-people.server';
import { whisperRecipients } from './chat-whisper';

/**
 * 🤫 WHO A WHISPER WOULD REACH, for the host's thread page (DECISION_LOG 2026-11-19 "MESSAGE ⇄ WHISPER APPROVED").
 *
 * The same two reads and the same rule (`whisperRecipients`) the send core uses — so the box offers a whisper exactly
 * when a whisper can be sent, and the stream labels as a whisper exactly the lines that are one. The page's list is
 * only what is DRAWN; `sendChatMessageCore` reads it again at Send and that read is the one that decides.
 *
 *   `null`  the viewer is not a host IN this chat (a coordinator, a host who left) → the page offers no whisper.
 *   `[]`    a host, alone here → the box says there is nobody to whisper to.
 */
export async function readWhisperCoHostIds(
  admin: SupabaseClient,
  args: { threadId: string; eventId: string; vendorProfileId: string; viewerId: string },
): Promise<string[] | null> {
  const [hostPeople, shop] = await Promise.all([
    readThreadHostPeople(admin, { threadId: args.threadId, eventId: args.eventId }),
    readShopChatPeople(admin, { vendorProfileId: args.vendorProfileId, eventId: args.eventId }),
  ]);
  if (!hostPeople.members.includes(args.viewerId)) return null;
  const shopUserIds = [...shop.userIds, ...(shop.ownerUserId ? [shop.ownerUserId] : [])];
  // One login can host the event AND run the shop: on this page it is a host, but it never whispers past itself.
  if (shopUserIds.includes(args.viewerId)) return null;
  return whisperRecipients({ hostMemberIds: hostPeople.members, shopUserIds, senderUserId: args.viewerId });
}
