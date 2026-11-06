import { BackButton } from '@/app/_components/back-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { TimelineReadProblem } from '@/app/_components/timeline-read-problem';
import { ChatInbox, type InboxRow } from '@/app/dashboard/[eventId]/messages/_components/chat-inbox';

/**
 * 💬 THE SUPPLIER'S CHATS — ONE FULL-SCREEN PAGE, INDEPENDENT OF EVERY MENU (owner 2026-11-06, verbatim: *"The chat page
 * is a full screen page, correct? Independent of any other menus? Why is it still jumping to customer events"*).
 *
 * Until today the envelope landed on Customers › Events (`CUSTOMER_LANDINGS.messages`, 2026-10-28) and
 * `/vendor-dashboard/messages` was a redirect stub into it, so a supplier who pressed ✉ was dropped among the shop's
 * menus. This is the couple's Messenger-shaped inbox (`ChatInbox`, owner-approved 2026-10-01 + 2026-10-28 "look and
 * feel like Messenger") — the SAME component, not a copy — fed the supplier's own rows:
 *
 *   · the rows are `buildVendorConversationRows`, the builder the open thread's column uses, over the inputs that column
 *     reads (`lib/vendor-conversation-inputs.server.ts`) — one shape, two lists;
 *   · unread is the envelope badge's own rule (`count_unread_message_threads()`, mirrored row-by-row by
 *     `readCoupleUnread`), so the dots and the ✉ number cannot disagree;
 *   · each row is ONE EVENT's chat, named by the one chat title (`eventChatTitle`) the thread head reads.
 *
 * 📱 FULL SCREEN: the page root carries `data-chat-takeover` — the mechanism an open thread already uses (globals.css
 * "AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE"): below 1024 it fixes itself over the shell, so no top bar, no pinned
 * Shop/Customers row and no bottom tabs. Its search row therefore stands at the page's own foot (`dock="foot"`), not on
 * the bottom dock the takeover covers. ‹ is the house `BackButton` (`variant="chat"`): back in place to where the
 * supplier came from, else Today (`lib/page-home.ts`, the URL parent).
 *
 * 🔌 A REFUSED READ IS NOT AN EMPTY INBOX. `read.kind === 'refused'` draws "Couldn't load your chats" with Try again —
 * never "No chats yet" (the `lib/guests.ts` precedent: the measurement must reach the render).
 */
export type SupplierChatsRead =
  | { kind: 'refused' }
  | {
      kind: 'read';
      rows: InboxRow[];
      /** False when the unread read was refused — the Unread filter says it could not check. */
      unreadMeasured: boolean;
      /** False when the thread read could not prove it reached the end — the list says so. */
      complete: boolean;
    };

export function SupplierChats({ read, viewerId }: { read: SupplierChatsRead; viewerId: string }) {
  return (
    <section data-chat-takeover="" data-supplier-chats="" className="mx-auto flex min-h-[27rem] w-full max-w-2xl flex-col px-4 pt-2">
      <PageMasthead title="Chats" />
      <header className="mb-1 flex items-center gap-1">
        <BackButton route="/vendor-dashboard/messages" variant="chat" className="-ml-2" />
        <h2 aria-hidden className="font-display text-[30px] font-semibold leading-tight text-ink">
          Chats
        </h2>
      </header>

      {read.kind === 'refused' ? (
        <TimelineReadProblem title="Couldn’t load your chats">
          This does not mean you have none — your chats are safe. Try again in a moment.
        </TimelineReadProblem>
      ) : read.rows.length === 0 && read.complete ? (
        // Empty is one line and nothing else — no filters, no search, over nothing.
        <p className="py-10 text-center text-sm text-ink/60" data-supplier-chats-empty="">
          No chats yet — a customer&rsquo;s first message lands here.
        </p>
      ) : (
        <>
          {read.complete ? null : (
            <p role="status" className="mb-2 text-[13px] text-ink/70" data-supplier-chats-incomplete="">
              Showing your newest chats — some older ones didn’t load. Reload to see them all.
            </p>
          )}
          <ChatInbox
            rows={read.rows}
            viewerId={viewerId}
            unreadMeasured={read.unreadMeasured}
            peerFilter={null}
            dock="foot"
            empty={<p className="py-10 text-center text-sm text-ink/60">No chats loaded.</p>}
          />
        </>
      )}
    </section>
  );
}
