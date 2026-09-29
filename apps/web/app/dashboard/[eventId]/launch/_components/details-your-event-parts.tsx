import type { ReactNode } from 'react';
import { CalendarDays, Footprints, MapPin, UserRound, Users } from 'lucide-react';
import type { EventVenue } from '@/lib/event-venues';
import { VENUE_ROLE_LABEL } from '@/lib/event-venues';
import type { EventItemKey, DetailsItemModel } from '@/lib/maker-details-items';
import type { ScheduleMatrix } from '@/lib/schedule-matrix';
import {
  parentsOffered,
  yourEventDone,
  yourEventItems,
  yourEventLabel,
  yourEventUsedOn,
  type YourEventFacts,
  type YourEventKind,
} from '@/lib/details-your-event';
import { DateBody, DateEditor, NamesEditor, OneNameEditor, VenuesEditor, type VenueSlot } from './details-your-event';
import { MarchAisleFocus, MarchControls, MarchPieces, type MarchSectionData } from './details-march';
import { PeopleBody, PeopleControls, PeoplePieces, type HostPiece, type PersonPiece } from './details-people';
import { ParentCards } from './parent-cards';
import { PrintPieceBody, type PrintsInput } from './maker-prints';

/**
 * DETAILS › YOUR EVENT — the items' pictures and editors, composed for
 * `maker-details.tsx` (Details part 2a). Its only job is to hand back, per item,
 * the navigator row, the body and the editor; `maker-details.tsx` adds them to
 * its maps the way part 1 said items are added (`DETAILS_ITEM_GROUPS`, one
 * label, one body, one editor).
 *
 * Which items an event shows, and every word they carry, come from the event
 * type (`lib/details-your-event.ts`) — nothing here names a wedding.
 *
 * 🧩 THE THREE PARTS (DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO
 * THE THREE PARTS"): the march and Parents & hosts list their pieces on the
 * left (`details-march.tsx`, `details-people.tsx`); the date finder puts the
 * candidate days in the middle and the picked day on the right
 * (`details-date-finder.tsx`). The march's moves are the Guest list's own
 * actions; its sections open the Guest list's own panel, one section showing.
 */
export type YourEventInput = {
  kind: YourEventKind;
  facts: YourEventFacts;
  /** The two people's words and stored names (null → the Names item is not shown). */
  names: {
    people: readonly [string, string];
    initial: readonly [{ first: string; last: string }, { first: string; last: string }];
    keep: { region: string; feel: string };
    /** Where the BaZi section is live, the shipped whole form instead (see the editor's docblock). */
    wholeForm: ReactNode | null;
  } | null;
  /** A one-person event's name (`display_name`) — null for a two-person event. */
  oneName: { initial: string; hint: string } | null;
  date: {
    confirmedVendorCount: number;
    dateDisplay: string | null;
    dateValue: string | null;
    label: string;
    matrix: Promise<ScheduleMatrix | null>;
    nudge: ReactNode;
    /** Open on "Help me choose" (`?date=help`). */
    helpFirst?: boolean;
  };
  venues: { resolved: readonly EventVenue[]; slots: readonly VenueSlot[]; city: string | null; launchDate: string | null };
  /** The walking order, as the invitation prints it — its sections and lines, each line's moves already asked of the rule. */
  march: { sections: readonly MarchSectionData[]; panel: ReactNode };
};

type NavRow = Omit<DetailsItemModel, 'key' | 'group'> & { icon: ReactNode };

