'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { answerKeyOf, answerValueOf, type AnswerChoice, type EventAnswerColumn } from '@/lib/event-answers';
import { useStudioActions } from './studio-actions-context';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { FormRows, SwitchRow } from '@/app/_components/form-row';

/**
 * 🗂 YOUR INFO — THE ONBOARDING'S ANSWERS, CHANGED WHERE THEY LIVE (owner
 * 2026-10-02, DECISION_LOG "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS
 * ("YOUR INFO") — ONE HOME, MAPPED").
 *
 *   · `AnswerPicker` — ONE dropdown (`PickMenu`, never a pill row) over ONE
 *     column (`lib/event-answers.ts`): Photos from guests · Gifts · Do you want
 *     a logo? · Event photo. It saves into the Event Hub DRAFT through the one
 *     draft door (`hubDraftAction`, the same door the Names and the Name style
 *     use) — a Maker edit waits for Apply (`lib/hub-draft.ts`
 *     `HUB_DRAFT_ANSWER_COLUMNS`). +0 server actions.
 *     In the new Maker's Studio a Yes/No answer is a SWITCH, not a dropdown (`as="switch"`, owner 2026-10-09 — "Accept gifts?" on
 *     Studio › E-Gifts; INTERACTION_RULES § 9: two options are a toggle). It is the SAME pick, the same write, the same
 *     failure: the switch is `SwitchRow` (the Form row's), and a refusal is said under it and puts the switch back.
 *   · (`EventSettingsEditor` moved OUT of the Maker 2026-10-02 to
 *     `details/_components/event-settings-editor.tsx`: its three editors save
 *     live through their own actions, and nothing in the Maker may take effect
 *     before Apply.)
 *
 * Loaded with the other Details pieces, never with the Maker (`details-lazy.tsx`).
 */

const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

export function AnswerPicker({
  eventId,
  column,
  label,
  choices,
  saved,
  as = 'dropdown',
}: {
  eventId: string;
  column: EventAnswerColumn;
  /** The question, in the event's words ("Photos from your guests?"). */
  label: string;
  choices: readonly AnswerChoice[];
  /** The column as the couple is editing it (the draft over live). */
  saved: boolean | null;
  /** 'switch' = a Yes/No answer as the Form row's switch (the Studio); the default is the dropdown every other door keeps. */
  as?: 'dropdown' | 'switch';
}) {
  /* The Maker's draft door — the shipped action, or (only in the dev lab) a stand-in that reaches no database. */
  const { hubDraftAction } = useStudioActions();
  const initial = answerKeyOf(column, saved);
  const [shown, setShown] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef(initial);
  const stored = useRef(initial);
  /* 🔁 The draft is the one value: Undo, Apply or the same question answered in
     its other place (the guided step's sheet, the item's own strip) move it, and
     this follows — never while a pick of its own is on its way. */
  useEffect(() => {
    if (pending || initial === stored.current) return;
    stored.current = initial;
    latest.current = initial;
    setShown(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the saved answer only
  }, [initial]);

  const pick = (key: string) => {
    const value = answerValueOf(column, key);
    if (value === undefined || key === latest.current) return;
    latest.current = key;
    setShown(key);
    setError(null);
    start(async () => {
      let ok = false;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { [column]: value } }));
        const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
        ok = r.ok;
      } catch {
        ok = false;
      }
      if (ok) {
        stored.current = key;
        return;
      }
      if (latest.current === key) {
        latest.current = stored.current;
        setShown(stored.current);
        setError(NOT_SAVED);
      }
    });
  };

  if (as === 'switch') {
    return (
      <section data-answer={column} data-answer-value={shown} aria-busy={pending || undefined} className="flex flex-col">
        <FormRows data={`answer-${column}`}>
          <SwitchRow name={label} on={shown === 'yes'} onChange={(on) => pick(on ? 'yes' : 'no')} data={`answer-${column}`} problem={error} />
        </FormRows>
      </section>
    );
  }

  return (
    <section data-answer={column} data-answer-value={shown} aria-busy={pending || undefined} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <PickMenu
          label={label}
          value={shown}
          options={choices.map((c): PickOption => ({ key: c.key, label: c.label }))}
          onPick={pick}
          dataAttr="data-answer-pick"
          {...(shown === '' ? { buttonText: 'Choose' } : {})}
        />
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
