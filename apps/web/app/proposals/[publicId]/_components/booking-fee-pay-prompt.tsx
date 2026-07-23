import { formatCentavos } from '@/lib/vendor-proposals';
import { SubmitButton } from '@/app/_components/submit-button';
import { bookingFeeInclusiveCentavos } from '@/lib/booking-fee-checkout';
import { startBookingFeeCheckout } from '../fee-actions';

/**
 * Shown on a vendor's DRAFT proposal when a pending booking-fee charge exists (the
 * send-gate opened one and blocked the send). The vendor pays it here — GCash or
 * card, each quoted INCLUSIVE (GCash = the fee; card = fee + ₱15, never a surcharge
 * line) — then re-sends the same draft, which now clears the gate. Only rendered
 * when a pending charge is present, so it's inert until the fee is enforced.
 */
export function BookingFeePayPrompt({
  chargeId,
  publicId,
  feeCentavos,
}: {
  chargeId: string;
  publicId: string;
  feeCentavos: number;
}) {
  const gcash = bookingFeeInclusiveCentavos(feeCentavos, 'gcash');
  const card = bookingFeeInclusiveCentavos(feeCentavos, 'card');

  return (
    <div className="w-full rounded-xl border border-terracotta/30 bg-terracotta/5 p-4 print:hidden">
      <p className="text-sm font-medium text-ink">
        A booking fee applies to send this proposal.
      </p>
      <p className="mt-0.5 text-xs text-ink/60">
        Pay it to send — you keep the rest. Choose how you&rsquo;d like to pay:
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={startBookingFeeCheckout}>
          <input type="hidden" name="charge_id" value={chargeId} />
          <input type="hidden" name="public_id" value={publicId} />
          <input type="hidden" name="method" value="gcash" />
          <SubmitButton
            pendingLabel="Opening GCash…"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream"
          >
            Pay {formatCentavos(gcash)} via GCash
          </SubmitButton>
        </form>
        <form action={startBookingFeeCheckout}>
          <input type="hidden" name="charge_id" value={chargeId} />
          <input type="hidden" name="public_id" value={publicId} />
          <input type="hidden" name="method" value="card" />
          <SubmitButton
            pendingLabel="Opening card…"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/80"
          >
            Pay {formatCentavos(card)} via card
          </SubmitButton>
        </form>
      </div>
      <p className="mt-2 text-[11px] text-ink/45">
        GCash has no added fee. Card includes a ₱15 processing fee.
      </p>
    </div>
  );
}