const ICON: Record<EventItemKey, ReactNode> = {
  names: <UserRound aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  date: <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  venues: <MapPin aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  parents: <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  march: <Footprints aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

export function yourEventParts({
  eventId,
  input,
  prints,
  parents,
  hosts,
}: {
  eventId: string;
  input: YourEventInput;
  prints: PrintsInput;
  parents: Array<{ guestId: string | null; name: string; card: ReactNode }>;
  hosts: Array<{ moderatorId: string; label: string; contact: string | null }>;
}): {
  keys: EventItemKey[];
  rows: Partial<Record<EventItemKey, NavRow>>;
  bodies: Partial<Record<EventItemKey, ReactNode>>;
  editors: Partial<Record<EventItemKey, ReactNode>>;
  pieces: Partial<Record<EventItemKey, ReactNode>>;
} {
  const { kind, facts } = input;
  const keys = yourEventItems(kind).filter((k) => k !== 'names' || input.names !== null || input.oneName !== null);
  const sub: Record<EventItemKey, string | undefined> = {
    names: input.oneName
      ? input.oneName.initial.trim() || 'Not set yet'
      : [facts.names[0], facts.names[1]].filter((n) => n.trim()).join(' · ') || 'Not set yet',
    date: input.date.dateDisplay ?? 'Not set yet',
    venues: input.venues.resolved.map((v) => v.name).filter(Boolean).join(' · ') || 'Not set yet',
    parents: [
      parentsOffered(kind) ? `${parents.length} parent${parents.length === 1 ? '' : 's'}` : null,
      `${hosts.length} host${hosts.length === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(' · '),
    march: facts.marchLines ? `${facts.marchLines} line${facts.marchLines === 1 ? '' : 's'} · walking order` : 'Nobody walks yet',
  };
  const rows: Partial<Record<EventItemKey, NavRow>> = {};
  for (const k of keys) {
    rows[k] = { label: yourEventLabel(k, kind), sub: sub[k], done: yourEventDone(k, facts), usedOn: yourEventUsedOn(k, kind), icon: ICON[k] };
  }

  /* 👪 Parents & hosts — the people as pieces (`details-people.tsx`). */
  const offered = parentsOffered(kind);
  const people: PersonPiece[] = offered ? parents.map((p, i) => ({ key: `p:${p.guestId ?? i}`, name: p.name })) : [];
  const cards: Record<string, ReactNode> = {};
  if (offered) parents.forEach((p, i) => (cards[`p:${p.guestId ?? i}`] = p.card));
  const hostPieces: HostPiece[] = hosts.map((h) => ({ key: `h:${h.moderatorId}`, label: h.label, contact: h.contact }));

  const invitation = <PrintPieceBody input={prints} piece="invitation" />;
  const bodies: Partial<Record<EventItemKey, ReactNode>> = {
    names: (
      <div className="flex flex-wrap justify-center gap-6">
        {invitation}
        <PrintPieceBody input={prints} piece="pass" />
      </div>
    ),
    date: <DateBody matrix={input.date.matrix} picture={invitation} helpFirst={input.date.helpFirst} />,
    venues: (
      <div className="flex flex-col items-center gap-4">
        <VenuesSeen venues={input.venues.resolved} single={!kind.words.twoPeople} />
        {invitation}
      </div>
    ),
    parents: (
      <PeopleBody
        parents={people}
        hosts={hostPieces}
        parentsOffered={offered}
        invitation={invitation}
        finer={<PrintPieceBody input={prints} piece="details" />}
      />
    ),
    march: (
      <div className="flex flex-wrap items-start justify-center gap-6">
        <MarchAisleFocus sections={input.march.sections} />
        <PrintPieceBody input={prints} piece="entourage" />
      </div>
    ),
  };

  const editors: Partial<Record<EventItemKey, ReactNode>> = {
    names: input.oneName ? (
      <OneNameEditor eventId={eventId} initial={input.oneName.initial} hint={input.oneName.hint} />
    ) : input.names ? (
      input.names.wholeForm ?? (
        <NamesEditor eventId={eventId} people={input.names.people} initial={input.names.initial} keep={input.names.keep} />
      )
    ) : null,
    date: (
      <DateEditor
        eventId={eventId}
        governed={{
          confirmedVendorCount: input.date.confirmedVendorCount,
          dateDisplay: input.date.dateDisplay,
          dateValue: input.date.dateValue,
          label: input.date.label,
        }}
        matrix={input.date.matrix}
        nudge={input.date.nudge}
        helpFirst={input.date.helpFirst}
      />
    ),
    venues: <VenuesEditor eventId={eventId} slots={input.venues.slots} city={input.venues.city} launchDate={input.venues.launchDate} />,
    parents: (
      <PeopleControls
        parents={people}
        hosts={hostPieces}
        parentsOffered={offered}
        cards={cards}
        /* The SAME parents K built under The Invitation — the list and its add. */
        add={<ParentCards eventId={eventId} parents={parents} />}
      />
    ),
    march:
      facts.marchLines === 0 ? (
        <p className="text-sm text-ink/65">
          Nobody walks yet. Give a guest a role on their guest card — a sponsor, a bearer, the honour attendants —
          and they appear here in walking order.
        </p>
      ) : (
        <MarchControls eventId={eventId} sections={input.march.sections} sectionPanel={input.march.panel} />
      ),
  };

  /* 🧩 The tools' own pieces on the left (DECISION_LOG "A TOOL MOVED INTO THE
     MAKER IS REBUILT INTO THE THREE PARTS"). */
  const pieces: Partial<Record<EventItemKey, ReactNode>> = {
    parents: <PeoplePieces parents={people} hosts={hostPieces} parentsOffered={offered} />,
    ...(facts.marchLines > 0 ? { march: <MarchPieces sections={input.march.sections} /> } : {}),
  };
  return { keys, rows, bodies, editors, pieces };
}

/** The venues as the Event Hub resolves them — what a guest reads. */
function VenuesSeen({ venues, single }: { venues: readonly EventVenue[]; single: boolean }) {
  if (venues.length === 0) {
    return <p className="text-sm text-ink/65">No venue yet — name the place in the editor.</p>;
  }
  return (
    <ul className="flex w-full max-w-md flex-col gap-2" data-details-venues-seen="">
      {venues.map((v) => (
        <li key={v.role} className="rounded-md bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(40,34,24,.06)]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">{single ? 'Venue' : VENUE_ROLE_LABEL[v.role]}</p>
          <p className="font-serif text-lg text-ink">{v.name ?? '—'}</p>
          {v.address ? <p className="text-xs text-ink/65">{v.address}</p> : null}
        </li>
      ))}
    </ul>
  );
}
