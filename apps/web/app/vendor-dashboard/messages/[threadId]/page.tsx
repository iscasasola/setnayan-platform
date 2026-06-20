import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchMessages, fetchReturningClientFlags, fetchThreadById } from '@/lib/chat';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sendChatMessage, acceptInquiry, declineInquiry, markThreadRead } from '@/lib/chat-actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { fetchThreadInterests } from '@/lib/thread-interests';
import { fetchVendorServices } from '@/lib/vendor-services';
import { isCanonicalService, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { resolveLivePax, fetchVendorPaxProposals } from '@/lib/pax';
import { fetchPendingVendorPayments } from '@/lib/vendor-service-payment-schedules.server';
import { acceptPaxSurcharge, declinePaxSurcharge } from './pax-actions';
import { confirmVendorPayment } from './pay-confirm-actions';
import {
  VendorOfferService,
  type VendorOfferOption,
} from './_components/vendor-offer-service';
import { SubmitButton } from '@/app/_components/submit-button';

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

  // Inverse cross-sell (owner-locked 2026-06-12) — the vendor can offer one of
  // their OWN active services that isn't already on the thread's interest list.
  // Resolve the gap = (active services) − (services already recorded as
  // interests). Best-effort + graceful-degrade (pre-migration → empty options).
  const [existingInterests, ownServices] = await Promise.all([
    fetchThreadInterests(supabase, threadId),
    fetchVendorServices(supabase, profile.vendor_profile_id),
  ]);
  const alreadyOnThread = new Set(
    existingInterests
      .map((r) => r.vendor_service_id)
      .filter((v): v is string => v !== null),
  );
  const offerOptions: VendorOfferOption[] = ownServices
    .filter((s) => s.is_active && !alreadyOnThread.has(s.vendor_service_id))
    .map((s) => ({
      vendorServiceId: s.vendor_service_id,
      label:
        s.title?.trim() ||
        (isCanonicalService(s.category)
          ? VENDOR_CATEGORY_LABEL[s.category as VendorCategory]
          : s.category),
    }));

  // Returning-client flag (owner-locked 2026-06-12) — only relevant while the
  // inquiry is pending (the accept decision). Graceful-degrades pre-migration.
  const returning =
    thread.inquiry_status === 'pending'
      ? (
          await fetchReturningClientFlags(supabase, profile.vendor_profile_id, [
            thread.event_id,
          ])
        ).get(thread.event_id)
      : undefined;

  // Adaptive Pax Pricing Phase 5 — recompute the live pax FRESH on view (the
  // vendor's RLS can't read the couple's guests, so use the admin client, gated
  // by the thread-ownership check above) + any pending surcharge to confirm.
  const paxAdmin = createAdminClient();
  const livePax = await resolveLivePax(paxAdmin, thread.event_id);
  const headerPax = livePax ?? thread.pax_current;
  const paxProposals = await fetchVendorPaxProposals(paxAdmin, {
    eventId: thread.event_id,
    vendorProfileId: profile.vendor_profile_id,
    livePax,
    paxAtInquiry: thread.pax_at_inquiry,
  });

  // Phase 2 PR-C — couple-logged payments on this vendor's bookings awaiting
  // confirmation. event_vendor_payments is couple-RLS'd, so this admin-reads
  // them AFTER the thread-ownership gate above (profile owns this thread). Each
  // becomes an Accept card. Best-effort: a failure degrades to no cards.
  let pendingPayments: Awaited<ReturnType<typeof fetchPendingVendorPayments>> = [];
  try {
    pendingPayments = await fetchPendingVendorPayments({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    });
  } catch (e) {
    console.error('[vendor-thread] fetchPendingVendorPayments threw', e);
    pendingPayments = [];
  }

  const peso = (n: number) =>
    `₱${Math.abs(Math.round(n)).toLocaleString('en-PH')}`;

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
          {/* Live pax — recomputed fresh on view (Phase 5); the count the couple
              is planning for, and the count at first inquiry once it grows. */}
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

      {/* Pending surcharge confirms (Adaptive Pax Pricing Phase 5) — the count
          moved a booked service's cost; nothing changes until the vendor taps
          Accept. Symmetric: a drop shows a credit. Owner-locked confirm flow. */}
      {paxProposals.map((p) => {
        const up = p.delta > 0;
        return (
          <div
            key={p.eventVendorId}
            className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4"
          >
            <p className="text-sm font-semibold text-ink">
              Guest count changed — {p.label}
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Now planning for <span className="font-semibold">{p.livePax}</span> guests
              (you quoted ~{p.quoteBasePax}). At {peso(p.ratePhp)}/guest, your total
              would {up ? 'increase' : 'decrease'} by{' '}
              <span className="font-semibold text-terracotta-700">
                {up ? '+' : '−'}{peso(p.delta)}
              </span>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <form action={acceptPaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Applying…"
                  className="inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                >
                  {up ? `Apply +${peso(p.delta)}` : `Apply −${peso(p.delta)}`}
                </SubmitButton>
              </form>
              <form action={declinePaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Holding…"
                  className="inline-flex h-9 items-center rounded-lg border border-ink/15 bg-cream px-4 text-sm text-ink/70 hover:border-ink/40"
                >
                  Hold price
                </SubmitButton>
              </form>
            </div>
          </div>
        );
      })}

      {/* Pending payment confirms (Phase 2 PR-C) — the couple logged an
          off-platform payment (with optional proof) against this booking.
          Nothing on the couple's side is "received" until the vendor taps
          Confirm — the DB guard (confirm_vendor_payment) re-checks ownership. */}
      {pendingPayments.map((p) => (
        <div
          key={p.paymentId}
          className="rounded-xl border border-success-700/30 bg-success-50/60 p-4"
        >
          <p className="text-sm font-semibold text-ink">
            The couple logged a {peso(p.amountPhp)} payment
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {p.installmentLabel ? `For ${p.installmentLabel} · ` : ''}
            Paid {p.paidAt}
            {p.method ? ` · ${p.method}` : ''}
            {p.reference ? ` · ref ${p.reference}` : ''}.
            {p.notes ? ` “${p.notes}”` : ''}
          </p>
          {p.proofUrl ? (
            <p className="mt-1.5 text-sm">
              <a
                href={p.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-mulberry underline hover:text-mulberry-600"
              >
                View attached receipt
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-ink/55">
            Setnayan never holds this money — confirm only what you actually
            received.
          </p>
          <div className="mt-3">
            <form action={confirmVendorPayment}>
              <input type="hidden" name="payment_id" value={p.paymentId} />
              <input type="hidden" name="thread_id" value={threadId} />
              <SubmitButton
                pendingLabel="Confirming…"
                className="inline-flex h-9 items-center rounded-lg bg-success-700 px-4 text-sm font-medium text-cream hover:bg-success-800"
              >
                Confirm received
              </SubmitButton>
            </form>
          </div>
        </div>
      ))}

      <ChatPrivacyNotice />

      <ThreadInterestChips supabase={supabase} threadId={threadId} />

      {thread.inquiry_status === 'accepted' ? (
        <VendorOfferService threadId={threadId} options={offerOptions} />
      ) : null}

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
          {returning ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                Returning client
              </span>
              Booked you for{' '}
              {returning.prior_event_display_name ?? 'a previous event'}
              {returning.resync_flat ? ' — accepting costs just 1 token.' : '.'}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={acceptInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Accepting…"
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                Accept inquiry
              </SubmitButton>
            </form>
            <form action={declineInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Declining…"
                className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
              >
                Decline
              </SubmitButton>
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
