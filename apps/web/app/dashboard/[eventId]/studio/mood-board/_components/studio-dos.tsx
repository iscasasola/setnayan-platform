'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { STUDIO_GROUP, STUDIO_GROUP_HEAD } from '@/lib/studio-skin';
import { DOS_LOOKS, DOS_LOOK_DEFAULT, resolveDosLook } from '@/lib/dress-code-looks';
import { MOOD_BOARD_NOT_SAVED } from '@/lib/studio-mood-board-saves';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import { plainRefusal } from '../../../guests/_components/plain-refusal';
import { HubDraftField } from '../../../website/_components/hub-draft-field';
import { DraftsAsYouGo } from '../../../website/editor/_components/drafts-as-you-go';
import { useSceneCanvas } from '../../../website/editor/_components/use-scene-canvas';
import { useMoodBoardActions } from './mood-board-actions-context';
import { INC_DRESS_CODE_STARTER_NOTE } from './inc-dress-code-starter';

/**
 * ✅ STUDIO › MOOD BOARD & DRESS CODE › DO'S & DON'TS — on the templates (2026-10-09).
 *
 * The SAME two lists over the SAME stored lists (`events.dress_code_config.dos` / `.donts` — the guest's dress-code scene reads
 * nothing else) and the SAME write: one `<form>` whose action is `updateDressCodeLists`, carrying `HubDraftField` (so it lands in the
 * couple's draft, published by ✓ Apply) and drafted by `DraftsAsYouGo settle` when a row is KEPT (tap out · Enter) — never mid-word.
 * What changed is only the drawing: each entry is a Form row (`TypedRow` with `fieldName`, so the kept words are POSTED under
 * `dos` / `donts` exactly as the bare inputs posted them); adding and removing are the one ActionButton; and the look the two lists
 * are drawn in on the guest's page (`canvas.dos`, the toolbar's old Do's & Don'ts cards) is a dropdown row on top.
 *
 * ⚡ Loaded with the studio (`mood-board-lazy.tsx`, the `maker-mood-board` chunk) — never the Maker's first load. It replaces the
 * server-built `DressCodeListsForm` + `ListField` in this one place; the shipped Dress code editor keeps them.
 */

const ITEM_MAX = 80;
const LIST_MAX = 8;
const TONE = {
  do: { head: 'Do', name: 'Do', empty: 'e.g. Lean into the palette' },
  dont: { head: 'Don’t', name: 'Don’t', empty: 'e.g. Skip jeans' },
} as const;

/** A row's identity for React — never rendered. Each row keeps its own id, so removing one above another never swaps their words. */
let rowSeq = 0;
const row = (value: string) => ({ id: rowSeq++, value });

export type StudioDosProps = {
  eventId: string;
  dos: string[];
  donts: string[];
  /** The lists hold the INC starter guidance, not a saved answer. */
  incStarter?: boolean;
  /** The Dress code scene's canvas (drafted over live) — absent where the event has no Dress code scene (no look to pick). */
  lookCanvas?: HubSectionCanvas | null;
};

