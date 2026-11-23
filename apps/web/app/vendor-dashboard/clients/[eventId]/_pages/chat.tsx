import { Suspense } from 'react';
import Link from 'next/link';
import { SupplierThreadBody } from '@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body';
import { SUPPLIER_CHATS_HREF } from '@/app/vendor-dashboard/customers/anchors';
import { ChatHomeTop } from '@/app/_components/chat/chat-home';
import type { PickedPageProps } from './context';
import { TheirEventList } from '../_components/their-event-list';
import { CoordinatorPane, TheirEventColumn } from '../_components/their-event-pane';
import { TheirEventPartBody } from '../_components/their-event-part-body';
import { SupplierColumns } from '@/app/vendor-dashboard/_components/supplier-columns';
import { COLUMN_PARTS, theirEventColumnHref } from '@/lib/their-event';

/**
 * CHAT — the picked client's page (THE ONE BUILD, v111 "Chat lives in the client"; spec plans/supplier_one_build_2026-11-08
 * B1 step 7 + §4). Mounted by the client shell (`PickedClientShell`, lane L2).
 *
 * ONE chat body, shared: this renders the shipped supplier thread itself (`SupplierThreadBody` view 'chat' → the thread
 * page, the one `<ChatMessageStream>` mount site) without its full-screen frame. The stream draws the hosts strip
 * ("Shared chat · N inside", a ring for whoever is in this chat now), each host's first name + initials on their run,
 * and tap-to-heart. The ＋ in the send row opens the shipped `ThreadToolsSheet`. No calls (the chat has none), no unsend,
 * no slash topics, no bubble → decision (all out by the owner's 8 Nov list).
 *
 * The full-screen route `/vendor-dashboard/messages/[threadId]` stays for the envelope doors (6 Nov ruling).
 * No thread with this client → the chats list (`SUPPLIER_CHATS_HREF`), never an empty box that cannot send.
 */
export function ChatPage({ ctx }: PickedPageProps) {
  const { threadId } = ctx;
  if (!threadId) {
    return (
      <div data-picked-client-page="chat" data-empty="no-thread">
        {/* 💬 The summary strip still stands with no conversation yet (the chat that would draw it is not here). */}
        <ChatHomeTop />
        <div className="px-4 py-6 text-sm text-ink/70">
        <p>No conversation with this client yet.</p>
        <Link href={SUPPLIER_CHATS_HREF} className="mt-2 inline-flex min-h-11 items-center text-terracotta-700 underline">
          Your chats ›
        </Link>
        </div>
      </div>
    );
  }
  const rows = ctx.theirEventRows && ctx.theirEventRows.length > 0 ? ctx.theirEventRows : null;
  // 📱 On a phone the list stays above the chat, every row to its own full-screen page (as approved). From 701 it moves
  // into the right column (below), so it is not drawn twice.
  const theirEvent = rows ? (
    <div className="px-4 pt-3 tab:hidden">
      <TheirEventList eventId={ctx.eventId} rows={rows} />
    </div>
  ) : null;
  const chat = (
    <>
    {theirEvent}
    <Suspense
      fallback={
        <div data-picked-client-page="chat">
          <ChatHomeTop />
          <p className="px-4 py-6 text-sm text-ink/70" role="status">
            Loading the chat…
          </p>
        </div>
      }
    >
      <SupplierThreadBody threadId={threadId} view="chat" search={ctx.threadSearch} />
    </Suspense>
    </>
  );

  // 🖥 DESKTOP SPLIT VIEW (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE EDITOR PER PART — APPROVED TO BUILD";
  // drawing `desktop_split_view_v2_fable.html` frames 1–2): the chat stays left; the right column is the hosts'
  // dashboard for the booked coordinator, the "Their event" list for every other booked supplier, and a part opens IN
  // that column with a back arrow. The system's two columns (`SupplierColumns`, from 701); a phone draws no pane.
  const pane = ctx.coordinatorPane ? (
    <CoordinatorPane eventName={ctx.eventName} dateLine={ctx.coordinatorPane.dateLine} placeLine={ctx.coordinatorPane.placeLine} rows={ctx.coordinatorPane.rows} />
  ) : rows && ctx.theirEventColumn ? (
    <TheirEventColumn
      eventId={ctx.eventId}
      rows={rows}
      listHref={theirEventColumnHref(ctx.eventId, null)}
      partHref={(part) => (COLUMN_PARTS.includes(part) ? theirEventColumnHref(ctx.eventId, part) : null)}
      open={
        ctx.theirEventColumn.open
          ? {
              part: ctx.theirEventColumn.open,
              body: (
                <TheirEventPartBody
                  eventId={ctx.eventId}
                  part={ctx.theirEventColumn.open}
                  open={rows.some((r) => r.part === ctx.theirEventColumn!.open)}
                  brief={ctx.theirEventColumn.brief}
                  group={ctx.theirEventColumn.group}
                  hubSlug={null}
                />
              ),
            }
          : null
      }
    />
  ) : null;
  if (!pane) return chat;
  return (
    <div className="tab:[&_.sn-cols-pane]:h-auto" data-chat-split="">
      <SupplierColumns name="client-chat" list={chat} pane={pane} paneLabel={`Their event · ${ctx.eventName}`} />
    </div>
  );
}

export default ChatPage;
