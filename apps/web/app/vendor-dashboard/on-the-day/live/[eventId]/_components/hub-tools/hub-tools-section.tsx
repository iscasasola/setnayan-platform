import type { ReactNode } from 'react';
import { DAY_OF_MODULES, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { CHECKLIST_TOOL_KEYS, type ChecklistToolKey, type ListStore } from '@/lib/shot-list';
import type { EntourageSheetSection } from '@/lib/supplier-march';
import { PartCard } from '../../../../../_components/set-two/parts';
import { ShotList } from '../../../../_components/on-demand';
import { QueueCounter } from './queue-counter';
import { EntourageSheet } from './entourage-sheet';

/**
 * 🧰 THE HUB TOOLS ON THE DAY (DECISION_LOG 2026-11-23: the most-shared unbuilt hub tools, free). Every tool is one of
 * the shipped templates, never a screen of its own:
 *   · Paperwork checklist · Load-in & venue access · Delivery & drop-off → the checklist (the shot list's component,
 *     actions and rows, `tool`);
 *   · Queue counter → the counter (`QueueCounter`, one saved row per serve);
 *   · Entourage → the per-person sheet (`EntourageSheet`, the couple's own entourage, read-only).
 * Which are drawn is the booking's switches (Hub › Set up › Tools for this event, `resolveModules`), in the library's
 * order. Each sits in one card, under the shipped tools.
 */
export const HUB_TOOL_MODULE_IDS: readonly DayOfModuleId[] = DAY_OF_MODULES.filter((m) => m.hubTool).map((m) => m.id);

function isChecklist(id: DayOfModuleId): id is ChecklistToolKey {
  return (CHECKLIST_TOOL_KEYS as readonly string[]).includes(id);
}

export function HubToolsSection({
  eventId,
  eventName,
  on,
  coming,
  entourage,
  store,
}: {
  eventId: string;
  eventName: string;
  /** The enabled module ids (any; only hub tools are drawn here). */
  on: readonly DayOfModuleId[];
  /** Attending from the couple's RSVP (the brief); null = not read. */
  coming: number | null;
  /** The entourage sheet; null = not read. Only read when the tool is on. */
  entourage: readonly EntourageSheetSection[] | null;
  /** Labs only (a client lab): the in-memory store both list tools talk to. Pages never pass it. */
  store?: ListStore;
}) {
  const shown = HUB_TOOL_MODULE_IDS.filter((id) => on.includes(id));
  if (shown.length === 0) return null;
  const draw = (id: DayOfModuleId): ReactNode => {
    if (id === 'queue_counter') return <QueueCounter eventId={eventId} coming={coming} store={store} />;
    if (id === 'entourage') return <EntourageSheet sections={entourage} />;
    if (isChecklist(id)) return <ShotList eventId={eventId} eventName={eventName} tool={id} store={store} />;
    return null;
  };
  return (
    <div data-hub-tools-on-the-day="" className="space-y-3">
      {shown.map((id) => (
        <div key={id} id={`tool-${id}`} className="scroll-mt-4">
          <PartCard>{draw(id)}</PartCard>
        </div>
      ))}
    </div>
  );
}
