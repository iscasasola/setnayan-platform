import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { sendChatMessage } from '@/lib/chat-actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';

export const metadata = { title: 'Thread' };

type Props = { params: Promise<{ eventId: string; threadId: string }> };

export default async function CoupleThreadPage({ params }: Props) {
  const { eventId, threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.event_id !== eventId) notFound();

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('business_name, logo_url, contact_email, tagline')
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .maybeSingle();

  // Server-render the first batch so the page is useful on first paint and
  // remains SEO-friendly. The <ChatMessageStream> client component takes
  // over from here, subscribing to Supabase Realtime for new inserts/updates.
  const initialMessages = await fetchMessages(supabase, threadId);
  const vendorLabel = vendor?.business_name ?? 'Vendor';

  return (
    <section className="flex h-[calc(100dvh-12rem)] flex-col gap-4">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/dashboard/${eventId}/messages`}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
          >
            ‹ Messages
          </Link>
          <p className="truncate text-base font-semibold text-ink">{vendorLabel}</p>
          {vendor?.tagline ? (
            <p className="truncate text-xs text-ink/60">{vendor.tagline}</p>
          ) : null}
        </div>
      </header>

      <ChatPrivacyNotice />

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="couple"
        counterpartyLabel={vendorLabel}
      />

      <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
    </section>
  );
}
