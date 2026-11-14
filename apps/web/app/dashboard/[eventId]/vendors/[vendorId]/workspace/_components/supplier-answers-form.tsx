'use client';

import { useActionState, useState } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { ANSWER_MAX } from '@/lib/emcee-questions';
import { saveSupplierAnswers, type SaveAnswersState } from '../question-answers-actions';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export type AnswerRow = { questionId: string; prompt: string; hint: string | null; answer: string | null };

/**
 * The couple's answers to ONE supplier's questions — each a row of the ONE Field template (`TypedRow`, long + boxed:
 * the question above, the answer in a box under it; the supplier's hint inside the ⓘ). Saved IN PLACE (a save never
 * resets the screen): the line under Save says what happened. Each box also posts what it showed (`base:`), so two
 * hosts answering at once never overwrite each other (`lib/host-answers-merge.ts`).
 */
export function SupplierAnswersForm({
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
  rows: AnswerRow[];
}) {
  const [state, action, pending] = useActionState<SaveAnswersState, FormData>(saveSupplierAnswers, {
    status: 'idle',
  });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <div>
        {rows.map((r) => (
          <AnswerField key={r.questionId} row={r} />
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

function AnswerField({ row }: { row: AnswerRow }) {
  const [value, setValue] = useState(row.answer ?? '');
  return (
    <>
      {/* 👥 What this box showed — only a box this screen changes is saved. */}
      <input type="hidden" name={`base:${row.questionId}`} value={row.answer ?? ''} />
      <TypedRow
        name={row.prompt}
        about={row.hint ? { words: row.hint } : null}
        value={value}
        empty="Answer"
        long
        boxed
        maxLength={ANSWER_MAX}
        fieldName={`answer:${row.questionId}`}
        onKeep={(t) => setValue(t)}
      />
    </>
  );
}
