import { Clock } from 'lucide-react';

/**
 * PaymentUnderReview — shown on an add-on BUY page when the couple has a LIVE
 * order that is NOT YET admin-approved (status 'submitted' — payment under
 * review). The payment handshake (owner 2026-06-18): the feature GATE
 * (eventSkuActive) withholds the live feature until the Setnayan team verifies
 * payment, so this replaces a misleading "unlocked" state and tells the couple
 * why their just-bought add-on isn't live yet. No buy-CTA renders alongside it
 * (eventOwnsSku still counts the pending order → double-buy prevention).
 *
 * `feature` is a short noun phrase, e.g. "cinematic opening", "animated
 * monogram", "guest QR codes" — rendered as "Your {feature} goes live …".
 */
export function PaymentUnderReview({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/60 px-5 py-4">
      <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} />
      <p className="text-sm text-amber-800">
        <span className="font-medium">Payment under review.</span> Your {feature} goes live the
        moment our team confirms your payment — usually within a day.
      </p>
    </div>
  );
}