export function StudioDos({ eventId, dos, donts, incStarter = false, lookCanvas = null }: StudioDosProps) {
  const { updateDressCodeLists } = useMoodBoardActions();
  const [problem, setProblem] = useState<string | null>(null);
  /* The form's own action, wrapped only to SAY a failure: a refused or dropped save used to throw into the page. The fields are the form's. */
  const submit = async (fd: FormData) => {
    try {
      await updateDressCodeLists(eventId, fd);
      setProblem(null);
    } catch {
      setProblem(MOOD_BOARD_NOT_SAVED.lists);
    }
  };
  return (
    <section data-mood-board-dress-lists="" className="flex flex-col">
      {lookCanvas ? <DosLook eventId={eventId} canvas={lookCanvas} /> : null}
      {incStarter ? (
        <p role="note" data-inc-dress-code-starter="" className="px-1.5 pb-1 pt-3 text-[12.5px] text-ink/65">
          {INC_DRESS_CODE_STARTER_NOTE}
        </p>
      ) : null}
      <form action={submit} className="flex flex-col">
        <HubDraftField />
        {/* Keyed on the saved list: a save made in the Dress code scene redraws these rows instead of leaving the old ones to be saved back. */}
        <DosList key={`dos:${dos.join('\u0001')}`} field="dos" tone="do" initial={dos} />
        <DosList key={`donts:${donts.join('\u0001')}`} field="donts" tone="dont" initial={donts} />
        <DraftsAsYouGo settle />
      </form>
      {problem ? (
        <p role="alert" data-mood-board-save="error" className="px-1.5 pt-2 text-[12.5px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

function DosList({ field, tone, initial }: { field: 'dos' | 'donts'; tone: 'do' | 'dont'; initial: string[] }) {
  const t = TONE[tone];
  /* At least one editable row, so a brand-new event has somewhere to type into. */
  const [rows, setRows] = useState(() => (initial.length > 0 ? initial : ['']).map(row));
  return (
    <div data-dress-code-list={field}>
      <p className={STUDIO_GROUP_HEAD}>{t.head}</p>
      <div className={STUDIO_GROUP}>
        <FormRows data={`dress-${field}`}>
          {rows.map((r, i) => (
            <TypedRow
              key={r.id}
              name={`${t.name} ${i + 1}`}
              value={r.value}
              empty={t.empty}
              placeholder={t.empty}
              maxLength={ITEM_MAX}
              fieldName={field}
              onKeep={(text) => {
                setRows((prev) => prev.map((p) => (p.id === r.id ? { ...p, value: text } : p)));
                return { ok: true };
              }}
              below={
                rows.length > 1 ? (
                  <div className="flex justify-end pb-2">
                    <ActionButton tone="neutral" quiet iconOnly icon={X} label={`Remove ${t.name} ${i + 1}`} onClick={() => setRows((prev) => prev.filter((p) => p.id !== r.id))} />
                  </div>
                ) : null
              }
            />
          ))}
        </FormRows>
      </div>
      {rows.length < LIST_MAX ? (
        <div className="px-1.5 pt-2">
          <ActionButton tone="neutral" icon={Plus} label="Add another" onClick={() => setRows((prev) => [...prev, row('')])} />
        </div>
      ) : (
        <p className="px-1.5 pt-2 text-[12.5px] text-ink/55">That’s the cap — {LIST_MAX} keeps the list scannable for guests.</p>
      )}
    </div>
  );
}

/**
 * 🧾 HOW THE DO'S & DON'TS ARE DRAWN (`canvas.dos` on the Dress code scene — Two notes · Ticks and crosses · Side by side), the pick the
 * toolbar's Style used to carry as cards (owner, decided 2026-10-09: it moves HERE). The same write the toolbar made: the scene's whole
 * canvas through the one scene-canvas door (`useSceneCanvas`), held and redrawn in place, with the Maker keeping its own copy
 * (`noteDraftedCanvas`) so a Style pick right after builds on it. "Two notes" is the absence (it clears the key).
 */
function DosLook({ eventId, canvas }: { eventId: string; canvas: HubSectionCanvas }) {
  const { hubDraftAction } = useMoodBoardActions();
  const { shown, save, pending, error } = useSceneCanvas(
    eventId,
    'dress_code',
    draftedCanvasOr('dress_code', canvas),
    hubDraftAction,
    (next) => noteDraftedCanvas('dress_code', next, canvas),
    { redraw: true },
  );
  return (
    <div data-dos-look="" className={STUDIO_GROUP}>
      <FormRows data="dress-look">
        <ChosenRow
          name="How they look"
          label="How your do’s and don’ts look to guests"
          value={resolveDosLook(shown.dos)}
          dataAttr="data-dos-look-pick"
          options={DOS_LOOKS.map((o) => ({ key: o.id, label: o.name, hint: o.line }))}
          onPick={(id) => {
            const look = DOS_LOOKS.find((o) => o.id === id)?.id;
            if (!look || pending || look === resolveDosLook(shown.dos)) return;
            save((c) => {
              if (look === DOS_LOOK_DEFAULT) delete c.dos;
              else c.dos = look;
            });
          }}
          problem={error ? plainRefusal(error, MOOD_BOARD_NOT_SAVED.look) : null}
        />
      </FormRows>
    </div>
  );
}
