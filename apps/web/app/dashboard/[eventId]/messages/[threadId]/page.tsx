import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { sendChatMessage, markThreadRead } from '@/lib/chat-actions';
import { withdrawInquiry } from '@/app/dashboard/[eventId]/messages/actions';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { canonicalServiceToPlanGroupId } from '@/lib/wedding-plan-groups';
import { resolveLivePax } from '@/lib/pax';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { SubmitButton } from '@/app/_components/submit-button';

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

  // Fresh live pax (Phase 5) — the couple's own client can read their guests,
  // so show the current count, matching what the vendor now sees.
  const livePax = await resolveLivePax(supabase, thread.event_id);
  const headerPax = livePax ?? thread.pax_current;

  // One-follow-up gate (inquiry-followthrough 2026-06-16). While pending, only
  // the couple can post (the vendor is accept-gated), so the couple-authored
  // count == total messages here. Allow the composer for the inquiry itself
  // (0 messages) and exactly ONE follow-up nudge (1 message); past that the
  // form re-disables until the vendor accepts. Mirrors the server gate in
  // sendChatMessage so the UI and the no-JS form path agree.
  const coupleMsgCount = initialMessages.filter(
    (m) => m.sender_role === 'couple',
  ).length;
  const canFollowUpWhilePending = coupleMsgCount <= 1;

  // Decline reason (already on the thread row) — surfaced verbatim in the
  // declined-state copy when the vendor left one. Anonymity is preserved: the
  // resolved label is the vendor's screen_name pre-reveal, never a name leak.
  const declineReason = thread.decline_reason?.trim() || null;

  // "See similar vendors" hand-off (inquiry-followthrough 2026-06-16): deep-link
  // to the matching plan group on the Services surface so the couple lands in
  // the right category, not a generic list. The accordion already opens the
  // folder + leaf for a `#group-<id>` hash (plan-budget-accordion useEffect).
  // Fail-soft: unknown / unmappable canonical service → plain link, never a
  // broken anchor.
  const primaryCanonicalService = vendor?.services?.[0] ?? null;
  const similarGroupId = primaryCanonicalService
    ? canonicalServiceToPlanGroupId(primaryCanonicalService)
    : null;
  const similarVendorsHref = `/dashboard/${eventId}/vendors${
    similarGroupId ? `#group-${similarGroupId}` : ''
  }`;

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
          {/* The pax this vendor is quoting against (Adaptive Pax Pricing) —
              fresh on view (Phase 5); so the couple sees what the vendor sees. */}
          {headerPax ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
              Planning for ~{headerPax} guests
              {thread.pax_at_inquiry && thread.pax_at_inquiry < headerPax
                ? ` · was ${thread.pax_at_inquiry} at inquiry`
                : ''}
            </p>
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
      (thread.inquiry_status === 'pending' && canFollowUpWhilePending) ? (
        <div className="space-y-2">
          {thread.inquiry_status === 'pending' && coupleMsgCount > 0 ? (
            <p className="text-xs text-ink/55">
              You can send one follow-up while you wait for {vendorLabel} to
              accept.
            </p>
          ) : null}
          <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
        </div>
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">Follow-up sent.</span> Waiting for{' '}
            {vendorLabel} to accept before your chat opens. We&rsquo;ll notify you
            the moment they reply.
          </p>
          <form action={withdrawInquiry}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <SubmitButton pendingLabel="Withdrawing…" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline">Withdraw inquiry</SubmitButton>
          </form>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm text-ink">
            {declineReason ? (
              <>
                {vendorLabel} declined this inquiry.{' '}
                <span className="font-semibold">Why:</span> &ldquo;{declineReason}
                &rdquo; Browse similar vendors to keep your options open.
              </>
            ) : (
              <>
                {vendorLabel} isn&rsquo;t available for your date. Browse similar
                vendors to keep your options open.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={similarVendorsHref}
              className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              See similar vendors
            </Link>
            <form action={withdrawInquiry}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="thread_id" value={threadId} />
              <SubmitButton pendingLabel="Withdrawing…" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline">
                Withdraw inquiry
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
