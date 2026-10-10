'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Group, Plus, Trash2, Ungroup, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { TypedRow } from '@/app/_components/form-row';
import { SP_ROWS, SP_ROWS_ROW, STAGE_BAR_HANDLE, STAGE_BAR_LINE, STAGE_SHEET_ROW } from '@/lib/maker-stage-room';
import {
  RSVP_ADD_KINDS,
  RSVP_LIST_EDIT_EVENT,
  RSVP_LIST_WORDS,
  rsvpGroupId,
  rsvpLayoutEdit,
  rsvpPlaceOf,
  rsvpRefusalWords,
  rsvpScreenCounts,
  type RsvpLayoutEdit,
  type RsvpListDone,
  type RsvpPlaceOf,
} from '@/lib/rsvp-layout-edit';
import { RSVP_ADDED_MAX, RSVP_ADDED_TEXT_MAX, rsvpAddedId, type RsvpAddedLine, type RsvpLookCard } from '@/lib/rsvp-look';
import { RSVP_ADDED_NAME } from '@/app/[slug]/_components/rsvp-lines';
import { RSVP_LINE_NAME } from '@/app/[slug]/_components/rsvp-canvas-parts';
import { MakerSheet } from './stages-studio-parts';
import { STAGE_EDIT_ROW_FIT } from './stage-panel/stage-edit';

/**
 * ＋ ↕ THE RSVP STAGE'S LIST CONTROLS — what the approved prototype added to the stage
 * (`prototypes/maker_rsvp_add_drag_group_2026-10-09.html`; owner's ruling 2026-10-09), each on a shipped piece:
 *
 *   · `RsvpAddLineSheet` — ＋ on the picked line's frame opens the SHIPPED sheet (`MakerSheet`, with the row every
 *     "Add above / below" sheet uses) offering ONLY what belongs on a reply page: Heading · Message. Never the
 *     invitation's scenes — the reason ＋ was switched off on this stage.
 *   · `RsvpLinePlaceRow` — Edit's LAST row (owner 2026-10-09: "always set this as the last row"): ↑ Earlier · ↓ Later ·
 *     Group · Remove, the same buttons `StageEdit` draws on every part (`ActionButton`; a step that cannot be taken
 *     keeps its button, grey, and a tap on it says why — never a dead tap).
 *   · `RsvpGroupPickBar` — GROUP: the lower third while lines are being picked for one background ("Group · pick the
 *     lines", how, "N picked", Done · Cancel). Drawn over the toolbar's own rows, inside it; the count is plain words
 *     (owner 2026-10-11: a frame only round what is pressed), Done and Cancel are the app's buttons.
 *   · `RsvpAddedEditRows` — a line the couple added: its words, in the app's typed row, and the one line that says it
 *     has no automatic words. It arrives EMPTY with that box open (controller 2026-10-10: no made-up word or date
 *     may ever print to a guest).
 *
 * EVERY CHANGE IS ONE EDIT (`RsvpLayoutEdit`), asked of the RSVP panel on a window event and saved through the
 * panel's ONE save (the size check, the draft door, the page told first). Nothing here writes.
 *
 * Loaded with the lazy RSVP panel (`maker-details`); nothing here is in the Maker's first load.
 */

/**
 * A button of the last row: `StageEdit`'s own (a share of the row, 44 px) — but NEVER NARROWER THAN ITS WORD
 * (`min-w-max`, no truncation). Four buttons share this row where every other part's has three, and at 375 px four
 * equal shares cut "Remove" by 6 px (measured 2026-10-10: 40 px of room for a 46 px word). Sized to their words the
 * four fit; and on a phone where they do not, the row obeys the app's own Button Rule 3a (`useFitRow`: the whole row
 * goes words-only, then icons-only — "all at the same time, not each") instead of cutting a word.
 */
const PLACE_STEP = '!h-11 !min-w-max !flex-1 !px-2';

