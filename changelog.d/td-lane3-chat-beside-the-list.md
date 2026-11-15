## 2026-11-12 · feat(chat): the list and the open thread side by side from 701, on both sides

The owner's D3 ruling (2026-11-13): from 701 chat shows the thread list and the open thread side by side, and the phone
stays full-screen. Chat now uses the same line as the rest of the large-screen system (Tailwind `tab:`, 701) and the same
two columns (`SupplierColumns` / `.sn-cols`). Before this it switched at 1024, so a 768 tablet got the phone's
full-screen thread beside the rail, and on desktop the list and the thread were separate pages.

- `globals.css` chat block: the full-screen takeover (and the no-rise rule that goes with it) now stops at `700.98px`
  instead of `1023.98px`. From 701 the thread keeps its quiet frame wherever it stands in flow. New rules place the chat
  in the columns: on a phone with a thread open, the list is hidden and the thread is shown full-screen, as before. From
  701 the thread fills its column with no card frame, its ‹ is hidden, and its xl `ConversationColumn` is not drawn
  next to the real list.
- `messages/_components/chat-panes.tsx` (new, used by both trees) wraps `SupplierColumns name="chats"`. The right
  column is never empty: on the list's own address it shows `ThreadArrival` and opens the newest active chat with
  `router.replace`. This happens only from 701, so a phone's list is never replaced and never marked read unseen. With
  nothing to open, the page stays one column.
- `messages/[threadId]/layout.tsx` (new, in each tree) puts the Chats page itself on the left (`__in: 'thread'`, the
  list alone, in its own Suspense boundary) and the unchanged thread page on the right. The picked supplier or client
  draws the thread directly, so it gets no list.
- `ChatInbox`: rows carry `paneHref`. From 701 a tap opens that thread next to the list. Below 701 the row's own `href`
  is unchanged (full-screen thread or picked page). The open row gets `aria-current` and the system's opened-row wash,
  and it reads as read.
- The couple's `messages/layout.tsx` now loads `supplier-frame.css`, the columns' one stylesheet.
- Guards: `lib/the-chat-is-messenger-shaped.test.ts` and
  `vendor-dashboard/messages/the-chats-page-is-full-screen.test.ts` now check the 701 line and the two-pane wiring.

Known cost: a thread route now also renders the list next to it, and on a phone it renders it hidden (the thread page's
own xl `conversationRows` read is now redundant). Retiring that read is a follow-up, because other guards pin it.

SPEC IMPACT: None. This applies the owner's 2026-11-13 D3 ruling, which is already recorded with the tablet/desktop plan.
