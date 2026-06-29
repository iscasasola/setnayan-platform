import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';

export const revalidate = 3600;

export const metadata = {
  title: 'Acceptable use policy · Setnayan',
  description:
    'The rules for content and conduct on Setnayan — for couples, vendors, and event guests. Prohibited content, the always-on NSFW filter, reporting and takedown, and enforcement.',
  alternates: { canonical: '/acceptable-use' },
  openGraph: {
    title: 'Acceptable use policy · Setnayan',
    description: 'Content and conduct rules for couples, vendors, and guests.',
    url: '/acceptable-use',
  },
};

export default function AcceptableUsePage() {
  return (
    <LegalLayout
      eyebrow="Acceptable use"
      title="Acceptable use & community guidelines"
      meta="Effective 2026-06-30 · part of the Setnayan terms of service"
    >
      <LegalSection title="Who this covers">
        <p>
          These rules apply to everyone who uses Setnayan — couples and event
          hosts, vendors, and the guests who upload photos and clips at an
          event (for example through Papic). By posting or sharing anything on
          Setnayan, you agree to follow them. They sit alongside our{' '}
          <Link href="/terms" className="text-terracotta hover:underline">
            terms of service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Content that isn't allowed">
        <p>Don&rsquo;t upload, post, or share content that:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>is illegal, or promotes illegal activity;</li>
          <li>
            is sexual content involving minors, or sexualizes anyone under 18 —
            zero tolerance, reported to authorities;
          </li>
          <li>is pornographic, obscene, or graphically violent;</li>
          <li>
            harasses, threatens, defames, or incites hatred or violence against
            people or groups;
          </li>
          <li>
            infringes someone else&rsquo;s copyright, trademark, or other rights
            (including uploading music or images you don&rsquo;t have the right
            to use);
          </li>
          <li>
            impersonates another person or business, or misrepresents who you
            are;
          </li>
          <li>
            contains malware, or is designed to phish, scam, or defraud
            others;
          </li>
          <li>
            shares someone&rsquo;s private information without their consent.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="The NSFW filter is always on">
        <p>
          For event galleries and capture services like Papic, our
          not-safe-for-work filter is enabled by default and{' '}
          <strong>cannot be turned off</strong>. It&rsquo;s there to protect
          couples, guests, and our team. Attempts to bypass it are a violation
          of this policy.
        </p>
      </LegalSection>

      <LegalSection title="Guest captures & consent">
        <p>
          Event capture features are for the celebration they belong to. Respect
          the people around you: don&rsquo;t photograph or share images of
          someone who has asked not to be, and honor opt-outs. Guests retain
          rights over their own likeness, and couples control their event
          gallery. How face and photo data are handled — including opt-out and
          deletion — is in the{' '}
          <Link href="/privacy" className="text-terracotta hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Don't abuse the platform">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            No scraping, bulk-harvesting, or automated access without our
            written permission.
          </li>
          <li>
            No probing, scanning, or attacking our systems or other
            users&rsquo; accounts.
          </li>
          <li>
            No reselling or sublicensing the service, and no using it to build a
            competing dataset.
          </li>
          <li>Don&rsquo;t interfere with the service or its security features.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Vendor conduct">
        <ul className="ml-5 list-disc space-y-1">
          <li>Represent your business, services, and prices accurately.</li>
          <li>
            Setnayan masks a couple&rsquo;s identity in chat until they choose
            to share it — don&rsquo;t pressure couples for personal details they
            haven&rsquo;t given.
          </li>
          <li>
            Don&rsquo;t use the platform to spam, mislead, or harass couples or
            other vendors.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Reporting & takedown">
        <p>
          If you see something that breaks these rules, report it through the{' '}
          <Link href="/help" className="text-terracotta hover:underline">
            help center
          </Link>{' '}
          or email{' '}
          <a href="mailto:dpo@setnayan.com" className="text-terracotta hover:underline">
            dpo@setnayan.com
          </a>
          . We review reports promptly and remove content that violates this
          policy. Rights-holders can also use these channels for copyright
          takedown requests.
        </p>
      </LegalSection>

      <LegalSection title="Enforcement">
        <p>
          Depending on severity, we may remove content, issue a warning, suspend
          a feature, or suspend and close an account. Serious violations — like
          content involving minors — are removed immediately and reported to the
          proper authorities. We act proportionately and, where appropriate,
          give you a chance to respond through the help center.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these guidelines as the product grows. Material changes
          are announced in-app before they take effect.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