/** Ask the RSVP panel to make one edit of the list (it answers on `RSVP_LIST_DONE_EVENT`). */
export function askRsvpListEdit(edit: RsvpLayoutEdit): void {
  window.dispatchEvent(new CustomEvent(RSVP_LIST_EDIT_EVENT, { detail: edit }));
}

/** What a thing of a screen's list is called — on its frame, in "You're editing" and in what is said about it. */
export function rsvpListName(config: unknown, part: RsvpLookCard, name: string): string {
  if (rsvpGroupId(name)) return 'Group';
  if (rsvpAddedId(name)) {
    const added = rsvpPlaceOf(config, part, name)?.added;
    return added ? RSVP_ADDED_NAME[added.k] : 'Line';
  }
  return RSVP_LINE_NAME[name] ?? name;
}

/**
 * ONE EDIT, MADE: the look to save, what to pick now and what to say — or why it was not made. The panel calls this
 * from its edit event; it is pure over the config it is handed.
 */
export function rsvpListEdited(config: unknown, edit: RsvpLayoutEdit): { look?: Record<string, unknown>; done: RsvpListDone } {
  const before = 'name' in edit ? rsvpPlaceOf(config, edit.part, edit.name) : 'line' in edit ? rsvpPlaceOf(config, edit.part, edit.line) : null;
  const res = rsvpLayoutEdit(config, edit);
  if (!res.ok) return { done: { edit, ok: false, said: rsvpRefusalWords(res.why, Boolean(before?.group), edit.do === 'step' ? edit.dir : -1) } };
  let said: string | null = null;
  if (edit.do === 'add') {
    const anchor = rsvpPlaceOf(config, edit.part, edit.anchor);
    said = RSVP_LIST_WORDS.added(RSVP_ADDED_NAME[edit.kind], edit.where, rsvpListName(config, edit.part, edit.anchor), Boolean(anchor?.group));
  } else if (edit.do === 'remove') said = RSVP_LIST_WORDS.removed(rsvpListName(config, edit.part, edit.line));
  else if (edit.do === 'group') said = RSVP_LIST_WORDS.grouped(edit.lines.length);
  else if (edit.do === 'ungroup') said = RSVP_LIST_WORDS.ungrouped;
  return { look: res.look, done: { edit, ok: true, pick: res.pick, said } };
}

/* ── ＋ the sheet ─────────────────────────────────────────────────────────── */

export function RsvpAddLineSheet({ where, anchorName, onAdd, onClose }: { where: 'above' | 'below'; anchorName: string; onAdd: (kind: RsvpAddedLine['k']) => void; onClose: () => void }) {
  return (
    <MakerSheet label={`Add ${where} ${anchorName}`} onClose={onClose}>
      <ul className="flex flex-col gap-0.5 pb-1" data-rsvp-add-sheet={where}>
        {RSVP_ADD_KINDS.map((kind) => (
          <li key={kind}>
            <button type="button" data-rsvp-add={kind} onClick={() => onAdd(kind)} className={STAGE_SHEET_ROW}>
              <span className="min-w-0 flex-1 truncate">{RSVP_ADDED_NAME[kind]}</span>
              <Plus aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2.4} />
            </button>
          </li>
        ))}
      </ul>
    </MakerSheet>
  );
}

/* ── Edit's last row ──────────────────────────────────────────────────────── */

/**
 * What each button of the last row does for the thing picked, and — where it cannot — the one sentence a tap on its
 * grey button says. `place` null: a line with no place in a list (the Hint: it stays at the card's foot).
 */
