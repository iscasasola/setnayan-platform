'use client';

/**
 * Your side of an open dispute — the drawing's opened row (tool pages redraw v3, 21 Nov 2026 · § 06): "Your response",
 * the box with what you wrote so far (the house `TypedRow`, a message box at rest too), the line under it and the one
 * main button. The SAME `submitDisputeContest` action and field (`vendor_contest`, 2,000 characters, required).
 */
import { useState } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { submitDisputeContest } from '../actions';

export function DisputeContestForm({
  disputeId,
  contest,
  contestedAgo,
}: {
  disputeId: string;
  contest: string;
  /** "1 day ago" — when the response was last written; null before the first one. */
  contestedAgo: string | null;
}) {
  const [words, setWords] = useState(contest);
  return (
    // A6-68: a refusal ("This dispute has already been reviewed …") is said under the box and the words stay.
    <StayForm door="svDisputes.submitDisputeContest" action={submitDisputeContest} resetOnSaved={false} className="flex flex-col gap-2.5">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <TypedRow
        name={contestedAgo ? `Your response · ${contestedAgo}` : 'Your response'}
        value={words}
        empty="Your side of the story"
        placeholder="Explain what happened from your side. The Setnayan team reads this before making any decision — attach dates, messages, or delivery proof you can reference."
        long
        boxed
        required
        maxLength={2000}
        fieldName="vendor_contest"
        onType={setWords}
        onKeep={(t) => setWords(t)}
        data="dispute-contest"
      />
      <p className="text-[14px] text-[color:var(--m-slate-2)]">The team reads this before deciding. You can edit it until they rule.</p>
      <div>
        <SubmitButton pendingLabel="Submitting…" className="button-primary text-sm">
          {contest ? 'Update my response' : 'Submit my response'}
        </SubmitButton>
      </div>
    </StayForm>
  );
}
