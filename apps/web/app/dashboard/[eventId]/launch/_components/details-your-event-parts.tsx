import type { ReactNode } from 'react';
import { CalendarDays, Footprints, MapPin, UserRound, Users } from 'lucide-react';
import type { EntourageGroup } from '@/lib/entourage';
import { roleLabel } from '@/lib/entourage';
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
import { DateEditor, NamesEditor, VenuesEditor, type VenueSlot } from './details-your-event';
import { ParentCards } from './parent-cards';
import { PrintPieceBody, type PrintsInput } from './maker-prints';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';

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
 * 🚶 THE MARCH is the SHIPPED Guest list panel, moved in whole: the order list
 * on the right is `EntourageOrderPanel` itself (its island, its actions — +0
 * writers), handed in by the page; the body draws the aisle from the SAME
 * `buildEntourage` groups the invitation and The Entourage card print.
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
  date: {
    confirmedVendorCount: number;
    dateDisplay: string | null;
    dateValue: string | null;
    label: string;
    matrix: Promise<ScheduleMatrix | null>;
    nudge: ReactNode;
  };
  venues: { resolved: readonly EventVenue[]; slots: readonly VenueSlot[]; city: string | null; launchDate: string | null };
  /** The walking order, as the invitation prints it. */
  march: { groups: readonly EntourageGroup[]; panel: ReactNode };
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
}): { keys: EventItemKey[]; rows: Partial<Record<EventItemKey, NavRow>>; bodies: Partial<Record<EventItemKey, ReactNode>>; editors: Partial<Record<EventItemKey, ReactNode>> } {
  const { kind, facts } = input;
  const keys = yourEventItems(kind).filter((k) => k !== 'names' || input.names !== null);
  const sub: Record<EventItemKey, string | undefined> = {
    names: [facts.names[0], facts.names[1]].filter((n) => n.trim()).join(' · ') || 'Not set yet',
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

  const invitation = <PrintPieceBody input={prints} piece="invitation" />;
  const bodies: Partial<Record<EventItemKey, ReactNode>> = {
    names: (
      <div className="flex flex-wrap justify-center gap-6">
        {invitation}
        <PrintPieceBody input={prints} piece="pass" />
      </div>
    ),
    date: invitation,
    venues: (
      <div className="flex flex-col items-center gap-4">
        <VenuesSeen venues={input.venues.resolved} single={!kind.words.twoPeople} />
        {invitation}
      </div>
    ),
    parents: invitation,
    march: (
      <div className="flex flex-wrap items-start justify-center gap-6">
        <MarchAisle groups={input.march.groups} />
        <PrintPieceBody input={prints} piece="entourage" />
      </div>
    ),
  };

  const editors: Partial<Record<EventItemKey, ReactNode>> = {
    names: input.names ? (
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
      />
    ),
    venues: <VenuesEditor eventId={eventId} slots={input.venues.slots} city={input.venues.city} launchDate={input.venues.launchDate} />,
    parents: (
      <section data-details-parents="" className="flex flex-col gap-3">
        {parentsOffered(kind) ? (
          <>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">Parents</p>
            {/* The SAME parents K built under The Invitation — each opens their own guest card. */}
            <ParentCards eventId={eventId} parents={parents} />
          </>
        ) : null}
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">Hosts</p>
        <HostsList hosts={hosts} />
      </section>
    ),
    march: (
      <section data-details-march="" className="flex flex-col gap-2">
        {/* The order saves as it moves (the Guest list's own island) — and says so. */}
        {input.march.panel ? <HubSavesImmediately /> : null}
        {input.march.panel}
        {facts.marchLines === 0 ? (
          <p className="text-sm text-ink/65">
            Nobody walks yet. Give a guest a role on their guest card — a sponsor, a bearer, the honour attendants —
            and they appear here in walking order.
          </p>
        ) : null}
      </section>
    ),
  };
  return { keys, rows, bodies, editors };
}

/** Who guests reply to — read from each host's own account (it is edited there, by them). */
function HostsList({ hosts }: { hosts: Array<{ moderatorId: string; label: string; contact: string | null }> }) {
  if (hosts.length === 0) return <p className="text-sm text-ink/65">No hosts yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5" data-details-hosts="">
      {hosts.map((h) => (
        <li key={h.moderatorId} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-ink/10 bg-white px-3 text-sm">
          <span className="truncate text-ink">{h.label}</span>
          <span className="shrink-0 text-xs text-ink/60">{h.contact ?? 'No number on their account'}</span>
        </li>
      ))}
    </ul>
  );
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
 * THE AISLE, IN WALKING ORDER — every line, numbered, top to bottom: the order
 * the couple sets on the right, the order the invitation and The Entourage
 * card print. A pair is one step.
 */
export function MarchAisle({ groups }: { groups: readonly EntourageGroup[] }) {
  const lines = groups.flatMap((g) => g.rows.map((row, i) => ({ group: g, row, first: i === 0 })));
  if (lines.length === 0) return null;
  return (
    <figure className="m-0 w-full max-w-sm" data-march-aisle="">
      <ol className="relative flex flex-col gap-1.5 border-x-2 border-dashed border-gild/50 px-3 py-2">
        {lines.map(({ group, row, first }, i) => (
          <li key={`${group.key}-${i}`} className="flex flex-col">
            {first ? <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">{group.label}</p> : null}
            <p className="flex items-baseline gap-2 rounded-md bg-white/80 px-2.5 py-1.5 text-sm">
              <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ink/45">{i + 1}</span>
              <span className="min-w-0 flex-1 text-ink">
                {row
                  .filter((p): p is NonNullable<typeof p> => p !== null)
                  .map((p) => `${p.name}${roleLabel(p.role) ? ` · ${roleLabel(p.role)}` : ''}`)
                  .join('  &  ')}
              </span>
            </p>
          </li>
        ))}
      </ol>
      <figcaption className="mt-1.5 text-center text-xs text-ink/55">The aisle, in walking order</figcaption>
    </figure>
  );
}
