import type { ReactNode } from 'react';
import { parentsOffered, yourEventLabel } from '@/lib/details-your-event';
import { yourEventFactEditors, type YourEventInput } from '../launch/_components/details-your-event-parts';
import { ParentCards } from '../launch/_components/details-lazy';

/**
 * ⚙ EVENT SETTINGS' ROWS — names · date · venues · parents, each its ONE shipped editor (owner 2026-10-29, *"keep it
 * there"*; DECISION_LOG 2026-10-27 "INFO SPLITS BY WHAT IT IS ABOUT"). Composed here ONCE: the action that reads them at
 * the ⚙'s press (`open-event-settings.tsx`) and the Home lab's fixture (`/dev/home-lab?settings=1`) draw the same rows.
 *
 *   · Names · Date · Venues — `yourEventFactEditors`, the builder the Maker's Details and Event Details' rows mount
 *     (`every-fact-has-one-editor.test.ts`);
 *   · Parents — `ParentCards`, the Maker's own list + add (a tapped parent opens THE guest card);
 *   · `dock` — the Maker's own Undo · Apply (`HubDraftDock`) on top, as Event Details carries it: these facts save into
 *     the Event Hub draft and go live at Apply.
 *
 * No frames around the rows — a divider between topics; frames only on what is pressed.
 */
export function EventSettingsRows({
  eventId,
  input,
  parents,
  dock,
}: {
  eventId: string;
  input: YourEventInput;
  /** The parents on the invitation; null = they could not be read (said, never drawn as none). */
  parents: ReadonlyArray<{ guestId: string | null; name: string }> | null;
  dock: ReactNode;
}) {
  const editors = yourEventFactEditors({ eventId, input });
  const withParents = parentsOffered(input.kind);
  return (
    <div data-event-settings-body="" className="flex flex-col gap-5 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
      {dock ? (
        <div data-event-settings-dock="" className="flex items-center justify-end gap-1.5">
          {dock}
        </div>
      ) : null}
      {editors.names ? (
        <FactRow row="names" title={yourEventLabel('names', input.kind)}>
          {editors.names}
        </FactRow>
      ) : null}
      <FactRow row="date" title={yourEventLabel('date', input.kind)}>
        {editors.date}
      </FactRow>
      <FactRow row="venues" title={yourEventLabel('venues', input.kind)}>
        {editors.venues}
      </FactRow>
      {withParents ? (
        <FactRow row="parents" title={yourEventLabel('parents', input.kind)}>
          {parents ? (
            <ParentCards eventId={eventId} parents={parents.map((p) => ({ guestId: p.guestId ?? null, name: p.name }))} />
          ) : (
            <p role="alert" className="text-sm text-terracotta-700">
              The parents couldn’t be read just now. Nothing was changed — close this and try again.
            </p>
          )}
        </FactRow>
      ) : null}
    </div>
  );
}

/** One fact: its name, then its editor — a divider between topics. */
function FactRow({ row, title, children }: { row: string; title: string; children: ReactNode }) {
  return (
    <section
      data-event-settings-row={row}
      className="flex flex-col gap-2 border-t border-ink/10 pt-4 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}
