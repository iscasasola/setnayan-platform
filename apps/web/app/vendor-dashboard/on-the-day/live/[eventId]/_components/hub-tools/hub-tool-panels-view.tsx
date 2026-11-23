'use client';

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ListOrdered, Mic, PenLine, Salad, Tally5 } from 'lucide-react';
import { entryTemplateOf, type DietaryRead, type EntriesRead } from '@/lib/hub-tool-entries';
import { HUB_TOOL_LIBRARY } from '@/lib/hub-tools';
import { getModule, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { VendorSet } from '@/lib/vendor-sets';
import type { Song } from '@/lib/songs';
import { PartCard } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedNote } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { ChecklistTool, CounterTool, PerPersonTool, type HubToolSave } from './entry-tools';
import { DietarySheet } from './dietary-sheet';
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
 *
 * A failed read draws that tool's "couldn't load" note in its place, never an empty tool.
 */

const MARK: Partial<Record<DayOfModuleId, Icon>> = {
  tech_rider: Mic,
  personalisation_list: PenLine,
  dietary_and_allergies: Salad,
  quantity_vs_guests: Tally5,
  set_list: ListOrdered,
};

/** Each entry tool's words — the add box and the empty line (the drawing's examples). */
const ENTRY_WORDS: Record<string, { placeholder: string; empty: string; second?: string }> = {
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
};

export type SetListRead = { state: 'unread' } | { state: 'ok'; sets: VendorSet[]; repertoire: Song[] };

export type HubToolReads = {
  entries: Map<string, EntriesRead>;
  dietary: DietaryRead | null;
  setList: SetListRead | null;
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

    if (key === 'dietary_and_allergies') {
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
