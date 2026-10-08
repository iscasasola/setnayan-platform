'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
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
  /* 🎯 A jump from Stages (the Names part's Style › "Edit in Studio") asks for the first name: it marks this row
     `data-focus-pending` before it focuses, and the row opens so the field CAN take focus (agreed with Builder RD). */
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const take = () => {
      if (!el.hasAttribute('data-focus-pending')) return;
      el.removeAttribute('data-focus-pending');
      setOpen(true);
    };
    take();
    const mo = new MutationObserver(take);
    mo.observe(el, { attributes: true, attributeFilter: ['data-focus-pending'] });
    return () => mo.disconnect();
  }, []);
  return (
    <div ref={root} data-studio-event-name={open ? 'open' : ''} className="flex flex-col">
      <div className="flex min-h-12 w-full items-center gap-2.5">
        {/* ⓘ Where the Event name is read (owner 2026-10-07, *"it should be Event Name (i) where the use for Event
            Name details is described"*) — measured from its readers: the Event Hub's cover and page title
            (`app/[slug]/page.tsx` metadata), the RSVP form (`rsvp-widget.tsx`), every print and pass
            (`app/api/hub-print/[piece]`), the picture a shared link shows (`app/api/og/u/[slug]`), and the
            emails about the event (`lib/daily-email-jobs.ts`, `lib/supplier-night-before-email.ts`). */}
        <span className="min-w-0 flex-1">
          <InfoTip label="Event name" labelClassName="text-[14px] text-ink" align="start">
            Guests read it on your Event Hub&rsquo;s cover and page title, on the RSVP form, on every print and pass, on the
            picture a shared link shows, and in the emails about your event.
          </InfoTip>
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Event name: ${shown || 'not set yet'} — ${open ? 'close' : 'change the names'}`}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 min-w-0 items-center gap-2 text-left"
        >
          <span className={`min-w-0 truncate text-[15px] ${shown ? 'text-ink' : 'text-ink/45'}`}>{shown || 'Not set yet'}</span>
          <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-gild transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
      </div>
      {/* Hidden, never unmounted — the names keep saving as they are typed while the row is shut. */}
      <div id={id} hidden={!open} className={`${open ? 'flex' : 'hidden'} flex-col gap-3 pb-1 pt-2`}>
        <NamesEditor eventId={eventId} people={people} initial={initial} onNames={onNames} />
        <NameStylePicker eventId={eventId} saved={nameStyle} />
      </div>
    </div>
  );
}
