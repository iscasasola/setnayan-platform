'use client';

import { useEffect, useRef, useState } from 'react';
import { ChosenRow, FormRows, OpensRow, TypedRow } from '@/app/_components/form-row';
import { sanitizeName } from '@/lib/match-criteria';
import { NAME_STYLE_CHOICES, type NameStyle } from '@/lib/name-style';
import { nameStyleDraftPatch } from '@/lib/name-style-save';
import { coupleNameColumns } from '@/lib/typed-names';
import type { PersonName } from './details-your-event';
import { STUDIO_INFO_ROWS, studioDraftKeep } from './studio-info';

/**
 * 🏷 STUDIO › INFO — THE EVENT NAME, ON THE FORM ROW (owner 2026-10-08: *"prioritize only what they need to input
 * here"* · *"field follow form row style"*; the designer's map row 1, `STUDIO_INFO_REDESIGN_2026-10-08_fable.md`).
 *
 * The first thing on the page, and what a couple must type:
 *
 *   Event name ⓘ            [ Maria & Jose     ▾ ]   ← ONE row: the line guests read, composed as it is typed
 *     Bride · first name    [ Maria            ✎ ]   ← …that opens the two people in place, each name a typed row
 *     Bride · last name     [ Santos           ✎ ]
 *     Groom · first name    [ Jose             ✎ ]
 *     Groom · last name     [ Reyes            ✎ ]
 *     Name style            [ Full             ▾ ]
 *
 * ONE row that opens the two people in place (owner 2026-10-07, DECISION_LOG "'EVENT NAME · MARIA & JOSE' IS ONE
 * ROW…") — kept. What the approved gallery (2026-10-08) changes is the LOOK inside it: every answer is a pill, so
 * each of the four names is a typed row and the style a dropdown — the SAME facts, the SAME composition
 * (`coupleNameColumns` → `display_name`, the Personalization writer's own) and the SAME draft door. No new field.
 * A first name is REQUIRED (it is what the event's name is made of); a last name may be left out. The row arrives
 * OPEN only while a first name is still missing — what must be typed is then in view; otherwise it is one line.
 *
 * ⚡ One kept name = ONE drafted write of the name columns, no render of the Maker (`studioDraftKeep`).
 * A one-person event never comes here: it keeps its single `display_name` field.
 */
export function StudioEventName({
  eventId,
  people,
  initial,
  nameStyle,
}: {
  eventId: string;
  /** The two people's words from the event type (`peopleLabels`) — "Bride", "Groom". */
  people: readonly [string, string];
  initial: readonly [PersonName, PersonName];
  nameStyle: NameStyle;
}) {
  const [names, setNames] = useState<readonly [PersonName, PersonName]>(initial);
  const [style, setStyle] = useState<NameStyle>(nameStyle);
  const [styleProblem, setStyleProblem] = useState<string | null>(null);
  const shown = coupleNameColumns(names[0], names[1]).display_name ?? '';
  const missing = !names[0].first.trim() || !names[1].first.trim();
  const [missingAtFirst] = useState(missing);
  /* The latest names, for a keep that lands after another row has already changed them. */
  const latest = useRef(names);
  const keepName = (who: 0 | 1, part: keyof PersonName) => (text: string) => {
    const next: [PersonName, PersonName] = [{ ...latest.current[0] }, { ...latest.current[1] }];
    next[who][part] = text;
    latest.current = next;
    setNames(next);
    // The Personalization writer's own composition; an all-blank pair leaves the page's names alone.
    return studioDraftKeep(eventId, 'events:names', coupleNameColumns(next[0], next[1]));
  };
  const pickStyle = (key: string) => {
    const pick = NAME_STYLE_CHOICES.find((c) => c.key === key)?.key;
    if (!pick || pick === style) return;
    const before = style;
    setStyle(pick);
    setStyleProblem(null);
    void studioDraftKeep(eventId, 'events:print_details.name_style', nameStyleDraftPatch(pick).events ?? {}).then((r) => {
      if (r.ok) return;
      setStyle(before);
      setStyleProblem(`That name style did not save, so it is back as it was. ${r.error}`);
    });
  };
  /* 🎯 A jump from Stages (the Names part's Style › "Edit in Studio") looks for a name FIELD: none is in the page
     until a row is open, so it finds the still anchor below, marks this row `data-focus-pending`, and the row opens
     with its first name — that field is then the first one in the page, and takes the focus. */
  const root = useRef<HTMLDivElement>(null);
  const [openFirst, setOpenFirst] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const take = () => {
      if (!el.hasAttribute('data-focus-pending')) return;
      el.removeAttribute('data-focus-pending');
      setOpenFirst((n) => n + 1);
    };
    take();
    const mo = new MutationObserver(take);
    mo.observe(el, { attributes: true, attributeFilter: ['data-focus-pending'] });
    return () => mo.disconnect();
  }, []);
  const row = (who: 0 | 1, part: keyof PersonName) => (
    <TypedRow
      key={`${who}-${part}`}
      data={`name-${who}-${part}`}
      name={`${people[who]} · ${part} name`}
      value={names[who][part]}
      empty={part === 'first' ? 'Add a first name' : 'Add a last name'}
      placeholder={`${people[who]}’s ${part} name`}
      maxLength={80}
      autoCapitalize="words"
      required={part === 'first'}
      clean={sanitizeName}
      onKeep={keepName(who, part)}
      openAsk={who === 0 && part === 'first' ? openFirst : 0}
    />
  );
  return (
    <div ref={root} data-studio-event-name="" data-details-names="">
      <FormRows data="event-name" attrs={STUDIO_INFO_ROWS}>
        {/* ⓘ Where the Event name is read (owner 2026-10-07, *"it should be Event Name (i) where the use for Event
            Name details is described"*) — measured from its readers: the Event Hub's cover and page title, the RSVP
            form, every print and pass, the picture a shared link shows, and the emails about the event. */}
        <OpensRow
          data="event-name"
          name="Event name"
          about={{
            words:
              'Made from your two first names. Guests read it on your Event Hub’s cover and page title, on the RSVP form, on every print and pass, on the picture a shared link shows, and in the emails about your event.',
          }}
          answer={shown}
          needed={missing}
          /* Open on arrival only while a first name is still missing (decided once, from what was read). */
          defaultOpen={missingAtFirst}
          openAsk={openFirst}
        >
          <FormRows data="event-name-parts">
            {row(0, 'first')}
            {row(0, 'last')}
            {row(1, 'first')}
            {row(1, 'last')}
            <ChosenRow
              data="name-style"
              name="Name style"
              about={{ words: 'How a guest’s name is written on the invitation, the passes and every print.' }}
              value={style}
              options={NAME_STYLE_CHOICES.map((c) => ({ key: c.key, label: c.label, hint: c.example }))}
              onPick={pickStyle}
              dataAttr="data-name-style-pick"
              problem={styleProblem}
              attrs={{ 'data-name-style': style }}
            />
          </FormRows>
        </OpensRow>
      </FormRows>
      {/* The still anchor a jump from Stages finds (see above). Not a field: it holds nothing and is never sent. */}
      <input hidden readOnly tabIndex={-1} aria-hidden data-studio-name-anchor="" value="" />
    </div>
  );
}
