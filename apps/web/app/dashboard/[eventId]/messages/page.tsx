import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchCoupleThreads, formatChatTimestamp } from '@/lib/chat';
import { startThreadByVendorEmail } from './actions';

export const metadata = { title: 'Messages' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CoupleMessagesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const threads = await fetchCoupleThreads(supabase, eventId);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Messages</h1>
        <p className="max-w-prose text-base text-ink/65">
          One thread per vendor you&rsquo;re working with. Vendors find you via the email on
          your invitation site or by starting their own thread.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}

      <section className="rounded-xl border border-ink/10 bg-cream p-5">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Start a new thread
        </h2>
        <form
          action={startThreadByVendorEmail}
          className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input
            name="vendor_email"
            type="email"
            required
            placeholder="vendor's contact email"
            className="input-field flex-1"
          />
          <button
            type="submit"
            className="button-primary inline-flex items-center justify-center gap-2"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Start thread
          </button>
        </form>
        <p className="mt-2 text-xs text-ink/55">
          The vendor must already have a Setnayan vendor account with this email on their
          profile. New thread or resume an existing one — Setnayan keeps one per pair.
        </p>
      </section>

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <MessageSquare
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm text-ink/55">
            No conversations yet. Start one with the form above.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.thread_id}>
              <Link
                href={`/dashboard/${eventId}/messages/${t.thread_id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar logoUrl={t.vendor?.logo_url ?? null} name={t.vendor?.business_name ?? '?'} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {t.vendor?.business_name ?? 'Vendor'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      Last activity {formatChatTimestamp(t.updated_at)}
                    </p>
                  </div>
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

function Avatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  if (logoUrl) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}
