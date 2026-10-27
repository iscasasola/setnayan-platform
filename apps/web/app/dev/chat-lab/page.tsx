/**
 * /dev/chat-lab — the couple's Chats inbox, Messenger-shaped (chat prototype 2026-10-28, frame A), on fixture rows: no
 * sign-in, no database. DEV-ONLY: production builds 404 this route (first statement). Draws the REAL `ChatInbox` inside
 * the real lab shell, so the thumb row stands on the real bottom dock. A row opens /dev/chat-lab/t/<id>, whose
 * `loading.tsx` is the thread's real `ThreadArrival`.
 */
import { notFound } from 'next/navigation';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { ChatInbox, type InboxRow } from '@/app/dashboard/[eventId]/messages/_components/chat-inbox';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { StartThreadPicker } from '@/app/dashboard/[eventId]/messages/_components/start-thread-picker';
import { EVENT_LINE, LAB_EVENT, LAB_THREADS, LAB_USER } from './fixtures';

export default async function ChatLabInboxPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const rows: InboxRow[] = LAB_THREADS.map((t) => ({
    threadId: t.id,
    href: `/dev/chat-lab/t/${t.id}`,
    name: t.name,
    logoUrl: null,
    preview: t.preview,
    timeLabel: t.time,
    unread: t.unread,
    tag: t.tag,
    eventLine: EVENT_LINE,
    archived: false,
    archive: <ThreadArchiveToggle threadId={t.id} returnTo="/dev/chat-lab" archived={false} />,
  }));
  return (
    <LabShell eventId={LAB_EVENT}>
      <section className="mx-auto w-full max-w-2xl">
        <header className="mb-1">
          <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">Chats</h2>
        </header>
        <ChatInbox
          rows={rows}
          viewerId={LAB_USER}
          empty={<p>No chats yet.</p>}
          newMessage={
            <>
              <p className="mb-2 mt-1 text-[13px] text-ink/60">{EVENT_LINE} — this event&rsquo;s suppliers only</p>
              <StartThreadPicker
                eventId={LAB_EVENT}
                team={LAB_THREADS.map((t, i) => ({ vendorId: `lab-${i}`, name: t.name }))}
                variant="rows"
              />
            </>
          }
        />
      </section>
    </LabShell>
  );
}
