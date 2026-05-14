import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sendChatMessage } from '@/lib/chat-actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';

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

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="vendor"
        counterpartyLabel={coupleLabel}
      />

      <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
    </section>
  );
}
