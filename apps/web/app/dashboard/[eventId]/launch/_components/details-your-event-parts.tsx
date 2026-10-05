import type { ReactNode } from 'react';
import { CalendarDays, Footprints, MapPin, UserRound, Users } from 'lucide-react';
import type { EventVenue } from '@/lib/event-venues';
import { VENUE_ROLE_LABEL } from '@/lib/event-venues';
import type { EventItemKey, DetailsItemModel } from '@/lib/maker-details-items';
import type { ScheduleMatrix } from '@/lib/schedule-matrix';
import {
  parentsOffered,
  yourEventDone,
  yourEventPresentKeys,
  yourEventLabel,
  yourEventUsedOn,
  type YourEventFacts,
  type YourEventKind,
} from '@/lib/details-your-event';
import type { VenueSlot } from './details-your-event';
import type { MarchSectionData } from './details-march';
import type { HostPiece, PersonPiece } from './details-people';
/* ⚡ Your event's editors and pictures load when Details is opened — never with the Maker (`details-lazy.tsx`). */
import {
  DateBody,
  DateEditor,
  MarchMaker,
  NamesEditor,
  NameStylePicker,
  OneNameEditor,
  ParentCards,
  PeopleBody,
  PeopleControls,
  PeoplePieces,
  VenuesEditor,
} from './details-lazy';
import { PrintPieceBody, type PrintsInput } from './maker-prints';
import { DEFAULT_NAME_STYLE, type NameStyle } from '@/lib/name-style';

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
 * THE THREE PARTS"): Parents & hosts list their pieces on the left
 * (`details-people.tsx`); the date finder puts the candidate days in the middle
 * and the picked day on the right (`details-date-finder.tsx`).
 *
 * 🚶 THE WEDDING MARCH IS ONE ITEM, NOT A LIST (owner 2026-10-06: *"i don't need
 * this to expand the names"*). It has no pieces in the navigator; its
 * page is the march maker (`details-march.tsx` — drag the names), and beside it
 * The Entourage card shows what prints.
 */
export type YourEventInput = {
  kind: YourEventKind;
  facts: YourEventFacts;
  /** The two people's words and stored names (null → the Names item is not shown). */
  names: {
    people: readonly [string, string];
    initial: readonly [{ first: string; last: string }, { first: string; last: string }];
    /** Where the BaZi section is live, the shipped whole form instead (see the editor's docblock). */
    wholeForm: ReactNode | null;
  } | null;
  /** A one-person event's name (`display_name`) — null / absent for a two-person event. */
  oneName?: { initial: string; hint: string } | null;
  /** 🔤 The event's Name style (`print_details.name_style`, owner 2026-09-30) — absent = Full. */
  nameStyle?: NameStyle;
  date: {
    confirmedVendorCount: number;
    dateDisplay: string | null;
    dateValue: string | null;
    label: string;
    matrix: Promise<ScheduleMatrix | null>;
    nudge: ReactNode;
    /** Open on "Help me choose" (`?date=help`). */
    helpFirst?: boolean;
    /** 🕒 The Ceremony block's start, HH:MM — as drafted, else live. */
    ceremonyTime?: string | null;
  };
  venues: { resolved: readonly EventVenue[]; slots: readonly VenueSlot[]; city: string | null };
  /** 🚶 The march as the maker draws it — its sections and walks, the couple's sides included (`marchSections`). */
  march: {
    sections: readonly MarchSectionData[];
    /** The dev Maker lab only (`/dev/maker-lab`): the drags are drawn, never sent. */
    lab?: boolean;
  };
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
  /* 🚶 Every walk the maker draws — the couple's and their parents' included. */
  const marchWalks = input.march.sections.reduce((n, sec) => n + sec.rows.length, 0);
  const keys = yourEventPresentKeys(kind, input.names !== null || input.oneName != null);
  const sub: Record<EventItemKey, string | undefined> = {
    names: input.oneName
      ? input.oneName.initial.trim() || 'Not set yet'
      : [facts.names[0], facts.names[1]].filter((n) => n.trim()).join(' · ') || 'Not set yet',
    date: input.date.dateDisplay ?? 'Not set yet',
    venues: input.venues.resolved.map((v) => v.name).filter(Boolean).join(' · ') || 'Not set yet',
    // 👪 What the invitation prints: its parents — never a collaborator account (see `hostPieces`).
    parents: parentsOffered(kind)
      ? parents.length
        ? `${parents.length} parent${parents.length === 1 ? '' : 's'}`
        : 'No parents yet'
      : `${hosts.length} host${hosts.length === 1 ? '' : 's'}`,
    march: marchWalks ? `${marchWalks} walk${marchWalks === 1 ? '' : 's'}` : 'Nobody walks yet',
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
  /* 👪 Where the invitation prints parents, THEY are its hosts (owner, live walk
     2026-10-05): a dashboard co-host / planner account — and its email — is
     never listed here. Only a type with no parents keeps its Kindly-reply host. */
  const hostPieces: HostPiece[] = offered ? [] : hosts.map((h) => ({ key: `h:${h.moderatorId}`, label: h.label, contact: h.contact }));

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
    /* 🚶 The page IS the maker (drag the names) — the body on a phone, the middle on a desk. */
    march: <MarchMaker eventId={eventId} sections={input.march.sections} lab={input.march.lab === true} />,
  };

  const editors: Partial<Record<EventItemKey, ReactNode>> = {
    /* ✍ Names · Date · Venues — the ONE builder (`yourEventFactEditors`), which
       Event Details' rows open too (owner 2026-10-04, rows edited in place). */
    ...yourEventFactEditors({ eventId, input }),
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
    /* What prints — The Entourage card, redrawn after each burst of moves. */
    march: <PrintPieceBody input={prints} piece="entourage" />,
  };

  /* 🧩 The tools' own pieces on the left (DECISION_LOG "A TOOL MOVED INTO THE
     MAKER IS REBUILT INTO THE THREE PARTS"). */
  const pieces: Partial<Record<EventItemKey, ReactNode>> = {
    parents: <PeoplePieces parents={people} hosts={hostPieces} parentsOffered={offered} />,
    // 🚶 No `march` here: the Wedding March never expands into its names (owner 2026-10-06).
  };
  return { keys, rows, bodies, editors, pieces };
}

/**
 * ✍ THE EDITORS OF NAMES · DATE · VENUES — built ONCE, here, for Details AND for
 * the Event Details page's rows (owner 2026-10-04, "YES TO ALL": rows are edited
 * in place with the SAME field the Maker opens; study § 2 "one editor, three
 * doors"). A row and the Maker can never hold two different forms for one fact.
 */
export function yourEventFactEditors({
  eventId,
  input,
}: {
  eventId: string;
  input: Pick<YourEventInput, 'names' | 'oneName' | 'nameStyle' | 'date' | 'venues'>;
}): { names: ReactNode; date: ReactNode; venues: ReactNode } {
  const namesEditor = input.oneName ? (
    <OneNameEditor eventId={eventId} initial={input.oneName.initial} />
  ) : input.names ? (
    input.names.wholeForm ?? (
      <NamesEditor eventId={eventId} people={input.names.people} initial={input.names.initial} />
    )
  ) : null;
  return {
    /* 🔤 Name style ▾ sits under the Names, in place (owner 2026-09-30). */
    names: namesEditor ? (
      <div className="flex flex-col gap-3">
        {namesEditor}
        <NameStylePicker eventId={eventId} saved={input.nameStyle ?? DEFAULT_NAME_STYLE} />
      </div>
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
        ceremonyTime={input.date.ceremonyTime ?? null}
      />
    ),
    venues: venuesEditorFor(eventId, input),
  };
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

/**
 * 🏛 Details › Venues' editor — ONE node, drawn in Details AND when a venue card
 * is tapped on a stage (`STAGE_FACT_TAPS` → `venues`), so the two can never be
 * two different forms (owner 2026-09-30: "so click on it").
 */
export function venuesEditorFor(eventId: string, input: Pick<YourEventInput, 'venues'>): ReactNode {
  return (
    <VenuesEditor eventId={eventId} slots={input.venues.slots} city={input.venues.city} />
  );
}
