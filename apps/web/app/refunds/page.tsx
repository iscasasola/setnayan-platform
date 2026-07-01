import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';

// 1hr Vercel edge cache to match the other static marketing/legal routes.
export const revalidate = 3600;

export const metadata = {
  title: 'Refund & cancellation policy · Setnayan',
  description:
    'When Setnayan refunds in-app purchases. Digital services are final once activated; a full refund is issued whenever Setnayan fails to deliver. How to request a refund under Philippine consumer law.',
  alternates: { canonical: '/refunds' },
  openGraph: {
    title: 'Refund & cancellation policy · Setnayan',
    description:
      'Digital services are final once activated; full refund if Setnayan fails to deliver.',
    url: '/refunds',
  },
};

export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refunds & cancellations"
      meta="Effective 2026-06-30 · governed by Philippine law (incl. RA 7394, the Consumer Act)"
    >
      <LegalSection title="The short version">
        <p>
          Setnayan sells <strong>digital services</strong> — monograms,
          save-the-date films, websites, Papic seats, livestream days, and the
          like. Because these are produced and delivered to you, a purchase is{' '}
          <strong>final once the service is activated</strong>. If we ever fail
          to deliver what you paid for, you get a <strong>full refund</strong>.
          That&rsquo;s the whole policy; the rest is detail.
        </p>
      </LegalSection>

      <LegalSection title="When a purchase is still refundable">
        <p>
          Before a service is activated, you can cancel for a full refund.
          &ldquo;Activated&rdquo; means the point where we begin producing or
          providing the thing you bought — for example:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>a monogram or save-the-date once its first render is generated;</li>
          <li>an event website once it is published to your slug;</li>
          <li>Papic / livestream / booth services once the event day begins or a seat QR is claimed;</li>
          <li>an AI planning subscription once the billing cycle starts.</li>
        </ul>
        <p>
          If you&rsquo;re not sure whether your order has activated yet, ask us
          via the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>{' '}
          before you pay or right after — we&rsquo;ll tell you honestly.
        </p>
      </LegalSection>

      <LegalSection title="When you always get a full refund">
        <p>You are entitled to a full refund whenever:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>we cannot deliver the service you paid for;</li>
          <li>the delivered service is materially defective and we can&rsquo;t fix it;</li>
          <li>you were charged in error or charged twice;</li>
          <li>
            you paid but the order was never activated within a reasonable time
            and you no longer want it.
          </li>
        </ul>
        <p>
          This is your right under the Consumer Act of the Philippines (RA 7394)
          and nothing in this policy removes it.
        </p>
      </LegalSection>

      <LegalSection title="How to request a refund">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Open the{' '}
            <Link href="/help" className="text-terracotta hover:underline">
              help center
            </Link>{' '}
            and tell us the order reference and what went wrong, within{' '}
            <strong>7 days</strong> of payment where possible.
          </li>
          <li>
            We respond within our standard support window and, if approved,
            return the money to the same channel you paid from (BDO or GCash).
          </li>
          <li>
            Refunds are typically completed within <strong>5–10 business
            days</strong> of approval, depending on the bank / wallet.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Vendor bookings are different">
        <p>
          When you book an outside vendor through Setnayan, you pay the vendor
          directly — Setnayan does not hold that money and charges no
          commission. Refunds, deposits, and cancellation terms for a vendor&rsquo;s
          own services are set by that vendor and handled between you and them.
          Setnayan can help mediate through the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>
          , but this refund policy covers Setnayan&rsquo;s own in-app services
          only.
        </p>
      </LegalSection>

      <LegalSection title="Complimentary & granted orders">
        <p>
          Orders activated through a complimentary grant or team comp involved
          no payment, so there is nothing to refund. If a grant was applied in
          error, contact us and we&rsquo;ll correct it.
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
