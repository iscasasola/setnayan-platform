'use client';

import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  Armchair,
  BedDouble,
  CalendarHeart,
  CarFront,
  Church,
  Clock,
  FileCheck2,
  Flower2,
  Footprints,
  HardHat,
  ListOrdered,
  MapPinned,
  Mic,
  Music,
  PackageCheck,
  PartyPopper,
  PenLine,
  Ruler,
  Salad,
  ShieldCheck,
  Sparkles,
  Stamp,
  Tally5,
  Ticket,
  Trophy,
  Truck,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';
import { entryTemplateOf, isScoredTool, type DietaryRead, type EntriesRead } from '@/lib/hub-tool-entries';
import { HUB_TOOL_LIBRARY } from '@/lib/hub-tools';
import { getModule, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { VendorSet } from '@/lib/vendor-sets';
import type { Song } from '@/lib/songs';
import { PartCard } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedNote } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { ChecklistTool, CounterTool, DatedPlanTool, LiveTimelineTool, OrderedListTool, PerPersonTool, type HubToolSave } from './entry-tools';
import type { EntourageSheetSection } from '@/lib/supplier-march';
import { DietarySheet } from './dietary-sheet';
import { EntourageSheet } from './entourage-sheet';
import { SetsPanel } from '../song-desk/sets-panel';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

/**
 * THE HUB TOOLS, DRAWN — from reads ALREADY made (`hub-tool-panels.tsx` reads for the live page; the dev lab hands
 * sample data and its own `save`). No reads here, so a lab can mount it without a server. Each tool is drawn by its
 * TEMPLATE (drawing `prototypes/hub_tools_working_2026-10-28/`), never as a per-service screen:
 *
 *   Tech rider            ① Checklist       rows in vendor_hub_tool_entries
 *   Personalisation list  ② Per-person      rows in vendor_hub_tool_entries
 *   Dietary & allergies   ② Per-person, read-only — the RSVP answers (vendor_event_dietary_list), caterer only
 *   Quantity vs guests    ④ Counter         rows in vendor_hub_tool_entries, against the page's ONE headcount read
 *   Set list              ⑤ Ordered list    Song Desk's own sets (vendor_event_sets), reused — ▲ ▼ to order
 *   Paperwork checklist   ① Checklist       rows in vendor_hub_tool_entries
 *   Load-in & venue access① Checklist       rows in vendor_hub_tool_entries
 *   Delivery & drop-off   ① Checklist       rows in vendor_hub_tool_entries
 *   Queue counter         ④ Counter         rows in vendor_hub_tool_entries (a count per row), against the headcount
 *   Entourage             ② Per-person, read-only — the couple's own entourage (`loadMarch`), never typed here
 *
 * 24 Nov, the free rest · part 1 (DECISION_LOG "Seven open calls settled" item 3), every one rows in vendor_hub_tool_entries:
 *   Ceremony details · Proofs & approval · Safety permit & cue                     ① Checklist (the couple sees the ticks)
 *   Fittings & measurements · Looks per person · Crew roster · Room list           ② Per-person
 *   Chair schedule · Reservation slots · Brackets & scoring (a score per row)      ⑤ Ordered list, ▲ ▼
 *   Pick-up times & routes · Itinerary · Serving times · Remembrance schedule ·
 *   March cue sheet · Rehearsal & cues · Reveal cue                                ③ Live timeline, Next ›
 *   Wellness plan (dates and plain activity words)                                 ⑥ Plan, dated sessions
 *
 * ONE home (controller, DECISION_LOG 23 Nov 2026): every row above is in `vendor_hub_tool_entries`; the Shot list's
 * couple-read table is the Shot list's alone.
 *
 * A failed read draws that tool's "couldn't load" note in its place, never an empty tool.
 */

const MARK: Partial<Record<DayOfModuleId, Icon>> = {
  tech_rider: Mic,
  personalisation_list: PenLine,
  dietary_and_allergies: Salad,
  quantity_vs_guests: Tally5,
  set_list: ListOrdered,
  queue_counter: Ticket,
  entourage: UsersRound,
  paperwork_checklist: FileCheck2,
  load_in_and_venue_access: Truck,
  delivery_and_drop_off: PackageCheck,
  ceremony_details: Church,
  proofs_and_approval: Stamp,
  safety_permit_and_cue: ShieldCheck,
  fittings_and_measurements: Ruler,
  looks_per_person: Sparkles,
  crew_roster: HardHat,
  room_list: BedDouble,
  chair_schedule: Armchair,
  reservation_slots: Clock,
  brackets_and_scoring: Trophy,
  pick_up_times_and_routes: CarFront,
  itinerary: MapPinned,
  serving_times: UtensilsCrossed,
  remembrance_schedule: Flower2,
  march_cue_sheet: Music,
  rehearsal_and_cues: Footprints,
  reveal_cue: PartyPopper,
  wellness_plan: CalendarHeart,
};

