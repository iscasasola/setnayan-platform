/**
 * 🚪 A COUPLE'S CHAT NOTICE OPENS WHERE THEIR CHATS LIST OPENS (CHAT-07, W1 walk 16 Nov 2026).
 *
 * Measured live: tapping "New message from Liwanag" opened `/dashboard/<event>/messages/<thread>` — the old thread
 * page, with no Details · Quotation · Payment tabs — while the same conversation's row in Messages opens the picked
 * supplier on Chat (`/dashboard/<event>/vendors/<event_vendors.vendor_id>/workspace?tab=chat`). Two doors to one
 * conversation, and the notice's was the lesser one. The supplier side was fixed the same way on 11 Nov
 * (`supplierChatHref`, lib/supplier-notices-open-the-picked-client.test.ts); this is the couple's half.
 *
 * ONE SHAPE, two callers: the Messages list (which already holds the row) and every chat notice (which reads it once,
 * `readCoupleChatHref` in ./couple-chat-door.server.ts). A thread with no such row yet (an inquiry to a shop not on the
 * list) or the workspace flag off keeps the shipped door, the full-screen thread.
 *
 * PURE — no server-only import — so the unit suite and the list page can share it.
 */
export function coupleChatHref(eventId: string, eventVendorId: string | null | undefined, threadId: string): string {
  return eventVendorId
    ? `/dashboard/${eventId}/vendors/${eventVendorId}/workspace?tab=chat`
    : `/dashboard/${eventId}/messages/${threadId}`;
}
