/**
 * /dev/chat-lab/t/<id> — ONE thread, Messenger-shaped (chat prototype 2026-10-28, frames B–F), on fixture messages: no
 * sign-in, no database. DEV-ONLY: production builds 404 this route (first statement).
 *
 * Draws the thread page's REAL pieces — `ChatBox` (the full-screen takeover), `ChatSafetyBanner`, `ChatMessageStream`
 * (Realtime cannot connect here; the fixture is its first batch), `ChatSendForm` with the side's ＋ sheet — inside the
 * real lab shell, so a walk proves the takeover covers the top bar and the bottom tabs.
 *
 *   ?side=couple    the couple's ＋ (Deal or meeting · Share a file)          (default)
 *   ?side=vendor    the supplier's ＋, grouped; &booked=1 → booked (payment rows open)
 *   ?seen=1         the other side has read your last message → "Seen"
 *   ?send=fail      Send fails on the server → "Not sent · Try again"; default: it succeeds after 600 ms
 *   ?delay=<ms>     the server takes this long to answer (default 0) — what the instant open is measured against
 *   ?expiry=1       the event was 80 days ago → the files-rule line "These files go on <date>. Save any you need."
 *
 * The real thread routes' `loading.tsx` is `ThreadArrival`; this lab has NO loading.tsx (a dev route under a loading
 * boundary that 404s in production would stream a 200 first — `the-press-commits-now.test.ts`). It draws the same
 * `ThreadArrival` as a Suspense fallback instead, AFTER the production 404, so `?delay=` still shows the instant open.
 */
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ThreadArrival } from '@/app/_components/chat/thread-arrival';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';
import { ChatSafetyBanner } from '@/app/_components/chat-privacy-notice';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
import { ThreadToolPanel } from '@/app/_components/chat/thread-tool-panel';
import { ThreadToolHashReveal } from '@/app/_components/chat/reveal-thread-tool';
import {
  CoupleThreadToolsSheet,
  ThreadToolsSheet,
} from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import { dealEntryFor } from '@/lib/deal-entry';
import { initialsFor } from '@/lib/conversation-list';
import { LAB_EVENT, LAB_MESSAGES, LAB_STAFF, LAB_THREADS, LAB_USER } from '../../fixtures';

type LabProps = {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatLabThreadPage({ params, searchParams }: LabProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <LabShell eventId={LAB_EVENT}>
      <Suspense fallback={<ThreadArrival />}>
        <LabThread params={params} searchParams={searchParams} />
      </Suspense>
    </LabShell>
  );
}

async function LabThread({ params, searchParams }: LabProps) {
  const { threadId } = await params;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const side = one('side') === 'vendor' ? 'vendor' : 'couple';
  const booked = one('booked') === '1';
  const delay = Math.min(Number(one('delay')) || 0, 10000);
  const sendFails = one('send') === 'fail';
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const thread = LAB_THREADS.find((t) => t.id === threadId) ?? LAB_THREADS[0];
  const label = side === 'couple' ? thread.name : 'Ana & Miguel';
  const last = LAB_MESSAGES[LAB_MESSAGES.length - 1]!;
  const theirLastReadAt = one('seen') === '1' ? new Date(Date.parse(last.created_at) + 60_000).toISOString() : null;
  const dealEntry = dealEntryFor({ side, hasQuote: true });
  const expiryEventDate =
    one('expiry') === '1' ? new Date(Date.now() - 80 * 86_400_000).toISOString().slice(0, 10) : '2026-12-18';

  async function labSend(formData: FormData) {
    'use server';
    void formData;
    await new Promise((r) => setTimeout(r, 600));
    if (sendFails) throw new Error('lab: the send was refused');
  }

  return (
    <>
      <ThreadToolHashReveal />
      <div className="flex h-[calc(100dvh-12rem)] min-h-[27rem] gap-4">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <ChatBox
            header={
              <ChatThreadHead
                backHref="/dev/chat-lab"
                name={label}
                initials={initialsFor(label)}
                line={
                  <>
                    <span>Photo &amp; video</span>
                    <span>December 18, 2026</span>
                    <span className="whitespace-nowrap">~230 guests</span>
                  </>
                }
                actions={<ChatThreadMenu threadId={threadId} returnTo={`/dev/chat-lab/t/${threadId}`} blockedByMe={false} links={[]} />}
              />
            }
            notice={<ChatSafetyBanner inBox />}
            composer={
              <ChatSendForm
                threadId={threadId}
                sendAction={labSend}
                lead={
                  side === 'couple' ? (
                    <CoupleThreadToolsSheet dealReveal={dealEntry.composer.reveal} />
                  ) : (
                    <ThreadToolsSheet
                      eventId={LAB_EVENT}
                      state={{ hasAgreement: booked, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 }}
                    />
                  )
                }
                attachInputId={CHAT_ATTACH_INPUT_ID}
                userId={LAB_USER}
              />
            }
            tray={
              <div>
                <ThreadToolPanel id="deal-or-meeting" label="Deal or meeting" hint="Propose a schedule or a handshake">
                  <p className="px-1 py-2 text-sm text-ink/60">(lab) the shipped Deal or meeting panel opens here.</p>
                </ThreadToolPanel>
              </div>
            }
          >
            <ChatMessageStream
              flush
              dealEntry={dealEntry}
              threadId={threadId}
              initialMessages={LAB_MESSAGES.map((m) => ({ ...m, thread_id: threadId }))}
              currentUserId={LAB_USER}
              viewerRole={side}
              counterpartyLabel={label}
              theirLastReadAt={theirLastReadAt}
              senderNames={side === 'couple' ? { [LAB_STAFF]: 'Paolo' } : {}}
              lockHandshake={null}
              fileExpiry={{ eventDate: expiryEventDate, precision: 'day' }}
            />
          </ChatBox>
        </section>
      </div>
    </>
  );
}
