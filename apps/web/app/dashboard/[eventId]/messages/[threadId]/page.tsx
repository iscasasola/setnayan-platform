import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { sendChatMessage, markThreadRead } from '@/lib/chat-actions';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';

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

  // Mark this thread read for the couple viewer so the Messages-icon unread
  // badge clears (migration 20260728000000_chat_thread_reads.sql). No-op +
  // logged if the read-marker table isn't pushed yet — opening the thread is
  // never blocked by this.
  await markThreadRead(threadId);

  // Anonymity surface per CLAUDE.md 2026-05-30 row — pull screen_name +
  // name_revealed_at + services + location_city so the header label and
  // the <ChatMessageStream> counterpartyLabel render through the canonical
  // `resolveVendorDisplayName` helper. Free/Verified vendors pre-first-reply
  // surface as their Bark screen_name; Pro/Enterprise + revealed + venue
  // vendors surface as business_name. Single resolver call drives both
  // surfaces so the header pill and the in-thread sender attribution stay
  // in lock-step.
  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select(
      'business_name, logo_url, contact_email, tagline, screen_name, name_revealed_at, services, location_city, tier_state',
    )
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .maybeSingle();

  // Server-render the first batch so the page is useful on first paint and
  // remains SEO-friendly. The <ChatMessageStream> client component takes
  // over from here, subscribing to Supabase Realtime for new inserts/updates.
  const initialMessages = await fetchMessages(supabase, threadId);
  const vendorLabel = vendor
    ? resolveVendorDisplayName({
        business_name: vendor.business_name ?? null,
        name_revealed_at: vendor.name_revealed_at ?? null,
        services: vendor.services ?? null,
        screen_name: vendor.screen_name ?? null,
        // Phase C: Pro/Enterprise reveal real business_name day-1.
        isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
        primary_canonical_service: vendor.services?.[0] ?? null,
        location_city: vendor.location_city ?? null,
      })
    : 'Vendor';

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

      <ThreadInterestChips supabase={supabase} threadId={threadId} />

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="couple"
        counterpartyLabel={vendorLabel}
      />

      {thread.inquiry_status === 'accepted' ||
      (thread.inquiry_status === 'pending' && initialMessages.length === 0) ? (
        <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
      ) : thread.inquiry_status === 'pending' ? (
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">Inquiry sent.</span> Waiting for{' '}
            {vendorLabel} to accept before your chat opens. We&rsquo;ll notify you
            the moment they reply.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm text-ink">
            {vendorLabel} isn&rsquo;t available for your date. Browse similar
            vendors to keep your options open.
          </p>
          <Link
            href={`/dashboard/${eventId}/vendors`}
            className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            See similar vendors
          </Link>
        </div>
      )}
    </section>
  );
}
