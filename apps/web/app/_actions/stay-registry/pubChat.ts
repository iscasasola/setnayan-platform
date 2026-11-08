import 'server-only';
import type { PubChatStayDoor } from '@/lib/stay-doors/pubChat';
import type { StayWords } from '@/lib/save-in-place';
import { archiveThread, blockUser, reportUser, unarchiveThread, unblockUser } from '@/lib/chat-actions';
import { kind, type Door } from './_door';

/**
 * Archive / unarchive land on `return_to` with `?archived=1` / `?unarchived=1`. They stay in place on the two INBOXES
 * (the couple's `/dashboard/<ev>/messages`, the supplier's `/vendor-dashboard/messages`) — the row moves between
 * sections. Archive from INSIDE a supplier chat returns to Customers, which is leaving the chat: outside, so it
 * navigates as before (and so does Customers' own "move back"). Refusals are thrown in plain words; signed out →
 * `/login`. No event gate of its own (a thread is the gate) — `null`.
 */
const PUB_CHAT_INBOX_WORDS: StayWords = { within: [/^\/dashboard\/[^/]+\/messages$/, /^\/vendor-dashboard\/messages$/] };
const pubChatInbox = kind(PUB_CHAT_INBOX_WORDS, null);

/** Report / Block / Unblock come back to the conversation they were pressed in (`?reported=1`, `?blocked=1`, …). */
const PUB_CHAT_THREAD_WORDS: StayWords = { within: [/^\/dashboard\/[^/]+\/messages\/[^/]+$/, /^\/vendor-dashboard\/messages\/[^/]+$/] };
const pubChatThread = kind(PUB_CHAT_THREAD_WORDS, null);

export const PUB_CHAT: Readonly<Record<PubChatStayDoor, Door>> = {
  'pubChat.archiveThread': pubChatInbox(archiveThread),
  'pubChat.unarchiveThread': pubChatInbox(unarchiveThread),
  'pubChat.blockUser': pubChatThread(blockUser),
  'pubChat.unblockUser': pubChatThread(unblockUser),
  'pubChat.reportUser': pubChatThread(reportUser),
};
