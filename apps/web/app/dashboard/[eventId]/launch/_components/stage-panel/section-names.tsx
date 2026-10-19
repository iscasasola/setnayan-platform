'use client';

import { useEffect, useState } from 'react';
import { FORM_PICK_CLASS, FormRow, FormRows, TypedRow, usePillWidth } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { ROLE_NAME_MAX, sectionNameKey } from '@/lib/role-names';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import type { MakerPartOps } from '../maker-part-ops';

/**
 * 🏷 THE WEDDING MARCH'S EDIT NAMES ITS SECTIONS, RIGHT THERE (owner 2026-10-19, on the guest Event Hub's entourage:
 * *"Immediate Family change it to VIP."* → *"or how can we rename this?"*). Rows 2–3 under the march's one door (row 1,
 * "Open in Studio › Wedding March" — the names are still dragged there):
 *
 *   row 2  Section ▾ — every heading the page draws, as drawn (the house dropdown: any set of choices is ONE PickMenu);
 *   row 3  Heading — the picked section's words, typed in place (the app's typed Form row). Empty = the usual heading.
 *
 * WHICH sections, and their words now, are the PAGE's to say (`[data-section-heading]`, drawn by the entourage's own
 * heading — `entourage-section.tsx` `GroupHeading`), never a list kept here. KEEPING is ONE draft write through the one
 * draft door (`hubDraftAction`): `{ events: { role_names: { "section:<key>": words } } }` — section keys only, a role's
 * word is never drafted (`sanitizeDraftedSectionWords`). Like every Maker edit, guests see it at ✓ Apply, which writes it
 * through the column's ONE writer (`writeRoleNames`) — the same door the Guest list's "Rename this section" uses. Not
 * held: the page is drawn again with the drafted heading (`lib/drafted-role-names.ts`).
 *
 * Four rows, nothing scrolls (`the-toolbar-is-four-rows.test.ts`); no go-edit-elsewhere link for the words.
 */
const ROW_FIT = '[&>[data-form-row]]:min-w-0 [&>[data-form-row]]:flex-1 [&_[data-form-row]:not([data-form-row-editing])>div]:!min-h-11';

/** One heading the page draws. */
export type DrawnSection = { key: string; words: string; usual: string };

/** Every section heading the entourage draws on this canvas, in the page's order. Pure but for the DOM it is handed. */
export function readDrawnSections(doc: Document | null | undefined): DrawnSection[] {
  const section = doc ? findMakerSection(doc, 'f:entourage') : null;
  if (!section) return [];
  const out: DrawnSection[] = [];
  for (const h of Array.from(section.querySelectorAll<HTMLElement>('[data-section-heading]'))) {
    const key = h.getAttribute('data-section-heading') ?? '';
    if (!key || out.some((s) => s.key === key)) continue;
    const words = (h.textContent ?? '').replace(/\s+/g, ' ').trim();
    out.push({ key, words, usual: h.getAttribute('data-section-usual') ?? words });
  }
  return out;
}

export function SectionNames({
  readDoc,
  ask,
  stamp,
  onRefused,
}: {
  /** The shown canvas's document (same origin). */
  readDoc: () => Document | null;
  /** The work area's own (`askPartOps`): the event and its one draft door. */
  ask: () => MakerPartOps | null;
  /** The Maker's render stamp — the headings are read again after every render. */
  stamp: string | null;
  /** A save that did not land — said through the toolbar's line. */
  onRefused: (words: string) => void;
}) {
  const width = usePillWidth();
  const [sections, setSections] = useState<DrawnSection[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setSections((was) => {
      const next = readDrawnSections(readDoc());
      return JSON.stringify(was) === JSON.stringify(next) ? was : next;
    });
    read();
    // The canvas marks its parts a moment after it is ready.
    const t = window.setTimeout(read, 400);
    return () => window.clearTimeout(t);
  }, [readDoc, stamp]);
  if (sections.length === 0) return null;
  const on = sections.find((s) => s.key === picked) ?? sections[0]!;
  const renamed = on.words !== on.usual;

  const keep = async (text: string) => {
    const o = ask();
    if (!o?.draftAction) return { ok: false as const, error: 'That could not be saved just now. Please try again.' };
    const draftAction = o.draftAction;
    const words = text.replace(/\s+/g, ' ').trim().slice(0, ROLE_NAME_MAX);
    const patch = { events: { role_names: { [sectionNameKey(on.key)]: words === on.usual ? '' : words } } };
    let res: HubDraftActionResult | typeof SUPERSEDED;
    try {
      res = await makerSave(
        () =>
          makerLatestWrite(`section-name:${on.key}`, () => {
            const fd = new FormData();
            fd.set('intent', 'save');
            fd.set('patch', JSON.stringify(patch));
            fd.set(HUB_DRAFT_BAR_FIELD, '1');
            return draftAction(o.eventId, fd);
          }),
        requestMakerRefresh,
        { ok: (r) => r !== SUPERSEDED && r.ok === true },
      );
    } catch {
      res = { ok: false, intent: 'save', error: '' };
    }
    if (res === SUPERSEDED || res.ok) {
      setSections((all) => all.map((s) => (s.key === on.key ? { ...s, words: words || s.usual } : s)));
      return { ok: true as const };
    }
    const error = res.error || 'That did not save. The heading is back as it was.';
    onRefused(error);
    return { ok: false as const, error };
  };

  return (
    <FormRows data="stage-edit-sections" className="!contents">
      <div className={`${SP_ROWS_ROW} row-start-2 ${ROW_FIT}`} data-stage-edit-row="section">
        <FormRow name="Section" data="stage-section-pick">
          <PickMenu
            label="Section"
            value={on.key}
            options={sections.map((s) => ({ key: s.key, label: s.words }))}
            onPick={setPicked}
            className={`${FORM_PICK_CLASS} ${width}`}
          />
        </FormRow>
      </div>
      <div className={`${SP_ROWS_ROW} row-start-3 ${ROW_FIT}`} data-stage-edit-row="heading" data-stage-section-heading={on.key}>
        <TypedRow
          key={on.key}
          name="Heading"
          value={renamed ? on.words : ''}
          empty={on.usual}
          placeholder={on.usual}
          maxLength={ROLE_NAME_MAX}
          autoCapitalize="words"
          data="stage-section-words"
          onKeep={keep}
        />
      </div>
    </FormRows>
  );
}