/** Each entry tool's words — the add box and the empty line (the drawing's examples). `first` names an ordered list's row. */
const ENTRY_WORDS: Record<string, { placeholder: string; empty: string; second?: string; first?: string }> = {
  pick_up_times_and_routes: {
    first: 'Pick-up',
    placeholder: 'e.g. Bride · Hotel → Church',
    second: 'Route or note',
    empty: 'Add each pick-up with its time — who, and from where to where — then press Next as each one leaves.',
  },
  itinerary: {
    first: 'Stop',
    placeholder: 'e.g. Flight PR 102 lands',
    second: 'Where or a note',
    empty: 'Add each stop with its time — a flight, a hotel, a meeting point — then press Next as the day goes.',
  },
  serving_times: {
    first: 'What goes out',
    placeholder: 'e.g. Soup course',
    second: 'Station or note',
    empty: 'Add each course or serving with its time, then press Next as each one goes out.',
  },
  remembrance_schedule: {
    first: 'What happens',
    placeholder: 'e.g. Viewing opens',
    second: 'Where or a note',
    empty: 'Add the viewing hours, the masses and the interment with their times, then press Next as each begins.',
  },
  march_cue_sheet: {
    first: 'Who walks',
    placeholder: 'e.g. Principal sponsors',
    second: 'The song',
    empty: 'Add each march group in walking order with its time and song, then press Next as each group walks.',
  },
  rehearsal_and_cues: {
    first: 'Cue',
    placeholder: 'e.g. Couple’s first dance',
    second: 'The cue song or step',
    empty: 'Add the rehearsal and each cue with its time, then press Next as the run goes.',
  },
  reveal_cue: {
    first: 'Moment',
    placeholder: 'e.g. Countdown starts',
    second: 'Who triggers it',
    empty: 'Add the lead-up and the reveal with their times — and who triggers it — then press Next on the night.',
  },
  wellness_plan: {
    first: 'Activity',
    placeholder: 'e.g. Pilates session',
    empty: 'Add each session in the weeks before with its date, and tick it when it’s done.',
  },
  ceremony_details: {
    placeholder: 'e.g. Mass at 3:00 PM',
    empty: 'List what the ceremony needs settled — the time, sponsors, readings, banns — and tick each when it’s set.',
  },
  proofs_and_approval: {
    placeholder: 'e.g. Invitation proof 2',
    empty: 'List each proof you send the couple, and tick it when they approve it.',
  },
  safety_permit_and_cue: {
    placeholder: 'e.g. Fire permit in hand',
    empty: 'List the permit papers, the safe zone and the go cue, and tick each when it’s cleared.',
  },
  fittings_and_measurements: {
    placeholder: 'Name',
    second: 'Sizes or fitting date',
    empty: 'Add each person you dress, with their sizes or next fitting, and tick them when their fitting is done.',
  },
  looks_per_person: {
    placeholder: 'Name',
    second: 'Their look',
    empty: 'Add each person and the look they chose — soft glam, natural — and tick them when they’re done.',
  },
  crew_roster: {
    placeholder: 'Name',
    second: 'Role, call time or meal',
    empty: 'Add each person working the event, with their role and call time, and tick them as they check in.',
  },
  room_list: {
    placeholder: 'Name',
    second: 'Room',
    empty: 'Add each guest and their room, and tick them when they’ve checked in.',
  },
  chair_schedule: {
    first: 'Name',
    placeholder: 'Their name',
    second: 'Call time',
    empty: 'Add each person in the order they sit, with their call time, and move them up or down as the morning changes.',
  },
  reservation_slots: {
    first: 'Slot',
    placeholder: 'e.g. 2:00 PM · Santos',
    second: 'How many, or a note',
    empty: 'List each slot in order — the time and who — and move them as plans change.',
  },
  brackets_and_scoring: {
    first: 'Team or player',
    placeholder: 'e.g. Team Reyes',
    second: 'Group or match',
    empty: 'Add each team or player in order, then count their score as the games go.',
  },
  tech_rider: {
    placeholder: 'e.g. 2× wireless mic',
    empty: 'List what you need at the venue — mics, power, a sound check — and tick each as it’s ready.',
  },
  personalisation_list: {
    placeholder: 'Name',
    second: 'What to write or engrave',
    empty: 'Add each person and what goes on theirs — spelled the way they want it.',
  },
  quantity_vs_guests: {
    placeholder: 'e.g. Giveaways',
    empty: 'Name what you’re counting — cups, giveaways, plates — and tap More as you make or hand them out.',
  },
  paperwork_checklist: {
    placeholder: 'e.g. Signed forms',
    empty: 'List the papers for this event — IDs, signed forms, permits — and tick each when it’s in hand.',
  },
  load_in_and_venue_access: {
    placeholder: 'e.g. Gate pass',
    empty: 'List how you get in and set up — gate pass, parking, power, load-in time — and tick each when it’s sorted.',
  },
  delivery_and_drop_off: {
    placeholder: 'e.g. Drop-off spot agreed',
    empty: 'List what goes where and when — delivery time, drop-off spot, who receives it — and tick each when done.',
  },
  queue_counter: {
    placeholder: 'e.g. Served',
    empty: 'Name what you’re counting at the booth — served, refills, prints — and tap More for each one.',
  },
};

