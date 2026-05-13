import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchVendorThreads, formatChatTimestamp } from '@/lib/chat';
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
          {threads.map((t) => (
            <li key={t.thread_id}>
              <Link
                href={`/vendor-dashboard/messages/${t.thread_id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {t.event?.display_name ?? 'Event'}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    {t.event?.event_date
                      ? `${t.event.event_date} · `
                      : ''}
                    Last activity {formatChatTimestamp(t.updated_at)}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
