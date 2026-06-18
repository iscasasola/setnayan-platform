/**
 * /admin/demo-vendors/inquiries/[threadId]
 *
 * Admin reads a couple's inquiry to a DEMO vendor and replies AS that vendor.
 * Service-role read/write (no admin RLS on chat tables); demo-only guard.
 * Messages are rendered server-side (the realtime <ChatMessageStream> would
 * get nothing for an admin under RLS); each action triggers a route refresh.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchThreadById, fetchMessages, formatChatTimestamp } from '@/lib/chat';
import { adminAcceptInquiry, adminDeclineInquiry, adminReplyAsVendor } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Demo inquiry · Admin' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ threadId: string }> };

export default async function DemoInquiryThreadPage({ params }: Props) {
  const { threadId } = await params;
  const admin = createAdminClient();

  const thread = await fetchThreadById(admin, threadId);
  if (!thread) notFound();

  const { data: vendorRaw } = await admin
    .from('vendor_profiles')
    .select('business_name, is_demo')
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .maybeSingle();
  const vendor = vendorRaw as { business_name: string | null; is_demo: boolean } | null;
  // Demo-only surface — never expose / act on a real vendor's thread here.
  if (!vendor?.is_demo) notFound();

  const { data: eventRaw } = await admin
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', thread.event_id)
    .maybeSingle();
  const event = eventRaw as { display_name: string | null; event_date: string | null } | null;

  const messages = await fetchMessages(admin, threadId);
  const vendorName = vendor.business_name ?? 'Demo vendor';
  const coupleLabel = event?.display_name ?? 'Couple';

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1 rounded-xl border border-ink/10 bg-cream p-4">
        <Link
          href="/admin/demo-vendors/inquiries"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Demo inquiries
        </Link>
        <p className="text-base font-semibold text-ink">{coupleLabel}</p>
        {event?.event_date ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {event.event_date}
          </p>
        ) : null}
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry/10 px-2 py-1 text-[12px] text-mulberry-700">
          Replying as <strong>{vendorName}</strong> · demo vendor
        </p>
      </header>

      {/* Message stream (server-rendered; admin acts via service-role) */}
      <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/55">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isVendor = m.sender_role === 'vendor';
            return (
              <div
                key={m.message_id}
                className={`flex flex-col ${isVendor ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    isVendor
                      ? 'bg-mulberry text-cream'
                      : 'bg-ink/5 text-ink'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                </div>
                <span className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink/40">
                  {isVendor ? vendorName : coupleLabel} · {formatChatTimestamp(m.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Action zone — mirrors the real vendor thread flow */}
      {thread.inquiry_status === 'accepted' ? (
        <form
          action={adminReplyAsVendor}
          className="flex items-end gap-2 rounded-xl border border-ink/10 bg-cream p-3"
        >
          <input type="hidden" name="thread_id" value={threadId} />
          <textarea
            name="body"
            rows={2}
            required
            maxLength={4000}
            placeholder={`Reply as ${vendorName}…`}
            className="input-field min-h-[60px] flex-1 py-2"
          />
          <SubmitButton
            className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
            pendingLabel="Sending…"
          >
            Send
          </SubmitButton>
        </form>
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Accept to reply as{' '}
            {vendorName} (this reveals the vendor name to the couple), or decline.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={adminAcceptInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <SubmitButton
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
                pendingLabel="Accepting…"
              >
                Accept inquiry
              </SubmitButton>
            </form>
            <form action={adminDeclineInquiry} className="flex items-end gap-2">
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="text"
                name="reason"
                maxLength={500}
                placeholder="Decline reason (optional)"
                className="input-field h-11 w-56 py-2 text-sm"
              />
              <SubmitButton
                className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
                pendingLabel="Declining…"
              >
                Decline
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm text-ink/70">
            This inquiry was declined
            {thread.decline_reason ? ` — “${thread.decline_reason}”` : ''}.
          </p>
        </div>
      )}
    </section>
  );
}
