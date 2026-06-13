import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchReturningClientFlags,
  fetchVendorThreads,
  formatChatTimestamp,
} from '@/lib/chat';
import { ThreadListCard } from '@/app/_components/chat/thread-list-card';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

export const metadata = { title: 'Messages · Vendor' };

export default async function VendorMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const threads = await fetchVendorThreads(supabase, profile.vendor_profile_id);

  // Returning-client badge (owner-locked 2026-06-12): for PENDING inquiries
  // only, flag threads whose couple previously CONFIRMED-booked this vendor on
  // a different event. ONE batched RPC for all pending threads (no N+1);
  // graceful-degrades to an empty map pre-migration.
  const returningFlags = await fetchReturningClientFlags(
    supabase,
    profile.vendor_profile_id,
    threads.filter((t) => t.inquiry_status === 'pending').map((t) => t.event_id),
  );

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Conversations</h1>
        <p className="text-base text-ink/65">
          One thread per couple who&rsquo;s reached out. Couples appear as the event they
          identified themselves with — personal names stay private until they choose to share.
        </p>
      </header>

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <MessageSquare
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No conversations yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Couples start threads from their dashboard using your contact email. Make
            sure your{' '}
            <Link href="/vendor-dashboard" className="text-terracotta hover:underline">
              vendor profile
            </Link>{' '}
            is filled in and your contact email is right — that&rsquo;s the field
            couples search by.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => {
            const returning =
              t.inquiry_status === 'pending' ? returningFlags.get(t.event_id) : undefined;
            return (
            <li key={t.thread_id}>
              <ThreadListCard
                href={`/vendor-dashboard/messages/${t.thread_id}`}
                title={t.event?.display_name ?? 'Event'}
                badge={
                  t.inquiry_status === 'pending' ? (
                    <span className="mt-0.5 inline-block rounded-full bg-mulberry/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-mulberry">
                      New inquiry · accept to reply
                    </span>
                  ) : t.inquiry_status === 'declined' ? (
                    <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                      Declined
                    </span>
                  ) : null
                }
                extra={
                  returning ? (
                    <>
                      <span
                        className="ml-1 mt-0.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta"
                        title={
                          returning.resync_flat
                            ? 'A client you previously locked — accepting costs just 1 token'
                            : 'A client you previously locked'
                        }
                      >
                        Returning client
                      </span>
                      <p className="mt-0.5 truncate text-xs text-ink/65">
                        Booked you for{' '}
                        {returning.prior_event_display_name ?? 'a previous event'}
                        {returning.resync_flat
                          ? ' · accepting costs just 1 token'
                          : ''}
                      </p>
                    </>
                  ) : null
                }
                timestampLine={
                  <>
                    {t.event?.event_date
                      ? `${t.event.event_date} · `
                      : ''}
                    Last activity {formatChatTimestamp(t.updated_at)}
                  </>
                }
              />
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
