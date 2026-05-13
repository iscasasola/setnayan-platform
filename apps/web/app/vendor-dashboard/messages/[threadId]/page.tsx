import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchMessages, fetchThreadById, formatChatTimestamp } from '@/lib/chat';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sendChatMessage } from '@/lib/chat-actions';

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

  const messages = await fetchMessages(supabase, threadId);
  const returnTo = `/vendor-dashboard/messages/${threadId}`;

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
          <p className="truncate text-base font-semibold text-ink">
            {event?.display_name ?? 'Event'}
          </p>
          {event?.event_date ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {event.event_date}
            </p>
          ) : null}
        </div>
      </header>

      <ol className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-4">
        {messages.length === 0 ? (
          <li className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
            No messages yet — say hi to introduce yourself.
          </li>
        ) : (
          messages.map((m) => (
            <li
              key={m.message_id}
              className={`flex ${m.sender_role === 'vendor' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_role === 'vendor'
                    ? 'bg-terracotta text-cream'
                    : 'bg-ink/[0.06] text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    m.sender_role === 'vendor' ? 'text-cream/70' : 'text-ink/50'
                  }`}
                >
                  {m.sender_role === 'vendor'
                    ? 'You'
                    : event?.display_name ?? 'Couple'}
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
        <button
          type="submit"
          aria-label="Send"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-terracotta text-cream hover:bg-terracotta-600"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </section>
  );
}
