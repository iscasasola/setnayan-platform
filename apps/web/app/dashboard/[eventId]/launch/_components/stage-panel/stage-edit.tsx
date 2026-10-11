'use client';

import type { ReactNode } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { QuietBar } from './kit';
import { orderPartWords, partWordsId, type PartWordsField } from './part-words';

/**
 * ✏️ EDIT — the toolbar's first tool (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § EDIT):
 *
 *   rows 1–3  THE PART'S WORDS, EDITED RIGHT THERE (*"if the edit is just text, then don't need to jump"*): one typed
 *             Form row per text the page draws for the part (`part-words.ts` — the title, the names, the invite
 *             line, the link; Your message, Your reminders; a scene of their own's Heading and Words), the text last
 *             tapped on the page first (*"it can both adapt to whichever is edited"*). A tap on the pill opens the
 *             field across the row; tapping out or Enter keeps, ✕ leaves it as it was (the app's `TypedRow`). The
 *             page shows the words as they are typed; keeping is ONE draft write.
 *             — or, for a part whose editing cannot be done in three rows (*"Only jump if it has editing that cannot
 *             be done there. Example: Schedule, Love Story, Wedding March, Logo"*), its ONE door in row 1
 *             ("Open in Studio › Schedule"; the date and the place: "Change it in Suppliers") — `QuietBar`.
 *   row 2     on a Post Event scene: "Shown to guests", the one switch (`second`) — and then row 1 holds ONE text.
 *   row 4     THE LINE UNDER THE TOOLS — drawn by the toolbar itself, over this row (`stage-tools.tsx`
 *             `data-stage-status`): "Saving…", "<Scene> removed" beside Undo, why a part keeps its place. It was
 *             ↑ Earlier · ↓ Later · Remove (owner 2026-10-09: *"always set this as the last row"*) until a scene
 *             could be held on the page and dragged, or dropped on the bin (owner 2026-10-11: *"what if we drag the
 *             scene on the preview instead of having this"*); whoever cannot drag has the same three steps on the
 *             picked part's name tag (`add-part-sheet.tsx` `PartMenuSheet`).
 *
 * The toolbar's OWN rows: nothing here is the work area's, so Edit is the same on every part.
 * No "Add" (owner: the ＋ on the page stays the way to add a part).
 */
/** The grid row of each text — written out, so the stylesheet has them. */
const WORDS_ROW = ['row-start-1', 'row-start-2', 'row-start-3'] as const;
/** A typed row inside one of the four rows: the template's own line, at the row's 44 px while it is shut. */
const WORDS_FIT = '[&>[data-form-row]]:min-w-0 [&>[data-form-row]]:flex-1 [&_[data-form-row]:not([data-form-row-editing])>div]:!min-h-11';
/** …the same fit, for the reply pages' own Edit rows (`maker-rsvp-ask.tsx`): one Form row in one of the four rows. */
export const STAGE_EDIT_ROW_FIT = WORDS_FIT;

export function StageEdit({
  fields,
  tapped,
  onType,
  onKeep,
  second = null,
}: {
  /**
   * 🎞 A part's ONE simple setting, in row 2 (owner: *"same goes to simple edits"*) — a Post Event scene's "Shown to
   * guests" switch (`post-event-shown.tsx`; it places itself). Such a part shows ONE text in row 1 — the one last
   * tapped on the page, else its first — as the approved prototype draws a Post Event scene.
   */
  second?: ReactNode;
  /** The texts the page draws for the picked part — none: the part keeps its one door. */
  fields: readonly PartWordsField[];
  /** The text last tapped on the page (its `[data-el]` / field) — its row comes first. */
  tapped: string | null;
  /** The words as they are typed — shown on the page, never saved. */
  onType: (field: PartWordsField, text: string) => void;
  /** Keep the words: the ONE draft write. */
  onKeep: (field: PartWordsField, text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const shown = orderPartWords(fields, tapped).slice(0, second ? 1 : WORDS_ROW.length);
  return (
    <div className={SP_ROWS} data-stage-edit="">
      {shown.length > 0 ? (
        <FormRows data="stage-edit" className="!contents">
          {shown.map((f, i) => (
            <div key={partWordsId(f)} className={`${SP_ROWS_ROW} ${WORDS_ROW[i]} ${WORDS_FIT}`} data-stage-edit-row="words" data-stage-edit-words={partWordsId(f)}>
              <TypedRow
                name={f.label}
                value={f.text}
                long={f.long}
                maxLength={f.maxLength}
                autoCapitalize={f.el === 'names' ? 'words' : 'sentences'}
                data="stage-words"
                onType={(text) => onType(f, text)}
                onKeep={(text) => onKeep(f, text)}
              />
            </div>
          ))}
        </FormRows>
      ) : (
        <div className={`${SP_ROWS_ROW} row-start-1 [&>*]:min-w-0 [&>*]:flex-1`} data-stage-edit-row="door">
          <QuietBar />
        </div>
      )}
      {second}
    </div>
  );
}
