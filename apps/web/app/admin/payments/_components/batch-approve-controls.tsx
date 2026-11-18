'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';

/**
 * Batch-approve controls for the admin payments queue (fast-approval sprint).
 *
 * Speeds up reconciliation WITHOUT removing the human money-verification step:
 * the admin picks the rows they've reviewed and approves them in one submit.
 * Every selected id is re-verified server-side as a decisive clean match before
 * any write (see batchApprovePayments), so a checkbox can never force-approve a
 * mismatched or short payment. There is deliberately no select-all-and-force —
 * "select all" only ticks rows the queue already flagged as clean.
 *
 * The checkbox and the bar coordinate purely through the DOM: each checkbox
 * associates to the batch form via the `form` attribute (so it can sit inside a
 * row that already owns its own approve/reject forms — nesting <form>s is
 * invalid HTML), and the bar recounts checked boxes off the document `change`
 * event. No selection state has to thread through the server-rendered rows.
 */

const BATCH_FORM_ID = 'batch-approve-form';
const CHECKBOX_NAME = 'batch_payment_ids';

export function BatchApproveCheckbox({ paymentId }: { paymentId: string }) {
  return (
    <label className="inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center" title="Select for batch">
      <input
        type="checkbox"
        name={CHECKBOX_NAME}
        value={paymentId}
        form={BATCH_FORM_ID}
        className="h-5 w-5 cursor-pointer accent-success-700"
      />
      <span className="sr-only">Select for batch</span>
    </label>
  );
}

export function BatchApproveBar({
  action,
  totalCleanMatches,
}: {
  action: (formData: FormData) => void | Promise<void>;
  totalCleanMatches: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const recount = () => {
      setCount(
        document.querySelectorAll<HTMLInputElement>(`input[name="${CHECKBOX_NAME}"]:checked`).length,
      );
    };
    document.addEventListener('change', recount);
    recount();
    return () => document.removeEventListener('change', recount);
  }, []);

  function toggleAll(checked: boolean) {
    const boxes = document.querySelectorAll<HTMLInputElement>(`input[name="${CHECKBOX_NAME}"]`);
    boxes.forEach((el) => {
      el.checked = checked;
    });
    setCount(checked ? boxes.length : 0);
  }

  if (totalCleanMatches === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-[color:var(--m-line)] py-2"
      data-batch-approve=""
    >
      <span className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-[color:rgb(var(--color-ok))]">
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        {formatCount(totalCleanMatches)} clean match{totalCleanMatches > 1 ? 'es' : ''} ready
      </span>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-ink">
        <input
          type="checkbox"
          onChange={(e) => toggleAll(e.target.checked)}
          checked={count > 0 && count === totalCleanMatches}
          className="h-5 w-5 cursor-pointer accent-success-700"
        />
        Select all clean matches
      </label>
      <form id={BATCH_FORM_ID} action={action} className="ml-auto">
        <SubmitButton disabled={count === 0} pendingLabel="Approving…" className="ab ab-ok ab-main">
          Approve {count > 0 ? `${formatCount(count)} ` : ''}selected clean match{count === 1 ? '' : 'es'}
        </SubmitButton>
      </form>
    </div>
  );
}
