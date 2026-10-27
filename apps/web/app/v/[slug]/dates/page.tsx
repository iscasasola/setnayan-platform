/**
 * /v/[slug]/dates — "CHECK A DATE", the page a shop's "Check a date" QR opens (owner 2026-10-28, DECISION_LOG
 * "✅📅 CHECK A DATE — APPROVED; BUILD `/v/[slug]/dates`"; approved prototype `prototypes/check_a_date_2026-10-28/`).
 *
 * Owner, verbatim: *"it will only show dates not bookable and available dates. and will not show if there are current
 * inquiries on that day."* → *"index.html approve"*.
 *
 *   · PUBLIC — anyone who scans sees the month; no sign-in to look.
 *   · TWO STATES — Available · Not bookable (`lib/check-a-date.ts`); past days are not offered; no reason, no name.
 *   · AN AVAILABLE DAY → Ask about this date → the services (one or more) → the event (sign in HERE, the date and the
 *     services kept in the address) → ONE ask into that event's chat with the shop through the SHIPPED inquiry action
 *     (`startServiceInquiry`, `thread_service_interests` for the services) — with Undo.
 *   · A NOT-BOOKABLE DAY → Try another date.
 *
 * 🔒 The only facts this page reads about the shop are its own month's closures and capacity (`readCheckADate`).
 * Guard: `no-inquiry-reads.test.ts` beside this file.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { readCheckADate } from '@/lib/check-a-date.server';
import { CheckADateCalendar, type CheckDateEvent } from './_components/check-a-date-calendar';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ d?: string; s?: string; step?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const read = await readCheckADate(slug).catch(() => null);
  if (!read || read.kind !== 'ok') return { title: 'Check a date', robots: { index: false, follow: false } };
  return { title: `Check a date · ${read.shop.name}`, robots: { index: false, follow: true } };
}

export default async function CheckADatePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const read = await readCheckADate(slug);
  if (read.kind === 'missing') notFound();

  // Who is looking — only to offer their own events at the event step. A refused read is "signed out".
  let signedIn = false;
  let events: CheckDateEvent[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !user.is_anonymous) {
      signedIn = true;
      const [mine, types] = await Promise.all([fetchUserEvents(supabase, user.id, 'couple'), getCreatableEventTypes().catch(() => [])]);
      const typeLabel = new Map(types.map((t) => [t.key, t.label]));
      const today = read.kind === 'ok' ? read.today : '';
      events = mine
        .filter((e) => !e.archived && (!e.event_date || (e.event_end_date ?? e.event_date) >= today))
        .map((e) => ({
          eventId: e.event_id,
          name: e.display_name,
          typeLabel: typeLabel.get(e.event_type) ?? null,
          eventType: e.event_type,
          date: e.event_date,
          endDate: e.event_end_date ?? null,
        }));
    }
  } catch {
    signedIn = false;
    events = [];
  }

  const day = typeof search.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.d) ? search.d : null;
  const picked = typeof search.s === 'string' ? search.s.split(',').map((x) => x.trim()).filter(Boolean) : [];

  return (
    <main className="min-h-[100dvh] bg-cream text-ink" data-check-a-date="">
      {read.kind === 'unreadable' ? (
        <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10" data-check-date-unreadable="">
          <h1 className="text-[22px] font-semibold">Check a date</h1>
          <p role="alert" className="mt-2 text-[15px] text-ink/75">
            We couldn&rsquo;t load this shop&rsquo;s dates just now, so we won&rsquo;t guess which days are free. Please try again in a moment.
          </p>
          <a href={`/v/${encodeURIComponent(slug)}/dates`} className="sn-press mt-4 inline-flex min-h-11 items-center rounded-full border border-ink/15 px-5 text-[15px] font-semibold">
            Try again
          </a>
        </div>
      ) : (
        <CheckADateCalendar
          shop={read.shop}
          services={read.services}
          today={read.today}
          to={read.to}
          notBookable={read.notBookable}
          perService={read.perService}
          signedIn={signedIn}
          events={events}
          initialDay={day}
          initialServices={picked}
          initialStep={search.step === 'event' && day ? 'event' : null}
        />
      )}
    </main>
  );
}
