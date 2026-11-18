import { supplierChatHref, supplierThreadPageHref } from '@/lib/upcoming-schedule-door';

/** The notice types a chat message sends (lib/chat-actions.ts · the call ring · an offered service). */
export const CHAT_NOTICE_TYPES = ['chat_message', 'chat_message_in_app'] as const;

/**
 * Every link a chat notice for ONE conversation can carry — the picked-page doors (couple: the workspace's Chat;
 * supplier: the picked client's Chat) and the old full-screen thread pages notices used before CHAT-07. Pure, so the
 * unit suite holds exactly which links clear.
 */
export function threadNoticeDoors(args: { eventId: string; threadId: string; coupleDoor: string | null }): string[] {
  const doors = new Set<string>([
    `/dashboard/${args.eventId}/messages/${args.threadId}`,
    supplierThreadPageHref(args.threadId),
    supplierChatHref(args.eventId, args.threadId),
  ]);
  if (args.coupleDoor) doors.add(args.coupleDoor);
  return [...doors];
}
