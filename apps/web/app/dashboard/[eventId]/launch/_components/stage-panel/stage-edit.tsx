'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
 *   row 4     ↑ Earlier · ↓ Later · Remove — ALWAYS the last row (owner: *"always set this as the last row"*), on
 *             every part: a part that cannot move or cannot be taken off keeps the button, grey (`waiting`), and a
 *             tap on a grey one says why.
 *
 * The toolbar's OWN rows: nothing here is the work area's, so Edit is the same on every part. The moves are the
 * frame's own writes (`usePartEdits`, `add-part-sheet.tsx`) — one order write a step, the one confirm before a remove.
 * No "Add" (owner: the ＋ on the page stays the way to add a part).
 */
/** A button of the last row: a third of it, 44 px, its word never wrapped. */
const EDIT_STEP = '!h-11 min-w-0 !flex-1 !px-2 [&>.lbl]:truncate';
/** The grid row of each text — written out, so the stylesheet has them. */
const WORDS_ROW = ['row-start-1', 'row-start-2', 'row-start-3'] as const;
/** A typed row inside one of the four rows: the template's own line, at the row's 44 px while it is shut. */
const WORDS_FIT = '[&>[data-form-row]]:min-w-0 [&>[data-form-row]]:flex-1 [&_[data-form-row]:not([data-form-row-editing])>div]:!min-h-11';

export function StageEdit({
  fields,
  tapped,
  onType,
  onKeep,
  earlier,
  later,
  remove,
  removeWord,
  why,
  onWhy,
}: {
  /** The texts the page draws for the picked part — none: the part keeps its one door. */
  fields: readonly PartWordsField[];
  /** The text last tapped on the page (its `[data-el]` / field) — its row comes first. */
  tapped: string | null;
  /** The words as they are typed — shown on the page, never saved. */
  onType: (field: PartWordsField, text: string) => void;
  /** Keep the words: the ONE draft write. */
  onKeep: (field: PartWordsField, text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** One place earlier / later on the page — null: nowhere to go (the button is grey). */
  earlier: (() => void) | null;
  later: (() => void) | null;
  /** Ask to take the part off (it asks first) — null: a part that stays (the button is grey). */
  remove: (() => void) | null;
  removeWord: string;
  /** Why a grey step cannot, by step — said when it is tapped (never a dead tap). */
  why: { earlier: string; later: string; remove: string };
  onWhy: (words: string) => void;
}) {
  const shown = orderPartWords(fields, tapped).slice(0, WORDS_ROW.length);
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
      <div className={`${SP_ROWS_ROW} row-start-4`} data-stage-edit-row="place">
        {/* A step with nowhere to go is still a button — grey, its pill kept (`waiting`, the approved gallery § 9: "a
            button that cannot be used yet is grey") — and a tap on it says why (its own press does nothing; the tap
            is heard on the wrapper, which draws nothing). A live step is the neutral button: ink on the toolbar's
            ground; Remove is the danger tone, red word and line. */}
        <span className="contents" data-stage-edit-step="earlier" onClick={earlier ? undefined : () => onWhy(why.earlier)}>
          <ActionButton tone="neutral" icon={ArrowUp} label="Earlier" waiting={!earlier} onClick={earlier ?? undefined} className={EDIT_STEP} />
        </span>
        <span className="contents" data-stage-edit-step="later" onClick={later ? undefined : () => onWhy(why.later)}>
          <ActionButton tone="neutral" icon={ArrowDown} label="Later" waiting={!later} onClick={later ?? undefined} className={EDIT_STEP} />
        </span>
        <span className="contents" data-stage-edit-step="remove" onClick={remove ? undefined : () => onWhy(why.remove)}>
          <ActionButton tone="danger" icon={Trash2} label={removeWord} waiting={!remove} onClick={remove ?? undefined} className={EDIT_STEP} />
        </span>
      </div>
    </div>
  );
}
