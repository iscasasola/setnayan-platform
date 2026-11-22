/**
 * /dev/unichat-f-lab — Unichat part F on fixture data, for the §4 shots beside the drawing
 * (`unichat_live_v3_2026-11-20.html`). No sign-in, no database; names are the drawing's samples — nobody real.
 * DEV-ONLY: production builds 404 this route.
 *
 *   ?m=time     the time-change card both ways: the moment's name is the title, ⏱, "· 18 Dec · 30 min"; the supplier's
 *               ask (hosts: Decline · Approve; supplier: waiting, Take back inside ⓘ), the host's ask (supplier: Decline
 *               · Accept; hosts: waiting), Liza the coordinator answering the supplier's ask in the hosts' chat, every
 *               settled line (a No with its reason in ⓘ), and `&f=1` the request the dummy database refuses —
 *               "Couldn't load", never a blank card. Decline asks for a reason before it sends.
 *   ?m=agenda   the supplier's Schedule risen from the chat: Done fold, the weeks, the event day's window bar and
 *               "Set by …", your part of the day as the timeline. `&e=1` nothing dated · `&u=1` a refused read, said.
 *   ?m=whole    the hosts' Schedule risen from their chat with Lumina: the same list, then "The whole day" — every
 *               moment, Lumina's askable (a press opens the ask). `&u=1` the day could not be read, said.
 */
import { notFound } from 'next/navigation';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { ScheduleTimeAskCard } from '@/app/_components/chat/cards/schedule-time-ask-card';
import { clientAgenda, dayMonthWords } from '@/lib/client-agenda';
import { clientScheduleDays, unreadDaysLine } from '@/lib/schedule-days';
import { buildSupplierDay, type SupplierBlockRow } from '@/lib/supplier-schedule';
import type { TimeAskLine } from '@/lib/schedule-time-ask';
import { AgendaLabOpen } from './agenda-lab-open';
import { WholeDayLabOpen } from './whole-day-lab-open';
import { WHOLE_DAY_UNREAD } from '@/lib/hosts-whole-day';

const THREAD = '00000000-0000-4000-8000-00000000f00f';
const EVENT = '00000000-0000-4000-8000-00000000e00e';
const AT = '2026-11-20T03:00:00.000Z';
const T = (hhmm: string) => `2026-12-18T${hhmm}:00.000Z`;

export default async function UnichatFLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'time';

  if (m === 'whole') {
    // The hosts' side: the whole day — Lumina's moments and everybody else's (the drawing's S.day).
    const unread = sp.u === '1';
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
    const day = buildSupplierDay({
      blocks: [
        B({ block_id: 'cs', label: 'Setup', start_at: T('12:00'), end_at: T('15:00'), location: 'Fernwood Gardens', responsible_vendor_ids: ['lumina', 'venue'] }),
        B({ block_id: 'w1', parent_block_id: 'cs', label: 'Ingress & setup', start_at: T('12:00'), end_at: T('13:30'), responsible_vendor_ids: ['lumina'] }),
        B({ block_id: 'w2', parent_block_id: 'cs', label: 'Sound check', start_at: T('14:30'), end_at: T('15:00'), responsible_vendor_ids: ['lumina'] }),
        B({ block_id: 'cc', label: 'Ceremony', start_at: T('16:00'), end_at: T('17:00'), location: 'Fernwood Gardens', responsible_vendor_ids: ['venue'] }),
        B({ block_id: 'w3', parent_block_id: 'cc', label: 'Processional', start_at: T('16:00'), end_at: T('16:15'), responsible_vendor_ids: ['florist'] }),
        B({ block_id: 'cr', label: 'Reception', start_at: T('16:00'), end_at: T('21:30'), location: 'Fernwood Gardens', ingress_minutes_before: 240, egress_minutes_after: 90, hours_vendor_id: 'venue', responsible_vendor_ids: ['lumina', 'venue'] }),
        B({ block_id: 'w4', parent_block_id: 'cr', label: 'Grand entrance', start_at: T('18:00'), end_at: T('18:15'), responsible_vendor_ids: ['host'] }),
        B({ block_id: 'w5', parent_block_id: 'cr', label: 'First dance', start_at: T('19:00'), end_at: T('19:10'), responsible_vendor_ids: ['lumina'] }),
        B({ block_id: 'w6', parent_block_id: 'cr', label: 'Load out', start_at: T('23:15'), end_at: T('23:45'), responsible_vendor_ids: ['lumina'] }),
      ],
      myBookingIds: ['lumina'],
      tasks: [],
      requests: [],
      venueBookingIds: [],
      venueNames: [{ vendor_id: 'venue', vendor_name: 'Fernwood Gardens' }],
    });
    const days = clientScheduleDays({
      eventDate: '2026-12-18',
      chapters: [],
      meetings: [
        { appointment_id: 'a1', label: 'Ocular', scheduled_at: '2026-11-20T07:00:00Z', status: 'proposed' },
        { appointment_id: 'a0', label: 'Call with Lumina', scheduled_at: '2026-11-12T07:00:00Z', status: 'done' },
      ],
      payments: [
        { label: 'First payment', due_date: '2026-11-15', state: 'paid' },
        { label: 'Second payment', due_date: '2026-12-10', state: 'due' },
      ],
    });
    return (
      <main className="min-h-screen bg-page p-4" data-lab="unichat-f-whole">
        <WholeDayLabOpen
          whole={{
            eventId: EVENT,
            shopName: 'Lumina',
            agenda: clientAgenda({ todayIso: '2026-11-20', eventDate: '2026-12-18', days, quote: null }),
            eventDate: '2026-12-18',
            eventDayWords: dayMonthWords('2026-12-18'),
            unreadLine: unread ? WHOLE_DAY_UNREAD : null,
            day: unread ? null : day,
            shopBookingIds: ['lumina'],
            asks: [
              {
                suggestion_id: 'ask-1',
                block_id: 'w2',
                vendor_profile_id: 'lumina-shop',
                suggested_by_name: 'Liza',
                asked_as: 'coordinator',
                proposed_start_at: T('14:00'),
                proposed_end_at: T('14:30'),
                note: 'The band needs the stage first.',
                status: 'open',
                answer_note: null,
                created_at: AT,
                shop: { business_name: 'Lumina' },
              },
            ],
          }}
        />
      </main>
    );
  }

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
  // The drawing's facts behind each card: the day, the minutes, the asker's note, and a No's reason.
  const seed = (status: string) =>
    failed
      ? undefined
      : {
          eventId: EVENT,
          suggestionId: `s-${status}`,
          status,
          day: '18 Dec',
          minutes: 30,
          note: 'The band needs the stage first.',
          reason: status === 'declined' ? 'The venue opens the hall at 12:00 PM.' : null,
        };
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
        {failed ? null : (
          // 🤝 The coordinator answers too: Liza edits the day, so she reads the hosts' chat and its Decline · Approve.
          <section className="grid gap-1" aria-label="Liza, the coordinator" data-lab-coordinator="">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/50">As Liza, the coordinator · the hosts’ chat</p>
            {card(supplierAsk, 'couple', 'open', 'coordinator-move-open')}
          </section>
        )}
      </div>
    </main>
  );
}
