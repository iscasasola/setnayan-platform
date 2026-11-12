/**
 * 💬 AN OPEN THREAD SITS BESIDE ITS LIST FROM 701 (owner 2026-11-13, D3: *"chat shows the list and the open thread side
 * by side from 701; the phone stays full-screen"*).
 *
 * The list on the left is the Chats page itself (`../page.tsx`, drawn as the list alone — `__in: 'thread'`), never a
 * second inbox; the thread on the right is this route's page, untouched. `ChatPanes` puts them in the system's two
 * columns (`.sn-cols`). Below 701 the list steps aside and the thread is the full-screen takeover, exactly as before.
 *
 * The list is its own Suspense boundary: the thread never waits for the list (on a phone the list is not even shown).
 * The picked supplier's Chat draws the thread page directly (`__embed: 'chat'`), not through this route — no list there.
 */
import { Suspense, type ReactNode } from 'react';
import CoupleMessagesPage from '../page';
import { ChatPanes } from '../_components/chat-panes';

export default function CoupleThreadLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string; threadId: string }>;
}) {
  return (
    <ChatPanes
      open
      list={
        <Suspense fallback={null}>
          <CoupleMessagesPage params={params} searchParams={Promise.resolve({ __in: 'thread' })} />
        </Suspense>
      }
    >
      {children}
    </ChatPanes>
  );
}