export function rsvpPlaceSteps(part: RsvpLookCard, name: string, place: RsvpPlaceOf | null, onGroup: () => void, groupsFull = false) {
  const inGroup = Boolean(place?.group);
  /** A GROUP is picked: its last row is Earlier · Later · Ungroup (the prototype's — it is never removed, only ungrouped). */
  const isGroup = place !== null && place.holds !== null;
  const foot = place === null;
  const step = (dir: -1 | 1) => () => askRsvpListEdit({ do: 'step', part, name, dir });
  return {
    earlier: place && place.at > 0 ? step(-1) : null,
    later: place && place.at < place.beside - 1 ? step(1) : null,
    /* A screen that already holds its four groups says so at the button, before a line is picked. */
    group: place && !inGroup && !isGroup && !groupsFull ? onGroup : null,
    remove: place?.added ? () => askRsvpListEdit({ do: 'remove', part, line: name }) : null,
    ungroup: isGroup ? () => askRsvpListEdit({ do: 'ungroup', part, group: name }) : null,
    why: {
      earlier: foot ? RSVP_LIST_WORDS.hint : RSVP_LIST_WORDS.first(inGroup),
      later: foot ? RSVP_LIST_WORDS.hint : RSVP_LIST_WORDS.last(inGroup),
      group: foot ? RSVP_LIST_WORDS.hint : inGroup ? RSVP_LIST_WORDS.inGroup : RSVP_LIST_WORDS.groupsFull,
      remove: RSVP_LIST_WORDS.ownLine,
    },
  };
}

export function RsvpLinePlaceRow({ steps, onWhy, className = '' }: { steps: ReturnType<typeof rsvpPlaceSteps>; onWhy: (words: string) => void; className?: string }) {
  const row = useRef<HTMLDivElement>(null);
  useFitRow(row);
  return (
    <div ref={row} className={`${SP_ROWS_ROW} row-start-4 ${className}`} data-rsvp-row="4" data-rsvp-place-row="">
      {/* A step with nowhere to go is still a button — grey (`waiting`) — and a tap on it says why (its own press does
          nothing; the tap is heard on the wrapper, which draws nothing): `StageEdit`'s own way. */}
      <span className="contents" data-rsvp-place="earlier" onClick={steps.earlier ? undefined : () => onWhy(steps.why.earlier)}>
        <ActionButton tone="neutral" icon={ArrowUp} label="Earlier" waiting={!steps.earlier} onClick={steps.earlier ?? undefined} className={PLACE_STEP} />
      </span>
      <span className="contents" data-rsvp-place="later" onClick={steps.later ? undefined : () => onWhy(steps.why.later)}>
        <ActionButton tone="neutral" icon={ArrowDown} label="Later" waiting={!steps.later} onClick={steps.later ?? undefined} className={PLACE_STEP} />
      </span>
      {steps.ungroup ? (
        /* 🫧 A group: Ungroup stands where Group and Remove stand for a line. */
        <span className="contents" data-rsvp-place="ungroup">
          <ActionButton tone="neutral" icon={Ungroup} label="Ungroup" onClick={steps.ungroup} className={PLACE_STEP} />
        </span>
      ) : (
        <>
          <span className="contents" data-rsvp-place="group" onClick={steps.group ? undefined : () => onWhy(steps.why.group)}>
            <ActionButton tone="neutral" icon={Group} label="Group" waiting={!steps.group} onClick={steps.group ?? undefined} className={PLACE_STEP} />
          </span>
          <span className="contents" data-rsvp-place="remove" onClick={steps.remove ? undefined : () => onWhy(steps.why.remove)}>
            <ActionButton tone="danger" icon={Trash2} label="Remove" waiting={!steps.remove} onClick={steps.remove ?? undefined} className={PLACE_STEP} />
          </span>
        </>
      )}
    </div>
  );
}

/* ── 🫧 Group: picking the lines ──────────────────────────────────────────── */

/** While lines are picked the stage's own panel (which lies over the toolbar's rows) stands aside — by rule, so no
 *  state can fall out of step with the bar being there. */
const PICKING_PANEL_RULE = '[data-maker-shell]:has([data-rsvp-group-picking]) [data-phone-chrome="panel"]{visibility:hidden!important;pointer-events:none!important}';

