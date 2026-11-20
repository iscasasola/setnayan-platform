/**
 * /dev/unichat-f-lab — Unichat part F on fixture data, for the §4 shots beside the drawing
 * (`unichat_live_v3_2026-11-20.html`). No sign-in, no database; names are the drawing's samples — nobody real.
 * DEV-ONLY: production builds 404 this route.
 *
 *   ?m=time     the time-change card both ways: the supplier's ask (hosts: Decline · Approve; supplier: waiting ·
 *               Take back), the host's ask (supplier: Decline · Accept; hosts: waiting), every settled line, and
 *               `&f=1` the request the dummy database refuses — "Couldn't load", never a blank card.
 *   ?m=agenda   the Schedule risen from the chat: Done fold, the weeks, the event day's window bar and "Set by …",
 *               your part of the day. `&e=1` nothing dated · `&u=1` a refused read, said.
 */
import { notFound } from 'next/navigation';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { ScheduleTimeAskCard } from '@/app/_components/chat/cards/schedule-time-ask-card';
import { clientAgenda, dayMonthWords } from '@/lib/client-agenda';
import { clientScheduleDays, unreadDaysLine } from '@/lib/schedule-days';
import { buildSupplierDay, type SupplierBlockRow } from '@/lib/supplier-schedule';
import type { TimeAskLine } from '@/lib/schedule-time-ask';
import { AgendaLabOpen } from './agenda-lab-open';

const THREAD = '00000000-0000-4000-8000-00000000f00f';
const EVENT = '00000000-0000-4000-8000-00000000e00e';
const AT = '2026-11-20T03:00:00.000Z';
const T = (hhmm: string) => `2026-12-18T${hhmm}:00.000Z`;

export default async function UnichatFLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'time';

  if (m === 'agenda') {
    const empty = sp.e === '1';
    const unread = sp.u === '1';
    // Fernwood Gardens: setup from 12:00 PM · event 4:00–9:30 PM · out by 11:00 PM (the drawing's VEN).
    const B = (over: Partial<SupplierBlockRow> & Pick<SupplierBlockRow, 'block_id' | 'label'>): SupplierBlockRow => ({
      parent_block_id: null,
      start_at: null,
      end_at: null,
      location: null,
      spot: null,
      time_tba: false,
      is_optional: false,
      responsible_vendor_ids: [],
      created_at: AT,
      updated_at: AT,
      ...over,
    });
    const blocks: SupplierBlockRow[] = [
      B({ block_id: 'ch', label: 'Reception', start_at: T('16:00'), end_at: T('21:30'), location: 'Fernwood Gardens', ingress_minutes_before: 240, egress_minutes_after: 420, hours_vendor_id: 'venue', responsible_vendor_ids: ['me', 'venue'] }),
      B({ block_id: 'm1', parent_block_id: 'ch', label: 'Lights setup', start_at: T('12:00'), end_at: T('14:00'), responsible_vendor_ids: ['me'] }),
      B({ block_id: 'm2', parent_block_id: 'ch', label: 'Sound check', start_at: T('14:30'), end_at: T('15:00'), responsible_vendor_ids: ['me'] }),
      B({ block_id: 'm3', parent_block_id: 'ch', label: 'First dance', start_at: T('19:00'), responsible_vendor_ids: ['me'] }),
      B({ block_id: 'm4', parent_block_id: 'ch', label: 'Load out', start_at: T('23:15'), responsible_vendor_ids: ['me'] }),
    ];
    const day = buildSupplierDay({
      blocks,
      myBookingIds: ['me'],
      tasks: [],
      requests: [],
      venueNames: [{ vendor_id: 'venue', vendor_name: 'Fernwood Gardens' }],
    });
    const days = empty
      ? []
      : clientScheduleDays({
          eventDate: '2026-12-18',
          chapters: [],
          meetings: [
            { appointment_id: 'a1', label: 'Ocular', scheduled_at: '2026-11-20T07:00:00Z', status: 'proposed' },
            { appointment_id: 'a0', label: 'Call with the hosts', scheduled_at: '2026-11-12T07:00:00Z', status: 'done' },
          ],
          payments: [
            { label: 'First payment', due_date: '2026-11-15', state: 'paid' },
            { label: '₱31,000', due_date: '2026-12-10', state: 'due' },
          ],
        });
    return (
      <main className="min-h-screen bg-page p-4" data-lab="unichat-f-agenda">
        <AgendaLabOpen
          eventId={EVENT}
          eventDate="2026-12-18"
          eventDayWords={dayMonthWords('2026-12-18')}
          unreadLine={unread ? unreadDaysLine(['meetings']) : null}
          agenda={clientAgenda({ todayIso: '2026-11-20', eventDate: '2026-12-18', days, quote: empty ? null : { version: 2, validUntil: '2026-11-26' } })}
          day={day}
          autoAgree={false}
          tasksRead
          lab
        />
      </main>
    );
  }

  // ?m=time — the time-change card, both ways.
  const failed = sp.f === '1';
  const supplierAsk: TimeAskLine = { by: 'supplier', add: false, label: 'Sound check', from: '2:30 PM', to: '3:00 PM' };
  const supplierAdd: TimeAskLine = { by: 'supplier', add: true, label: 'Haze test', from: null, to: '3:30 PM' };
  const hostAsk: TimeAskLine = { by: 'host', add: false, label: 'Lights setup', from: '12:00 PM', to: '1:00 PM' };
  const seed = (status: string) => (failed ? undefined : { eventId: EVENT, suggestionId: `s-${status}`, status });
  const card = (line: TimeAskLine, viewer: 'vendor' | 'couple', status: string, key: string) => (
    <div key={key} data-lab-time={key}>
      <ScheduleTimeAskCard threadId={THREAD} createdAt={AT} line={line} viewer={viewer} supplierName="Lumina Lights & Sound" seed={seed(status)} />
    </div>
  );
  return (
    <main className="min-h-screen bg-page p-4" data-lab="unichat-f-time">
      <div className="mx-auto grid max-w-[560px] gap-6">
        {(['couple', 'vendor'] as const).map((v) => (
          <section key={v} className="grid gap-1" aria-label={v === 'couple' ? 'The hosts’ chat' : 'The supplier’s chat'}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/50">{v === 'couple' ? 'The hosts’ chat' : 'The supplier’s chat'}</p>
            {card(supplierAsk, v, 'open', `${v}-move-open`)}
            {card(supplierAdd, v, 'open', `${v}-add-open`)}
            {card(hostAsk, v, 'open', `${v}-host-open`)}
            {failed ? null : (
              <>
                {card(supplierAsk, v, 'accepted', `${v}-move-accepted`)}
                {card(hostAsk, v, 'declined', `${v}-host-declined`)}
                {card(supplierAdd, v, 'withdrawn', `${v}-add-withdrawn`)}
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
