/**
 * /dev/their-event-lab — "Their event" for a booked supplier, drawn from the REAL components and the REAL row builder
 * (`theirEventRows`) on a fixture (no database), for the 375 / 1280 screenshots of PR "their event door" (owner
 * 2026-11-21; drawing `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`).
 *
 *   ?part=lists   the caterer's and the florist's lists (frames "Caterer · their links" · "Florist · their links")
 *   ?part=guests  "Tap Guests · one group only" — the part alone under its Their event line
 *   ?part=numbers Numbers — headcount, the booking group's count and its drift from the booked count
 *   (none)        everything
 */
import { notFound } from 'next/navigation';
import { theirEventRows } from '@/lib/their-event';
import { TheirEventList } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-list';
import { TheirEventLine } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-line';
import { GuestsPart, NumbersPart } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-parts';

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="8">C&amp;I</text></svg>')}`;
const GROUP = {
  status: 'ok' as const,
  label: 'Special meals',
  booked: 12,
  counted: null,
  guests: [
    { name: 'Ana Reyes', rsvp: 'attending', diet: 'Table 4 · no pork' },
    { name: 'Carla Lim', rsvp: null, diet: 'Table 7 · vegetarian' },
    { name: 'Marco Go', rsvp: 'attending', diet: 'Table 2 · nut allergy' },
  ],
};
const PAX = { invited: 186, attending: 68, maybe: 12, pending: 106, declined: 0 };

export default async function TheirEventLab({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { part } = await searchParams;
  const show = (p: string) => !part || part === p;
  const caterer = theirEventRows({ eventId: 'lab-claire', category: 'catering', grants: {}, logoHref: LOGO, tables: 19, group: { label: GROUP.label, count: GROUP.guests.length } });
  const florist = theirEventRows({ eventId: 'lab-claire', category: 'florist', grants: {}, logoHref: LOGO, tables: 19, group: null });
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-6" data-their-event-lab="">
      {show('lists') ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Caterer</p>
            <TheirEventList eventId="lab-claire" rows={caterer} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Florist</p>
            <TheirEventList eventId="lab-claire" rows={florist} />
          </div>
        </div>
      ) : null}
      {show('guests') ? (
        <div className="sn-tile overflow-hidden">
          <TheirEventLine eventId="lab-claire" eventName="Claire & Indalecio" />
          <GuestsPart group={GROUP} />
        </div>
      ) : null}
      {show('numbers') ? (
        <div className="sn-tile overflow-hidden">
          <TheirEventLine eventId="lab-claire" eventName="Claire & Indalecio" />
          <NumbersPart pax={PAX} group={{ ...GROUP, guests: [...GROUP.guests, ...GROUP.guests, ...GROUP.guests, ...GROUP.guests, GROUP.guests[0]!, GROUP.guests[1]!] }} />
        </div>
      ) : null}
    </main>
  );
}
