/**
 * PayoutMethodNudge — "couples can't see anywhere to pay you" (S19, 2026-09-18).
 *
 * Owner, live on the booking run: "there is no mode to pay the vendor the
 * deposit… the payment modes of the vendor must show." Measured the same day:
 * `vendor_payment_methods` had 0 rows in production — no supplier had ever set
 * one up, so the couple's pay sheet had nothing to show anywhere it was mounted.
 * The fix on the couple's side is a plain sentence; this is the other half: ask
 * the SUPPLIER, at the moment it matters —
 *   • `lock`   — beside "Agree to this booking" (the Overview feed card and the
 *                client page's answer panel), because agreeing is what makes
 *                the deposit the couple's next step;
 *   • `client` — on a booked client's page while their deposit is outstanding.
 *
 * Renders NOTHING for `ready` and for `unreadable`: telling a supplier they have
 * no payment method when the read merely failed would be a lie, and the cost of
 * silence is one missed prompt. The decision is `payoutReadinessOf` in
 * lib/deposit-pay-step.ts, which shares its visibility rule with the couple's
 * own fetch — so "a couple can see it" means the same thing on both sides.
 *
 * Server component: a sentence and a link, no client JS.
 */
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';

/** The payment-options surface lives in the My Shop hub (?tab=payments). */
export const PAYMENT_OPTIONS_HREF = '/vendor-dashboard/shop?tab=payments';

export function PayoutMethodNudge({
  readiness,
  context,
}: {
  readiness: PayoutReadiness;
  context: 'lock' | 'client';
}) {
  if (readiness === 'ready' || readiness === 'unreadable') return null;

  const inReview = readiness === 'in_review';
  const body = inReview
    ? 'Your payment method is waiting for Setnayan’s review. Couples will see it as soon as it is approved.'
    : context === 'lock'
      ? 'Couples pay you directly, and you haven’t added a way to be paid yet. Add your bank, e-wallet or QR so they can send your deposit as soon as you agree.'
      : 'This couple can’t see anywhere to pay you. Add your bank, e-wallet or QR so their deposit can reach you.';

  return (
    <div
      role="note"
      className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-surface, #fff)' }}
    >
      <Wallet
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
        style={{ color: 'var(--sn-gold-700)' }}
      />
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm text-ink/75">{body}</p>
        <Link
          href={PAYMENT_OPTIONS_HREF}
          className="inline-flex text-sm font-semibold text-ink underline underline-offset-2"
        >
          {inReview ? 'View your payment options' : 'Add a payment method'}
        </Link>
      </div>
    </div>
  );
}
