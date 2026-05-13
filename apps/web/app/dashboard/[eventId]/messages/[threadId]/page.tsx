import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchMessages, fetchThreadById, formatChatTimestamp } from '@/lib/chat';
import { sendChatMessage } from '@/lib/chat-actions';

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

  const messages = await fetchMessages(supabase, threadId);
  const returnTo = `/dashboard/${eventId}/messages/${threadId}`;

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
          <p className="truncate text-base font-semibold text-ink">
            {vendor?.business_name ?? 'Vendor'}
          </p>
          {vendor?.tagline ? (
            <p className="truncate text-xs text-ink/60">{vendor.tagline}</p>
          ) : null}
        </div>
      </header>

      <ol className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-4">
        {messages.length === 0 ? (
          <li className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
            No messages yet — say hi to break the ice.
          </li>
        ) : (
          messages.map((m) => (
            <li
              key={m.message_id}
              className={`flex ${m.sender_role === 'couple' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_role === 'couple'
                    ? 'bg-terracotta text-cream'
                    : 'bg-ink/[0.06] text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    m.sender_role === 'couple' ? 'text-cream/70' : 'text-ink/50'
                  }`}
                >
                  {m.sender_role === 'couple' ? 'You' : vendor?.business_name ?? 'Vendor'}
                  {' · '}
                  {formatChatTimestamp(m.created_at)}
                </p>
              </div>
            </li>
          ))
        )}
      </ol>

      <form action={sendChatMessage} className="flex items-end gap-2">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <textarea
          name="body"
          rows={2}
          required
          maxLength={4000}
          placeholder="Type a message…"
          className="input-field min-h-[60px] flex-1 py-2"
        />
        <SubmitButton
          aria-label="Send"
          pendingLabel=""
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-terracotta text-cream hover:bg-terracotta-600 disabled:opacity-70"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </SubmitButton>
      </form>
    </section>
  );
}
