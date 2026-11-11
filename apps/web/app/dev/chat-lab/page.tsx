/**
 * /dev/chat-lab — the couple's Chats inbox, Messenger-shaped (chat prototype 2026-10-28, frame A), on fixture rows: no
 * sign-in, no database. DEV-ONLY: production builds 404 this route (first statement). Draws the REAL `ChatInbox` inside
 * the real lab shell, so the thumb row stands on the real bottom dock. A row opens /dev/chat-lab/t/<id>, whose
 * `loading.tsx` is the thread's real `ThreadArrival`. `?delay=<ms>` makes the thread's server answer that slowly.
 *
 * 🪞 Build 3 · Lane A: `?pick=<id>&page=chat|details|…` — the row opens the host's PICKED SUPPLIER over the still-drawn
 * list (the real `PickedSupplierShell` — the one picked shell the supplier's picked client uses), on Chat. Its Chat body
 * is `LabPickedChat` (the embedded thread); Details is a lab stand-in for the workspace's own sections; the rest are lab
 * lines. Messenger order: "Unread · pinned" then "Recent"; one row carries a 🚦 due-now dot (fixture level).
 */
import { notFound } from 'next/navigation';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { ChatInbox, type InboxRow } from '@/app/dashboard/[eventId]/messages/_components/chat-inbox';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { StartThreadPicker } from '@/app/dashboard/[eventId]/messages/_components/start-thread-picker';
import { EVENT_LINE, LAB_EVENT, LAB_THREADS, LAB_USER } from './fixtures';
import { PickedSupplierShell } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell';
import {
  PICKED_SUPPLIER_PAGE_IDS,
  pickedSupplierMenuFor,
  type PickedSupplierPage,
} from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-menu';
import { LabPickedChat, type LabChatMode } from '@/app/dev/_components/lab-picked-chat';
import { CoupleChatsEmpty } from '@/app/dashboard/[eventId]/messages/_components/couple-chats-empty';

/** The picked supplier's pages in the lab. Details stands in for the workspace's own sections (hero · included · notes),
 * which are drawn inline by the server page and need a real event_vendors row. */
function labPickedSupplierBodies(threadId: string, name: string, mode: LabChatMode): Record<PickedSupplierPage, React.ReactNode> {
  const later = (label: string) => <p className="px-1 py-6 text-sm text-ink/60">(lab) {label} with {name}.</p>;
  const bodies = Object.fromEntries(PICKED_SUPPLIER_PAGE_IDS.map((id) => [id, later(id)])) as Record<PickedSupplierPage, React.ReactNode>;
  bodies.details = (
    <section className="space-y-3 px-1 py-2" data-picked-supplier-page="details">
      <p className="home-k2">(lab stand-in) Details</p>
      <h2 className="font-display text-2xl font-semibold text-ink">{name}</h2>
      <p className="text-sm text-ink/70">Photo &amp; video · December 18, 2026 · ~230 guests</p>
      <p className="text-sm text-ink">Quote sent · prep + reception + same-day edit</p>
    </section>
  );
  bodies.chat = <LabPickedChat threadId={threadId} side="couple" counterpartyLabel={name} actions={{ send: labSend, add: labAdd, leave: labLeave }} {...mode} />;
  return bodies;
}

/** 🚪 Lab stand-in for Lane B's join write (posts "[name] joined" for real) — writes nothing. */
/** The lab chat's stand-in writes — they write nothing (the real ones are Lane B's / the shipped send). */
async function labSend(formData: FormData): Promise<void> {
  'use server';
  void formData;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}
async function labAdd(userIds: string[], how: 'all' | 'picked'): Promise<void> {
  'use server';
  void userIds;
  void how;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}
async function labLeave(note: string | null): Promise<void> {
  'use server';
  void note;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

async function labJoin(threadId: string): Promise<void> {
  'use server';
  void threadId;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

export default async function ChatLabInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  // `?delay=<ms>` rides on to the thread — what the instant-open measurement is taken against.
  const delay = typeof sp.delay === 'string' ? `?delay=${encodeURIComponent(sp.delay)}` : '';
  const rows: InboxRow[] = LAB_THREADS.map((t, i) => ({
    threadId: t.id,
    // 🪞 Build 3 · Lane A: the first three open the picked supplier (as a booked-or-quoted supplier's row does on the real
    // page — `/dashboard/<eventId>/vendors/<eventVendorId>/workspace?tab=chat`); the rest keep the plain thread page.
    href: i < 3 ? `/dev/chat-lab?pick=${t.id}&page=chat` : `/dev/chat-lab/t/${t.id}${delay}`,
    opensPicked: i < 3,
    needsYou: i === 1 ? ('due-now' as const) : null,
    name: t.name,
    logoUrl: null,
    preview: t.preview,
    timeLabel: t.time,
    unread: t.unread,
    eventLine: 'Dec 18 · Ana & Miguel',
    archived: false,
    archive: <ThreadArchiveToggle threadId={t.id} returnTo="/dev/chat-lab" archived={false} />,
    // 🚪 Build 3 · Lane A: one chat you LEFT (greyed, tap → "Join this chat again?"); `?left=fail` = the refused read.
    left:
      i === 3
        ? sp.left === 'fail'
          ? ('unread' as const)
          : { at: '2026-11-08T09:30:00Z', note: 'Mama is handling the flowers now.' }
        : null,
  }));
  const picked = typeof sp.pick === 'string' ? LAB_THREADS.find((t) => t.id === sp.pick) ?? null : null;
  const page = ((PICKED_SUPPLIER_PAGE_IDS as readonly string[]).includes(String(sp.page)) ? sp.page : 'chat') as PickedSupplierPage;
  return (
    <LabShell eventId={LAB_EVENT}>
      <section className="mx-auto w-full max-w-2xl">
        <header className="mb-1">
          <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">Chats</h2>
        </header>
        <ChatInbox
          rows={sp.state === 'empty' ? [] : rows}
          viewerId={LAB_USER}
          join={labJoin}
          empty={<CoupleChatsEmpty eventId={LAB_EVENT} />}
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
      {picked ? (
        <PickedSupplierShell
          eventId={LAB_EVENT}
          eventVendorId={`lab-${picked.id.slice(-2)}`}
          supplierName={picked.name}
          menu={pickedSupplierMenuFor({ quote: true, chat: true })}
          initialPage={page}
          bodies={labPickedSupplierBodies(picked.id, picked.name, { hostsFail: sp.hosts === 'fail', noMessages: sp.msgs === '0', solo: sp.solo === '1', tallPins: sp.pins === 'tall', ...(sp.self === 'vendor' || sp.self === 'couple' ? { selfShop: sp.self } : {}) })}
          // 🔴 A lab sample for the Chat tab's badge (the real page reads `readThreadUnreadCount`); none on an empty chat.
          chatUnread={sp.msgs === '0' ? 0 : 2}
        />
      ) : null}
    </LabShell>
  );
}
