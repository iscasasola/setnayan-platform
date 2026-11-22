import { BadgeCheck, Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PAY_FREE_BUTTON, PAY_FREE_HEAD } from '@/lib/pay-code';
import { payAmount } from '@/lib/pay-amount';
import { submitPaymentProof } from '../actions';

/**
 * 🎟 ₱0 — A CODE COVERED THE WHOLE PRICE (controller 2026-11-22, the follow-up to #8130). The whole pay stage on that
 * route: what it is, ₱0, the code, and ONE button — "Send for confirmation". No Maya, no QR, no receipt upload. The
 * button posts `intent=confirm_free` to the page's existing form action (`../pay-code.ts` › `confirmFreeCode`), which
 * puts a ₱0 row in the admin's payments queue; an admin confirms it before anything switches on.
 */
export function PayFreeConfirm({
  reference,
  title,
  who,
  code,
  error,
}: {
  reference: string;
  title: string;
  who: string | null;
  code: { code: string; offPhp: number };
  error: string | null;
}) {
  return (
    <section className="mt-2 px-1" data-pay-free="">
      <h1 className="text-2xl font-semibold leading-tight text-ink">{title}</h1>
      {who ? <p className="mt-1 text-sm text-ink/70">{who}</p> : null}
      <p className="mt-4 text-[40px] font-bold leading-none tracking-tight tabular-nums text-ink">{payAmount(0)}</p>
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-success-900" data-pay-free-head="">
        <BadgeCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
        {PAY_FREE_HEAD}
      </p>
      <p className="mt-1 text-xs text-ink/70">
        Code {code.code} · {payAmount(code.offPhp)} off · reference {reference}
      </p>
      <p className="mt-4 text-sm text-ink/70">Our team confirms it, usually within 24 hours. Then it switches on.</p>
      <form action={submitPaymentProof} className="mt-4">
        <input type="hidden" name="intent" value="confirm_free" />
        <input type="hidden" name="reference" value={reference} />
        <ActionButton type="submit" tone="brand" main icon={<Send aria-hidden strokeWidth={1.9} />} label={PAY_FREE_BUTTON} />
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger-800" data-pay-code-error="">
          {error}
        </p>
      ) : null}
    </section>
  );
}