export type SetListRead = { state: 'unread' } | { state: 'ok'; sets: VendorSet[]; repertoire: Song[] };

export type HubToolReads = {
  entries: Map<string, EntriesRead>;
  dietary: DietaryRead | null;
  setList: SetListRead | null;
  /** The Entourage sheet (the couple's own entourage); null = not read. Only drawn when the tool is on. */
  entourage?: readonly EntourageSheetSection[] | null;
};

export function HubToolPanelsView({
  eventId,
  modules,
  attending,
  reads,
  save,
}: {
  eventId: string;
  /** Enabled day-of modules carrying a hub tool, in the registry's order. */
  modules: readonly DayOfModuleId[];
  /** The coming guests — the page's brief read (`pax.attending`); null = the brief could not be read. */
  attending: number | null;
  reads: HubToolReads;
  /** The lab's in-memory saver; the live page leaves it to the dispatcher. */
  save?: HubToolSave;
}) {
  const panels: ReactNode[] = [];
  for (const id of modules) {
    const key = getModule(id).hubTool;
    if (!key) continue;
    const title = HUB_TOOL_LIBRARY.find((t) => t.key === key)?.label ?? getModule(id).label;
    const icon = MARK[id] ?? ListOrdered;
    let body: ReactNode = null;

    if (key === 'entourage') {
      body = <EntourageSheet sections={reads.entourage ?? null} />;
    } else if (key === 'dietary_and_allergies') {
      body = reads.dietary ? <DietarySheet read={reads.dietary} icon={icon} title={title} /> : null;
    } else if (key === 'set_list') {
      const sl = reads.setList;
      body = !sl ? null : sl.state === 'unread' ? (
        <div data-hub-tool="set_list" data-hub-tool-state="unread">
          <h3>{title}</h3>
          <ReadFailedNote mark="set-list">We couldn&rsquo;t load your sets right now.</ReadFailedNote>
        </div>
      ) : (
        <div data-hub-tool="set_list" data-hub-template="ordered_list">
          <SetsPanel eventId={eventId} sets={sl.sets} repertoire={sl.repertoire} open />
        </div>
      );
    } else {
      const template = entryTemplateOf(key);
      const read = reads.entries.get(key);
      const words = ENTRY_WORDS[key] ?? { placeholder: 'Add a row', empty: 'Nothing here yet.' };
      if (!template || !read) body = null;
      else if (read.state === 'unread') {
        body = (
          <div data-hub-tool={key} data-hub-tool-state="unread">
            <h3>{title}</h3>
            <ReadFailedNote mark={`hub-tool:${key}`}>We couldn&rsquo;t load your {title.toLowerCase()} right now.</ReadFailedNote>
          </div>
        );
      } else if (template === 'checklist') {
        body = <ChecklistTool eventId={eventId} toolKey={key} title={title} icon={icon} initial={read.entries} save={save} placeholder={words.placeholder} empty={words.empty} />;
      } else if (template === 'per_person') {
        body = <PerPersonTool eventId={eventId} toolKey={key} title={title} icon={icon} initial={read.entries} save={save} second={words.second ?? 'Note'} empty={words.empty} />;
      } else if (template === 'live_timeline') {
        body = (
          <LiveTimelineTool
            eventId={eventId}
            toolKey={key}
            title={title}
            icon={icon}
            initial={read.entries}
            save={save}
            first={words.first ?? 'What happens'}
            placeholder={words.placeholder}
            second={words.second ?? 'Note'}
            empty={words.empty}
          />
        );
      } else if (template === 'plan') {
        body = (
          <DatedPlanTool
            eventId={eventId}
            toolKey={key}
            title={title}
            icon={icon}
            initial={read.entries}
            save={save}
            first={words.first ?? 'Activity'}
            placeholder={words.placeholder}
            empty={words.empty}
          />
        );
      } else if (template === 'ordered_list') {
        body = (
          <OrderedListTool
            eventId={eventId}
            toolKey={key}
            title={title}
            icon={icon}
            initial={read.entries}
            save={save}
            first={words.first ?? 'Item'}
            placeholder={words.placeholder}
            second={words.second ?? 'Note'}
            empty={words.empty}
            scored={isScoredTool(key)}
          />
        );
      } else {
        body = <CounterTool eventId={eventId} toolKey={key} title={title} icon={icon} initial={read.entries} save={save} attending={attending} placeholder={words.placeholder} empty={words.empty} />;
      }
    }
    if (body) panels.push(<PartCard key={id}>{body}</PartCard>);
  }
  if (panels.length === 0) return null;
  return (
    <div id="hub-tools" className="scroll-mt-4" data-hub-tools="">
      {panels}
      <UndoToastHost />
    </div>
  );
}
