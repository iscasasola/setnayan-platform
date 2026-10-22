import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';
import { REFUND_REPORT_WINDOW_DAYS } from '@/lib/rule-constants';


// 1hr Vercel edge cache to match the other static marketing/legal routes.

/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

export const metadata = {
  title: 'Refund & cancellation policy',
  description:
    'Setnayan does not refund purchases. If you paid for a service you then cannot use, its value becomes Papic credits for your event. Payments to suppliers are settled with the supplier.',
  alternates: { canonical: '/refunds' },
  openGraph: {
    title: 'Refund & cancellation policy · Setnayan',
    description:
      'No refunds. A paid service you cannot use becomes Papic credits for your event.',
    url: '/refunds',
  },
};

/*
  🔒 NO REFUNDS — owner ruling 2026-10-08 (DECISION_LOG "NO REFUNDS — A SERVICE
  THEY CANNOT USE BECOMES VIRTUAL CREDITS, CONVERTED TO PAPIC"), reaffirmed
  2026-10-22. This page is the WORDING only. The admin refund tools stay in the
  code for Apple and legal edge cases; nothing here changes what they do.
*/
export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refunds & cancellations"
      meta="Effective 2026-10-23 · governed by Philippine law (incl. RA 7394, the Consumer Act)"
    >
      <LegalSection title="The short version">
        <p>
          What you buy from Setnayan is <strong>not refunded</strong>. If you
          paid for a service and then <strong>cannot use it</strong>, we turn
          what you paid into <strong>Papic credits for your event</strong>, so
          the value stays with your event.
        </p>
      </LegalSection>

      <LegalSection title="When a service can't be used">
        <p>Tell us when a service you paid for can&rsquo;t be used — for example:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>we could not deliver it;</li>
          <li>it doesn&rsquo;t work and we can&rsquo;t fix it;</li>
          <li>your event was called off before you could use it.</li>
        </ul>
        <p>We check the order, then:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            if you haven&rsquo;t used it yet, it can wait for your next event
            instead;
          </li>
          <li>
            otherwise we add Papic credits to your event worth what you paid
            for that service. Papic credits pay for the photos and clips your
            guests take on the day.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Charged twice or by mistake">
        <p>
          A charge made twice or in error is our mistake, not a purchase. Tell
          us and we return the extra payment to the GCash or bank account it
          came from.
        </p>
      </LegalSection>

      <LegalSection title="How to tell us">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Open the{' '}
            <Link href="/help" className="text-terracotta hover:underline">
              help center
            </Link>{' '}
            and tell us the order reference and what went wrong, within{' '}
            <strong>{REFUND_REPORT_WINDOW_DAYS} days</strong> of payment where possible.
          </li>
          <li>We check the order and reply with what we will do.</li>
          <li>Once we confirm, the Papic credits show on your event.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Purchases in the iPhone app">
        <p>
          Anything bought through Apple in the iPhone app is paid to Apple. A
          refund request for that purchase goes to Apple, under Apple&rsquo;s
          own terms.
        </p>
      </LegalSection>

      <LegalSection title="Supplier bookings are different">
        <p>
          When you book a supplier through Setnayan, you pay the supplier
          directly — Setnayan does not hold that money and charges no
          commission. A supplier&rsquo;s deposits, refunds and cancellation
          terms are their own, shown before you book, and settled between you
          and them. If something goes wrong, use <strong>Report a problem</strong>{' '}
          on the booking or the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>{' '}
          and we will help.
        </p>
      </LegalSection>

      <LegalSection title="Free & granted orders">
        <p>
          An order given free or as a grant involved no payment, so there is
          nothing to convert. If a grant was applied in error, tell us and
          we&rsquo;ll correct it.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Nothing in this policy takes away a right Philippine law gives you,
          including under the Consumer Act of the Philippines (RA 7394).
        </p>
      </LegalSection>

      <LegalSection title="Receipts">
        <p>
          Every paid order has an in-app transaction receipt on its order page.
          Where a BIR Official Receipt applies, Setnayan issues it separately.
          See the{' '}
          <Link href="/terms" className="text-terracotta hover:underline">
            terms of service
          </Link>{' '}
          for how payments and receipts work.
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Reach us any time via the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>
          . For data or privacy matters, email our Data Protection Officer at{' '}
          <a href="mailto:dpo@setnayan.com" className="text-terracotta hover:underline">
            dpo@setnayan.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