/**
 * THE LOWER THIRD WHILE LINES ARE PICKED FOR A GROUP (the prototype's picking mode): the toolbar's line reads
 * "Group · pick the lines", the four tools are away, one sentence says how, and one row says how many are picked
 * beside Done and Cancel. Done with fewer than two keeps its button, grey, and a tap says why.
 */
export function RsvpGroupPickBar({ count, onDone, onCancel, onWhy }: { count: number; onDone: () => void; onCancel: () => void; onWhy: (words: string) => void }) {
  const [lead, what] = RSVP_LIST_WORDS.pickTitle.split(' · ');
  const ready = count >= 2;
  return (
    <div data-rsvp-group-picking="" role="group" aria-label="Group" className="absolute inset-0 z-[5] flex flex-col rounded-t-2xl bg-[var(--sp-page)] px-[10px]">
      <style>{PICKING_PANEL_RULE}</style>
      <div aria-hidden className={STAGE_BAR_HANDLE}>
        <span className="h-1 w-10 rounded-full bg-[var(--sp-line2)]" />
      </div>
      <p data-rsvp-pick-title="" className={STAGE_BAR_LINE}>
        {lead} · <b className="font-semibold text-[var(--sp-ink)]">{what}</b>
      </p>
      <div className={SP_ROWS}>
        <p data-rsvp-row="1" data-rsvp-pick-how="" className={`${SP_ROWS_ROW} row-start-1 px-1 text-[13px] leading-snug text-[var(--sp-ink)]`}>
          {RSVP_LIST_WORDS.pickHow}
        </p>
        <div data-rsvp-row="2" className={`${SP_ROWS_ROW} row-start-2`}>
          <b data-rsvp-picked={count} aria-live="polite" className="min-w-0 flex-1 px-1 text-[15px] font-semibold text-[var(--sp-ink)]">
            {RSVP_LIST_WORDS.picked(count)}
          </b>
          <span className="contents" data-rsvp-pick-done="" onClick={ready ? undefined : () => onWhy(RSVP_LIST_WORDS.tooFew)}>
            <ActionButton tone="brand" main icon={Check} label="Done" waiting={!ready} onClick={ready ? onDone : undefined} />
          </span>
          <span className="contents" data-rsvp-pick-cancel="">
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onCancel} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── a line the couple added: its words ───────────────────────────────────── */

export function RsvpAddedEditRows({
  line,
  added,
  openNow,
  onType,
  onKeep,
}: {
  line: string;
  added: RsvpAddedLine;
  /** It was added a moment ago: its box opens, so the couple types straight away. */
  openNow: boolean;
  onType: (text: string) => void;
  onKeep: (text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  /* `TypedRow` opens when its ask CHANGES after it is drawn — so the ask is made one beat after this row arrives. */
  const [ask, setAsk] = useState(0);
  useEffect(() => {
    if (openNow) setAsk((n) => n + 1);
  }, [openNow, line]);
  const name = RSVP_ADDED_NAME[added.k];
  return (
    <>
      <div data-rsvp-row="1" className={`${SP_ROWS_ROW} row-start-1 ${STAGE_EDIT_ROW_FIT}`}>
        <TypedRow
          data="rsvp-added-words"
          attrs={{ 'data-rsvp-added-field': line }}
          name={name}
          value={added.t ?? ''}
          empty={name}
          placeholder={name}
          long={added.k === 'm'}
          maxLength={RSVP_ADDED_TEXT_MAX[added.k]}
          openAsk={ask}
          onType={onType}
          onKeep={onKeep}
        />
      </div>
      <p data-rsvp-row="2" data-rsvp-added-note="" className={`${SP_ROWS_ROW} row-start-2 px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]/70`}>
        {RSVP_LIST_WORDS.noAutomatic}
      </p>
    </>
  );
}

/** ＋ on this screen would be refused: it is full (said before the sheet opens, not after a pick). */
export function rsvpScreenIsFull(config: unknown, part: RsvpLookCard): boolean {
  return rsvpScreenCounts(config, part).added >= RSVP_ADDED_MAX;
}

export { RSVP_LIST_WORDS };
