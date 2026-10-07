'use client';

import { useCallback, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { coupleNameColumns } from '@/lib/typed-names';
import type { NameStyle } from '@/lib/name-style';
import type { PersonName } from './details-your-event';
/* The shipped editors, through their lazy stand-ins (the `maker-details` chunk they already live in). */
import { NameStylePicker, NamesEditor } from './details-lazy';

/**
 * 🏷 STUDIO › INFO — "EVENT NAME · MARIA & JOSE" IS ONE ROW (owner 2026-10-07, verbatim
 * *"yes"* on the controller's mapping; DECISION_LOG "'EVENT NAME · MARIA & JOSE' IS ONE
 * ROW THAT OPENS THE TWO PEOPLE IN PLACE"). The row's line is composed from the two
 * first names exactly as the hero draws them (`coupleNameColumns` → `display_name`,
 * the Personalization writer's own composition) and follows what is typed; tapping it
 * opens, right there, each person's first + last name and Name style ▾ — the SHIPPED
 * `NamesEditor` / `NameStylePicker`, their data and their draft saves. No new field.
 * A one-person event never comes here: it keeps its single `display_name` field.
 */
export function StudioEventName({
  eventId,
  people,
  initial,
  nameStyle,
}: {
  eventId: string;
  people: readonly [string, string];
  initial: readonly [PersonName, PersonName];
  nameStyle: NameStyle;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(() => coupleNameColumns(initial[0], initial[1]).display_name ?? '');
  const onNames = useCallback((a: PersonName, b: PersonName) => setShown(coupleNameColumns(a, b).display_name ?? ''), []);
  const id = useId();
  return (
    <div data-studio-event-name={open ? 'open' : ''} className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2.5 text-left"
      >
        <span className="min-w-0 flex-1 text-[14px] text-ink">Event name</span>
        <span className={`min-w-0 truncate text-[15px] ${shown ? 'text-ink' : 'text-ink/45'}`}>{shown || 'Not set yet'}</span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-gild transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {/* Hidden, never unmounted — the names keep saving as they are typed while the row is shut. */}
      <div id={id} hidden={!open} className={`${open ? 'flex' : 'hidden'} flex-col gap-3 pb-1 pt-2`}>
        <NamesEditor eventId={eventId} people={people} initial={initial} onNames={onNames} />
        <NameStylePicker eventId={eventId} saved={nameStyle} />
      </div>
    </div>
  );
}
