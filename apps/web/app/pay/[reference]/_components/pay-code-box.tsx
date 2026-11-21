import { CheckCircle2, Tag } from 'lucide-react';
import { submitPaymentProof } from '../actions';
import { payAmount } from '@/lib/pay-amount';

/**
 * 🎟 "Have a code?" on /pay step 1 — the inline-checkout drawer's collapsed toggle, on the shared pay page (EVERY
 * PAYMENT WALL TAKES A CODE, owner 2026-11-22). Collapsed until tapped (a native `<details>`, no client script), then
 * the drawer's own field and Apply. Apply posts `intent=apply_code` to the page's existing form action, which re-prices
 * the UNPAID order (`../pay-code.ts`). Once a code is on the order it reads "Code applied · …" instead — one per order.
 */
export function PayCodeBox({
  reference,
  applied,
  error,
}: {
  reference: string;
  applied: { code: string; offPhp: number } | null;
  error: string | null;
}) {
  if (applied) {
    return (
      <div className="mt-4 px-1" data-pay-code-applied="">
        <p className="flex items-center gap-2 text-xs font-semibold text-success-900">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          Code applied · {applied.code}
        </p>
        <p className="mt-0.5 font-mono text-xs text-success-800">{payAmount(applied.offPhp)} off · the total above is your new price</p>
      </div>
    );
  }
  return (
    <details className="group mt-4 rounded-lg bg-[rgb(var(--sn-frame-bg))] px-4 py-2.5 shadow-sn-frame" data-pay-code-box="" open={error ? true : undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-medium text-terracotta">
        <Tag aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Have a code?
      </summary>
      <form action={submitPaymentProof} className="space-y-2 pb-1 pt-1">
        <input type="hidden" name="intent" value="apply_code" />
        <input type="hidden" name="reference" value={reference} />
        <label htmlFor="pay-code" className="block text-xs font-medium text-ink/70">
          Enter your code
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input // field-ok: the inline-checkout drawer's own voucher field, reused as the ruling asks (one code box, one look)
            id="pay-code"
            name="code"
            type="text"
            required
            maxLength={16}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABCD1234"
            className="input-field flex-1 font-mono uppercase tracking-widest"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-ink/90"
          >
            Apply
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-danger-800" data-pay-code-error="">
            {error}
          </p>
        ) : (
          <p className="text-xs text-ink/70">Codes are case-insensitive. The price changes before you pay.</p>
        )}
      </form>
    </details>
  );
}
