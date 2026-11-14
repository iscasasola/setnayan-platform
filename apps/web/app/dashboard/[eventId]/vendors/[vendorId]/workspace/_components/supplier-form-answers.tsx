'use client';

import { useActionState, useState } from 'react';
import { ChosenRow, TypedRow } from '@/app/_components/form-row';
import { ANSWER_MAX } from '@/lib/emcee-questions';
import { saveSupplierAnswers, type SaveAnswersState } from '../question-answers-actions';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export type FormAnswerRow = {
  questionId: string;
  prompt: string;
  hint: string | null;
  type: string;
  required: boolean;
  options: string[];
  answer: string | null;
};

const JOIN = ' · ';

/**
 * The couple answers ONE sent form, each line by its type — the house Field template only (`TypedRow` for words,
 * `ChosenRow` for a pick). Text answers only in this build (THE ONE BUILD §4): a pick is stored as its words, a
 * checkbox set as its words joined by " · ". Posts `answer:<id>` + `base:<id>` exactly as the shipped questions form,
 * so two hosts answering at once never overwrite each other. Saved in place; the line under Save says what happened.
 */
export function SupplierFormAnswers({
  eventId,
  vendorProfileId,
  returnPath,
  shopName,
  rows,
}: {
  eventId: string;
  vendorProfileId: string;
  returnPath: string;
  shopName: string;
  rows: FormAnswerRow[];
}) {
  const [state, action, pending] = useActionState<SaveAnswersState, FormData>(saveSupplierAnswers, { status: 'idle' });
  if (rows.length === 0) return null;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <div>
        {rows.map((r) => (
          <FormAnswerField key={r.questionId} row={r} />
        ))}
      </div>
      {/* 📐 Design template (14 Nov 2026, rule 3): the page's one main button is the shared terracotta pill. */}
      <ActionButton type="submit" tone="brand" main icon={Check} label={pending ? 'Saving…' : 'Save answers'} waiting={pending} />
      {state.status === 'saved' ? (
        <p role="status" className="text-[13px] text-ink/70">
          Saved — {shopName} can read your answers now.
        </p>
      ) : state.status === 'error' ? (
        <p role="alert" className="text-[13px] text-[rgb(var(--color-danger))]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function FormAnswerField({ row }: { row: FormAnswerRow }) {
  const [value, setValue] = useState(row.answer ?? '');
  const about = row.hint ? { words: row.hint } : null;
  const name = row.required ? `${row.prompt} · required` : row.prompt;
  const base = <input type="hidden" name={`base:${row.questionId}`} value={row.answer ?? ''} />;
  const choices = row.type === 'yes_no' ? ['Yes', 'No'] : row.options;

  if (row.type === 'multiple_choice' || row.type === 'dropdown' || row.type === 'yes_no') {
    return (
      <>
        {base}
        <input type="hidden" name={`answer:${row.questionId}`} value={value} />
        <ChosenRow
          name={name}
          about={about}
          value={value || null}
          buttonText={value || 'Pick one'}
          options={choices.map((o) => ({ key: o, label: o }))}
          onPick={(k) => setValue(k)}
        />
      </>
    );
  }
  if (row.type === 'checkboxes') {
    const picked = value ? value.split(JOIN) : [];
    return (
      <>
        {base}
        <input type="hidden" name={`answer:${row.questionId}`} value={value} />
        <ChosenRow
          name={name}
          about={about}
          value={null}
          buttonText={picked.length ? `${picked.length} picked` : 'Pick'}
          options={choices.map((o) => ({ key: o, label: o }))}
          picked={picked}
          onPick={(k) => {
            const next = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k];
            setValue(choices.filter((o) => next.includes(o)).join(JOIN));
          }}
        />
      </>
    );
  }
  const long = row.type === 'long_answer';
  return (
    <>
      {base}
      <TypedRow
        name={name}
        about={about}
        value={value}
        empty="Answer"
        long={long}
        boxed={long}
        required={row.required}
        inputMode={row.type === 'number' || row.type === 'measurement' ? 'numeric' : undefined}
        placeholder={row.type === 'date' ? 'e.g. 14 Feb 2027' : row.type === 'measurement' ? 'e.g. 34 inches' : undefined}
        maxLength={long ? ANSWER_MAX : 240}
        fieldName={`answer:${row.questionId}`}
        onKeep={(t) => setValue(t)}
      />
    </>
  );
}
