import { Suspense } from 'react';
import Link from 'next/link';
import { SupplierThreadBody } from '@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body';
import { SUPPLIER_CHATS_HREF } from '@/app/vendor-dashboard/customers/anchors';

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
export function ChatPage({
  threadId,
}: {
  eventId: string;
  vendorProfileId: string;
  threadId: string | null;
}) {
  if (!threadId) {
    return (
      <div className="px-4 py-6 text-sm text-ink/70" data-picked-client-page="chat" data-empty="no-thread">
        <p>No conversation with this client yet.</p>
        <Link href={SUPPLIER_CHATS_HREF} className="mt-2 inline-flex min-h-11 items-center text-terracotta-700 underline">
          Your chats ›
        </Link>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <p className="px-4 py-6 text-sm text-ink/55" role="status" data-picked-client-page="chat">
          Loading the chat…
        </p>
      }
    >
      <SupplierThreadBody threadId={threadId} view="chat" />
    </Suspense>
  );
}

export default ChatPage;
