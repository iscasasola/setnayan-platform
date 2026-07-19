import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';

// GEO Phase G5 (2026-05-28) — canonical URL + enriched description.
// SEO/GEO Bucket 8 — 1hr Vercel edge cache so static marketing routes serve
// Google's crawl rate-limit budget without origin pressure.
export const revalidate = 3600;

export const metadata = {
  title: 'Terms of service · Setnayan',
  description:
    'The terms couples and vendors agree to when using Setnayan. Eligibility, account responsibilities, payments and refunds, content ownership, vendor rules, liability, and governing law (Philippines).',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of service · Setnayan',
    description: 'The terms couples and vendors agree to when using Setnayan.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Setnayan terms of service"
      meta="Effective 2026-06-30 · governed by the laws of the Republic of the Philippines"
    >
      <LegalSection title="Who we are">
        <p>
          Setnayan is a Philippines-first life-events platform. These terms are
          an agreement between you and Setnayan&rsquo;s operator. By creating an
          account or using the service, you agree to these terms, our{' '}
          <Link href="/privacy" className="text-terracotta hover:underline">
            privacy policy
          </Link>
          , our{' '}
          <Link href="/acceptable-use" className="text-terracotta hover:underline">
            acceptable use policy
          </Link>
          , and our{' '}
          <Link href="/refunds" className="text-terracotta hover:underline">
            refund policy
          </Link>
          . If you don&rsquo;t agree, please don&rsquo;t use Setnayan.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            You must be at least <strong>18 years old</strong> to create a
            Setnayan account. Event guests of any age may interact with an event
            they&rsquo;re invited to, under the host&rsquo;s responsibility.
          </li>
          <li>You must provide accurate information and keep it up to date.</li>
          <li>
            If you use Setnayan on behalf of a business, you confirm you&rsquo;re
            authorized to bind that business to these terms.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your account">
        <ul className="ml-5 list-disc space-y-1">
          <li>You&rsquo;re responsible for keeping your login credentials safe and for activity under your account.</li>
          <li>One account per person. Couples share an event through event membership.</li>
          <li>Tell us promptly if you suspect unauthorized use of your account.</li>
          <li>
            You can close your account at any time. We may suspend or close
            accounts that violate these terms or applicable law. Soft-deleted
            accounts are retained for 30 days before permanent removal, as
            described in the{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">
              privacy policy
            </Link>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Your use of Setnayan must follow our{' '}
          <Link href="/acceptable-use" className="text-terracotta hover:underline">
            acceptable use &amp; community guidelines
          </Link>
          . In short: nothing illegal, abusive, infringing, or harmful, and no
          attempts to break or misuse the platform. Violations can lead to
          content removal or account suspension.
        </p>
      </LegalSection>

      <LegalSection title="Payments, pricing & receipts">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            All Setnayan services are quoted before payment. You only pay what
            you&rsquo;ve agreed to. Pricing is in Philippine pesos.
          </li>
          <li>
            Where VAT or other taxes apply, they are handled per BIR rules and
            shown or noted at checkout.
          </li>
          <li>
            We issue an in-app <strong>transaction receipt</strong> for every
            paid order. Where a BIR Official Receipt applies, Setnayan issues it
            separately. The transaction receipt is for your records and is not
            itself a BIR OR.
          </li>
          <li>
            Refunds and cancellations are governed by our{' '}
            <Link href="/refunds" className="text-terracotta hover:underline">
              refund &amp; cancellation policy
            </Link>
            : digital services are final once activated, with a full refund
            whenever we fail to deliver.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Content you create">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            You own the content you put into Setnayan — guest lists, event
            details, photos, palettes, messages, and the like.
          </li>
          <li>
            You grant Setnayan a limited, worldwide, royalty-free license to
            host, display, and process your content solely to provide the
            service to you and your event&rsquo;s members. This license ends when
            you delete the content or your account, except for backups and where
            we must retain data by law.
          </li>
          <li>
            You&rsquo;re responsible for having the rights to the content you
            upload, and for honoring the privacy of guests and third parties.
          </li>
          <li>
            We don&rsquo;t sell or share your event data with third parties for
            their marketing.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your information & the content you share">
        <p>
          Setnayan is a self-service platform. The information you put in — your
          profile, your event details, the vendors you name, your story, and the
          people you add — is <strong>self-provided</strong>. We don&rsquo;t ask
          for a government ID and we don&rsquo;t independently verify that it&rsquo;s
          true. It&rsquo;s yours to enter and yours to keep accurate.
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            You&rsquo;re responsible for the accuracy of what you provide, and
            for keeping it up to date.
          </li>
          <li>
            You <strong>warrant that you have the right to share</strong> any
            content you upload or publish — including photos, likenesses, names,
            or details that belong to or depict other people. If you don&rsquo;t
            have that right, please don&rsquo;t upload it.
          </li>
          <li>
            For any event or guest media you choose to make public, you confirm
            you have the necessary permissions from the people shown in it.
          </li>
          <li>
            You agree not to impersonate anyone or misrepresent who you are or
            who you&rsquo;re acting for.
          </li>
        </ul>
        <p className="pt-2">
          Because we don&rsquo;t verify self-provided information, others should
          treat it as user-supplied rather than confirmed by Setnayan. The one
          exception is <strong>vendor identity verification</strong>: where a
          vendor is shown as verified, we&rsquo;ve checked that credential
          separately, as described for vendors below and in our{' '}
          <Link href="/privacy" className="text-terracotta hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Vendors">
        <ul className="ml-5 list-disc space-y-1">
          <li>Vendor profiles are published only when you choose to make them visible.</li>
          <li>You must accurately represent your business, services, and prices.</li>
          <li>
            Setnayan masks couples&rsquo; identities in chat until the couple
            chooses to share them. Don&rsquo;t solicit personal information
            couples haven&rsquo;t provided.
          </li>
          <li>
            When a couple books a vendor, payment is between the couple and the
            vendor. Setnayan does not hold those funds and charges no commission.
            Setnayan isn&rsquo;t a party to, and isn&rsquo;t responsible for, the
            services a vendor delivers off-platform.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Service availability">
        <p>
          Setnayan is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
          We aim for high availability but don&rsquo;t guarantee uninterrupted or
          error-free service. We&rsquo;ll communicate planned maintenance via
          in-app notifications where practical. We may add, change, or remove
          features over time.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers & liability">
        <p>
          To the fullest extent permitted by Philippine law, Setnayan&rsquo;s
          total liability for any claim arising from your use of the service is
          limited to the amount you paid us in the 12 months before the claim.
          We aren&rsquo;t liable for indirect or consequential losses, or for your
          dealings with third-party vendors you engage through or outside the
          platform. Nothing here limits liability that cannot be limited under
          Philippine law, including your statutory consumer rights.
        </p>
      </LegalSection>

      <LegalSection title="Suspension & termination">
        <p>
          You may stop using Setnayan and close your account at any time. We may
          suspend or terminate access if you breach these terms or the acceptable
          use policy, if required by law, or to protect users and the platform.
          Where appropriate we&rsquo;ll give notice and a chance to put things
          right.
        </p>
      </LegalSection>

      <LegalSection title="Governing law & disputes">
        <p>
          These terms are governed by the laws of the Republic of the
          Philippines. We&rsquo;d much rather resolve any concern directly —
          please reach the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>{' '}
          first. Any dispute that can&rsquo;t be resolved informally is subject to
          the exclusive jurisdiction of the proper courts of the Philippines,
          without prejudice to your rights under the Consumer Act (RA 7394) and
          other mandatory consumer-protection laws.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. Material changes will be announced via
          in-app notification at least 14 days before they take effect, unless a
          change is needed sooner for legal or security reasons. Continuing to
          use Setnayan after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Reach us via the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>
          . For data and privacy matters, contact our Data Protection Officer at{' '}
          <a href="mailto:iscasasolaii@gmail.com" className="text-terracotta hover:underline">
            iscasasolaii@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
