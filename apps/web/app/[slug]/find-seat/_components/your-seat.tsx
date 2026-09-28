import Link from 'next/link';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { formatCount } from '@/lib/format-number';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';
import { DoorPass, type DoorPassData } from './door-pass';
import { Lace, RoomPlaceholder } from './seat-frame';
import { SeatBackLink } from './seat-back-link';

/**
 * Section A of the prototype — a guest the page already KNOWS (their account is
 * linked to this event, or they opened their personal key). 🔑 THERE IS NO
 * FIELD ON THIS SCREEN, in any state: typing exists only on the open link.
 *
 *   A1 · before the day — the table is the biggest thing on the screen, the
 *        room with it lit, one button (Show at the door), then who else is at
 *        the table (own table only, first name + last initial);
 *   A2 · on the day — the same, tightened to ONE 390×844 screen: the button
 *        moves up under the table where a thumb reaches it;
 *   A4 · not seated yet — the honest "you're on the list", the room faint, no
 *        button (there is nothing to do). Safe here, and ONLY here: the key
 *        proves who is asking (the open link says one merged sentence instead).
 *   C  · 1200 px — the seat and the people left, the room right.
 */
export type Tablemate = { name: string; you: boolean };

export type YourSeatProps = {
  firstName: string;
  names: string;
  /** "Reception · 18 December 2026", or null. */
  occasionLine: string | null;
  /** True inside the event's live window (A2). */
  dayOf: boolean;
  /** "Today · doors open 5:00 pm" on the day, when the schedule has a first block. */
  doorsOpenLabel: string | null;
  published: boolean;
  tables: EventTableRow[];
  entrance: EntrancePos;
  /** The guest's own table, or null (A4). */
  table: { table_id: string; table_label: string; capacity: number | null } | null;
  mates: Tablemate[];
  seatsOpen: number;
  /** The 3D room, when this event has one — a quiet link, never a button. */
  venueHref: string | null;
  /** "Back to the invitation" — `findSeatBackHref`, never a bare `/${slug}`. */
  inviteHref: string;
  /** The event's address — lets the back link recognise the Maker's canvas. */
  slug: string;
  /** Two people at the centre (a wedding): "once Indalecio & Claire seat you". */
  plural: boolean;
  pass: DoorPassData | null;
};

export function YourSeat(props: YourSeatProps) {
  if (!props.table || !props.published) return <NotSeatedYet {...props} />;
  return props.dayOf ? <OnTheDay {...props} table={props.table} /> : <BeforeTheDay {...props} table={props.table} />;
}

type Seated = YourSeatProps & { table: NonNullable<YourSeatProps['table']> };

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[0.72rem] uppercase tracking-[0.22em] text-terracotta-700">{children}</p>;
}

function ScriptWord({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`m-0 mt-1 font-serif text-[2.4rem] italic leading-none text-terracotta-700 ${className}`}>{children}</p>;
}

function WalkIn3D({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <Link href={href} className="text-terracotta-700 underline underline-offset-[3px]">
      Walk the room in 3D
    </Link>
  );
}

