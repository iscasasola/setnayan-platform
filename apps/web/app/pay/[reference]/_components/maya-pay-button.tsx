import { CreditCard } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitPaymentProof } from '../actions';

/**
 * 💳 "Pay with card or Maya" — ONE secondary button under the BDO QR (owner
 * 2026-11-21: an ADDITIONAL rail; BDO stays the default and unchanged).
 *
 * A server component: the page renders it only while the rail is open (switch
 * ON + both keys + within the one-payment ceiling) and hands it to the pay
 * panel as a slot, so no Maya code reaches the client bundle. The press posts
 * `intent=maya_checkout` to the page's existing form action, which re-checks
 * everything and sends the payer to Maya's hosted page
 * (lib/maya-checkout-start.server.ts).
 *
 * ⚖ No fee line, no surcharge: the payer pays the order total exactly and
 * Setnayan absorbs Maya's fee (owner ruling 3; `no-unruled-transfer-fee` guard).
 */
export function MayaPayButton({ reference }: { reference: string }) {
  return (
    <form action={submitPaymentProof} className="mt-4" data-pay-maya="">
      <input type="hidden" name="intent" value="maya_checkout" />
      <input type="hidden" name="reference" value={reference} />
      <SubmitButton
        className="button-secondary inline-flex h-11 w-full items-center justify-center gap-2"
        pendingLabel="Opening Maya…"
      >
        <CreditCard aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Pay with card or Maya
      </SubmitButton>
    </form>
  );
}
