'use client';

/**
 * The "Name your service" form. Its two typed fields are drawn with the ONE Field template (`TypedRow`,
 * boxed), posting `proposed_label` and `proposed_note` exactly as the raw boxes did. An empty or
 * too-short name shakes into view and nothing is sent (`nudgeFormRows`); the server checks it again
 * (`proposeCategory`, and the table's own 2–80 CHECK).
 */
import { useState, type ReactNode } from 'react';

import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { SubmitButton } from '@/app/_components/submit-button';
import { proposeCategory } from '@/app/vendor-dashboard/services/actions';
import { serviceNameProblem } from '@/lib/service-requests';

export function RequestNameForm({
  tileId,
  fromMaker,
  before,
  after,
}: {
  tileId: string;
  fromMaker: boolean;
  before: ReactNode;
  after: ReactNode;
}) {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  return (
    <form
      action={proposeCategory}
      className="space-y-4"
      data-request-form=""
      onSubmit={(event) => {
        if (nudgeFormRows(event.currentTarget) > 0) event.preventDefault();
      }}
    >
      {/* Survives the redirect so "Back to your card" still shows after submitting — server actions can't
          read the page's own URL. */}
      <input type="hidden" name="from_locked_kind" value={fromMaker ? '1' : ''} />
      <input type="hidden" name="tile_id" value={tileId} />
      {before}
    <FormRows width="wide">
      <TypedRow
        name="Service name"
        value={label}
        required
        boxed
        empty="e.g. Kakanin bilao"
        placeholder="e.g. Kakanin bilao"
        maxLength={80}
        check={(t) => serviceNameProblem(t)}
        fieldName="proposed_label"
        onKeep={(t) => setLabel(t)}
        note="2–80 characters. The words a couple would search."
        data="request-label"
      />
      <TypedRow
        name="What is it? (optional)"
        value={note}
        long
        boxed
        empty="A sentence so we place it right."
        placeholder="A sentence so we place it right."
        maxLength={400}
        fieldName="proposed_note"
        onKeep={(t) => setNote(t)}
        data="request-note"
      />
    </FormRows>
      {after}
      <SubmitButton className="button-primary min-h-11 w-full sm:w-auto" pendingLabel="Sending…">
        Send request
      </SubmitButton>
    </form>
  );
}
