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
 *   • `today`  — on the supplier's Today page once they hold ANY upcoming
 *                booking (2026-09-19), so the door is one tap from home.
 *   • the supplier's chat, on an ACCEPTED quote card, uses `lock` — the
 *                couple's next step there is asking to book.
 *
 * Renders NOTHING for `ready` and for `unreadable`: telling a supplier they have
 * no payment method when the read merely failed would be a lie, and the cost of
 * silence is one missed prompt. The decision is `payoutReadinessOf` in
 * lib/deposit-pay-step.ts, which shares its visibility rule with the couple's
 * own fetch — so "a couple can see it" means the same thing on both sides.
 *
 * No hooks and no directive: a sentence and a link. It renders on the server
 * (Overview, client page) and inside the client chat stream alike.
 */
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';

/**
 * The payment-options surface lives in the My Shop hub's folds. `open` is the
 * hub's canonical key (`tab` is its legacy alias) and `#shop-folds` is the
 * anchor the fold sits under — without it the tap landed at the TOP of My
 * Shop with the open fold several screens down (owner, 2026-09-19: "accessing
 * where to upload payment options feels too deep").
 */
export const PAYMENT_OPTIONS_HREF = '/vendor-dashboard/shop?open=payments#shop-folds';

export function PayoutMethodNudge({
  readiness,
  context,
}: {
  readiness: PayoutReadiness;
  context: 'lock' | 'client' | 'today';
}) {
  if (readiness === 'ready' || readiness === 'unreadable') return null;

  const inReview = readiness === 'in_review';
  const body = inReview
    ? 'Your payment method is waiting for Setnayan’s review. Couples will see it as soon as it is approved.'
    : context === 'lock'
      ? 'Couples pay you directly, and you haven’t added a way to be paid yet. Add your bank, e-wallet or QR so they can send your deposit as soon as you agree.'
      : context === 'today'
        ? 'You have bookings, and your couples can’t see anywhere to pay you yet. Add your bank, e-wallet or QR so their deposits can reach you.'
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
