/**
 * 🧾 AGREED NOW — the top of Details (Supplier Build 3 · lane B; prototype v8.3 `Details` › "Agreed now").
 *
 * Owner: the chat is the record; Details holds the AGREED RESULT, each row's "Changed N×" opening who changed it and
 * when. Won / lost is automatic here — never a (+) row. One batched read (four requests in parallel, RLS-scoped as
 * the reader), then `lib/agreed-now.ts` turns them into rows and `ChangedRow` draws each one.
 *
 * Every read that fails says so ("Couldn't load"), never a quiet empty: a refused quote read must not read as
 * "No quote sent yet" (the honest-reads rule, `reads-are-honest.test.ts`).
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readBookingChanges } from '@/lib/booking-changes.server';
import { hostFirstName } from '@/lib/host-first-name.server';
import { QUOTE_VERSION_SELECT, orderQuoteVersions, type QuoteVersionRow } from '@/lib/quote-versions';
import { resolveAppointmentLabel } from '@/lib/appointments';
import { agreedOutcome, agreedRows } from '@/lib/agreed-now';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { ChangedRow } from './changed-row';

export async function AgreedNow({
  eventId,
  vendorProfileId,
  viewerUserId,
  threadId,
  isBooked,
  quoteBy = 'You',
}: {
  eventId: string;
  vendorProfileId: string;
  viewerUserId: string;
  threadId: string | null;
  isBooked: boolean;
  quoteBy?: string;
}) {
  const supabase = await createClient();
  const [ev, quotes, changes, appts] = await Promise.all([
    supabase.from('events').select('event_date, estimated_pax, final_pax').eq('event_id', eventId).maybeSingle(),
    supabase.from('vendor_proposals').select(QUOTE_VERSION_SELECT).eq('event_id', eventId).eq('vendor_profile_id', vendorProfileId),
    readBookingChanges(supabase, { eventId, vendorProfileId }),
    threadId
      ? supabase
          .from('event_appointments')
          .select('appointment_id, type, custom_label, scheduled_at, status')
          .eq('event_id', eventId)
          .eq('thread_id', threadId)
          .order('scheduled_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ev.error) logQueryError('AgreedNow.event', ev.error, { event_id: eventId }, 'graceful_degrade');
  if (quotes.error) logQueryError('AgreedNow.quotes', quotes.error, { event_id: eventId }, 'graceful_degrade');
  if (appts.error) logQueryError('AgreedNow.meetings', appts.error, { event_id: eventId }, 'graceful_degrade');

  const failed = Boolean(ev.error || !ev.data || quotes.error || appts.error);
  if (failed) {
    return (
      <section data-agreed-now="" data-read="failed" className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/55">Agreed now</h2>
        <p className="mt-1 text-[15px] text-ink/75">Couldn&rsquo;t load what is agreed. Pull to refresh, or open it again in a moment.</p>
      </section>
    );
  }

  // Names for "Changed by" — only the few people who changed something, first names only (`hostFirstName`).
  const ids = [...new Set((changes ?? []).map((c) => c.changedBy).filter((x): x is string => !!x && x !== viewerUserId))];
  const names = new Map<string, string>();
  await Promise.all(
    ids.slice(0, 8).map(async (id) => {
      const n = await hostFirstName(eventId, id);
      if (n) names.set(id, n);
    }),
  );

  const event = ev.data as { event_date: string | null; estimated_pax: number | null; final_pax: number | null };
  const versions = orderQuoteVersions((quotes.data ?? []) as unknown as QuoteVersionRow[]);
  const outcome = agreedOutcome({ isBooked, declined: false }, versions);
  const rows = agreedRows({
    viewerUserId,
    quotes: versions,
    event: { eventDate: event.event_date, estimatedPax: event.estimated_pax, finalPax: event.final_pax },
    changes,
    meetings: ((appts.data ?? []) as { appointment_id: string; type: string; custom_label: string | null; scheduled_at: string | null; status: string }[])
      .filter((a) => a.scheduled_at)
      .map((a) => ({
        appointmentId: a.appointment_id,
        title: resolveAppointmentLabel(a, {}),
        scheduledAt: a.scheduled_at as string,
        status: a.status,
      })),
    names,
    booking: { isBooked, declined: false },
    quoteBy,
  });
  const WonIcon = TOPIC_ICON.details;

  return (
    <section data-agreed-now="" data-outcome={outcome.kind}>
      <p
        className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold ${
          outcome.kind === 'won' ? 'bg-success-50 text-success-800' : outcome.kind === 'lost' ? 'bg-ink/[0.05] text-ink/60' : 'bg-ink/[0.03] text-ink/70'
        }`}
        data-agreed-outcome={outcome.kind}
      >
        <WonIcon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        {outcome.line}
      </p>
      <h2 className="mt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/55">Agreed now</h2>
      <ul className="mt-1">
        {rows.map((r) => (
          <ChangedRow key={r.key} row={r} loaded={r.key === 'quote' || changes !== null} />
        ))}
      </ul>
    </section>
  );
}
