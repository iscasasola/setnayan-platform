import type { ReactNode } from 'react';

/**
 * not-received-form.tsx — ONE form for "this payment never reached me". H4.
 *
 * Two doors lead to it — the supplier's payment section on the thread page and
 * the payment line on Decisions — and two doors to one request must be ONE
 * form, the rule `propose-new-time-form.tsx` set. What the ACTION reads lives
 * here once: the reason field's name, its limit and its wording.
 *
 * The action is passed in rather than imported: it is the SUPPLIER's
 * (`refuseVendorPayment`), and the shared Decisions component must not import a
 * supplier route's actions — the couple's page, which never gets this reply,
 * then cannot offer it by accident.
 *
 * 240 characters is the database's limit (event_vendors.deposit_decline_reason
 * and event_vendor_payments.payment_refusal_reason); the function trims to it
 * anyway, so the field's maxLength is a courtesy, not the gate.
 */
export const NOT_RECEIVED_REASON_MAX = 240;

export function NotReceivedForm({
  action,
  hidden,
  fieldClassName,
  submit,
}: {
  action: (formData: FormData) => Promise<void>;
  /** The payment's identity fields, exactly as the caller's other forms post them. */
  hidden: ReactNode;
  fieldClassName: string;
  submit: ReactNode;
}) {
  return (
    <form action={action} className="mt-2 flex w-full flex-col gap-2">
      {hidden}
      <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
        What you see on your side (optional — the couple is shown this)
        <textarea
          name="reason"
          rows={2}
          maxLength={NOT_RECEIVED_REASON_MAX}
          placeholder="e.g. Nothing from them in our GCash as of today."
          className={fieldClassName}
        />
      </label>
      <p className="text-[11px] text-ink/50">
        Nothing the couple sent is deleted. Setnayan checks it with both of you.
      </p>
      {submit}
    </form>
  );
}