function BeforeTheDay(p: Seated) {
  const seated = p.mates.length;
  return (
    <div className="lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-x-14 lg:pt-8">
      <section className="px-6 pt-3 text-center lg:order-1 lg:px-0 lg:text-left">
        <Eyebrow>✦ &nbsp;Your seat</Eyebrow>
        <ScriptWord>you&rsquo;re at</ScriptWord>
        <h1 className="m-0 font-serif text-[4.875rem] font-medium leading-[1.02] tracking-[-0.01em] text-ink">
          {p.table.table_label}
        </h1>
        {p.occasionLine ? (
          <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink/75">
            <span className="text-ink">{p.names}</span> · {p.occasionLine}
          </p>
        ) : null}
      </section>
      <Lace className="my-4 lg:order-2 lg:ml-0" />
      <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <div className="mx-6 lg:mx-0">
          <WayfindingMap look="theme" tables={p.tables} entrance={p.entrance} targetTableId={p.table.table_id} />
        </div>
        <p className="mx-[26px] mt-3 flex items-start gap-2.5 text-[0.84rem] leading-normal text-ink/75 lg:mx-0">
          <DoorGlyph />
          <span>
            Walk in from the entrance and follow the dotted path. <WalkIn3D href={p.venueHref} />
          </span>
        </p>
      </div>
      {p.pass ? (
        <div className="mx-6 mt-[18px] lg:order-4 lg:mx-0">
          <DoorPass pass={p.pass} />
        </div>
      ) : null}
      {seated > 0 ? (
        <section className="mx-6 mt-4 lg:order-3 lg:mx-0" aria-label="At your table">
          <Eyebrow>
            At your table · {formatCount(seated)}
            {p.table.capacity ? ` of ${formatCount(p.table.capacity)}` : ''}
          </Eyebrow>
          <ul className="m-0 mt-1.5 grid list-none grid-cols-2 gap-x-4 p-0">
            {p.mates.map((m, i) => (
              <li key={`${m.name}-${i}`} className="flex items-baseline justify-between gap-1.5 border-b border-ink/25 py-2 text-[0.94rem]">
                {m.name}
                {m.you ? <b className="text-[0.625rem] font-normal uppercase tracking-[0.16em] text-terracotta-700">you</b> : null}
              </li>
            ))}
            {p.seatsOpen > 0 ? (
              <li className="border-b border-ink/25 py-2 text-[0.84rem] italic text-ink/70">
                {formatCount(p.seatsOpen)} {p.seatsOpen === 1 ? 'seat' : 'seats'} still open
              </li>
            ) : null}
          </ul>
          <p className="mt-2.5 flex items-start gap-2 text-[0.78rem] leading-normal text-ink/75">
            <LockGlyph />
            Only the people at {p.table.table_label} see these names. Other guests never see who sits where.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function OnTheDay(p: Seated) {
  const others = p.mates.filter((m) => !m.you).map((m) => m.name);
  return (
    <div className="lg:mx-auto lg:max-w-md">
      <section className="px-6 pt-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-[var(--hub-radius,0.375rem)] bg-ink px-3 py-2 text-[0.6875rem] uppercase tracking-[0.16em] text-cream">
          <ClockGlyph />
          {p.doorsOpenLabel ?? 'Today'}
        </span>
        <ScriptWord className="mt-3">welcome, {p.firstName}</ScriptWord>
        <h1 className="m-0 font-serif text-[4.875rem] font-medium leading-[1.02] tracking-[-0.01em] text-ink">
          {p.table.table_label}
        </h1>
      </section>
      {p.pass ? (
        <div className="mx-6 mt-3.5">
          <DoorPass pass={p.pass} big />
        </div>
      ) : null}
      <Lace className="mb-3 mt-3.5" />
      <div className="mx-6">
        <WayfindingMap look="theme" tables={p.tables} entrance={p.entrance} targetTableId={p.table.table_id} />
      </div>
      {others.length > 0 || p.venueHref ? (
        <p className="mx-[26px] mt-2.5 flex items-start gap-2.5 text-[0.84rem] leading-normal text-ink/75">
          <PersonGlyph />
          <span>
            {others.length > 0 ? <>At your table: {others.join(', ')}</> : null}
            {others.length > 0 && p.venueHref ? <> &nbsp;·&nbsp; </> : null}
            <WalkIn3D href={p.venueHref} />
          </span>
        </p>
      ) : null}
    </div>
  );
}

function NotSeatedYet(p: YourSeatProps) {
  return (
    <div className="lg:mx-auto lg:max-w-md">
      <section className="px-6 pt-3 text-center">
        <Eyebrow>✦ &nbsp;Your seat</Eyebrow>
        <ScriptWord>not set yet</ScriptWord>
        <h1 className="m-0 mt-0.5 font-serif text-[2rem] font-medium leading-[1.12] text-ink">
          You&rsquo;re on the list, {p.firstName}.
        </h1>
        <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink/75">
          {p.plural ? `Your table will show here once ${p.names} seat you.` : 'Your table will show here once you’re seated.'}{' '}
          No need to check back — this updates by itself.
        </p>
      </section>
      <Lace className="my-4" />
      {p.published && p.tables.length > 0 ? (
        <div className="relative mx-6">
          <WayfindingMap look="theme" faint tables={p.tables} entrance={p.entrance} targetTableId={null} />
          <span className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--hub-radius,0.375rem)] border border-ink/25 bg-cream/95 px-4 py-2.5 text-[0.8125rem] italic text-ink/75">
            Your table will appear here
          </span>
        </div>
      ) : (
        <RoomPlaceholder veil="Your table will appear here" />
      )}
      <SeatBackLink href={p.inviteHref} slug={p.slug} className="mx-6 mt-3.5 block text-center text-sm text-terracotta-700 underline underline-offset-[3px]">
        Back to the invitation
      </SeatBackLink>
    </div>
  );
}

function DoorGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-terracotta-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V5a1 1 0 0 1 1-1h9v16" />
      <path d="M15 4l4 2v14l-4-2" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-terracotta-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-[15px] w-[15px] shrink-0 text-terracotta-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10" width="14" height="10" rx="1.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function ClockGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
