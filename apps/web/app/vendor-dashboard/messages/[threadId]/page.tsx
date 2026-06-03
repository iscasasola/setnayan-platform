import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sendChatMessage, acceptInquiry, declineInquiry, markThreadRead } from '@/lib/chat-actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';

export const metadata = { title: 'Thread · Vendor' };

type Props = { params: Promise<{ threadId: string }> };

export default async function VendorThreadPage({ params }: Props) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) notFound();

  // Mark read for the vendor viewer (parity with the couple side). No-op +
  // logged if migration 20260728000000_chat_thread_reads.sql isn't pushed yet.
  await markThreadRead(threadId);

  // Identity-masking source of truth: never expose the couple's email or
  // personal name; show only the event's display_name + date.
  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', thread.event_id)
    .maybeSingle();

  // Server-rendered first batch (SSR + SEO). Realtime takes over from here.
  const initialMessages = await fetchMessages(supabase, threadId);
  const coupleLabel = event?.display_name ?? 'Couple';

  return (
    <section className="mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        <div className="min-w-0 space-y-0.5">
          <Link
            href="/vendor-dashboard/messages"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
          >
            ‹ Messages
          </Link>
          <p className="truncate text-base font-semibold text-ink">{coupleLabel}</p>
          {event?.event_date ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {event.event_date}
            </p>
          ) : null}
        </div>
      </header>

      <ChatPrivacyNotice />

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="vendor"
        counterpartyLabel={coupleLabel}
      />

      {thread.inquiry_status === 'accepted' ? (
        <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Accept to open the
            chat and reply, or decline if you&rsquo;re not available for this date.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={acceptInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                Accept inquiry
              </button>
            </form>
            <form action={declineInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
              >
                Decline
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm text-ink/70">
            You declined this inquiry. The couple has been notified and pointed to
            other vendors.
          </p>
        </div>
      )}
    </section>
  );
}
