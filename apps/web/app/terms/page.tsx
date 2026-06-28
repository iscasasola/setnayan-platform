import Link from 'next/link';
import { Logo } from '@/app/_components/logo';

// GEO Phase G5 (2026-05-28) — canonical URL + enriched description.
// Description tightened from one-line generic to surface what couples +
// vendors are agreeing to when they sign up.
// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
//
// 2026-06-28 — rewritten from the 9-section "starter draft" into a
// launch-ready Terms of Service grounded in the live product rules
// (apply-then-pay, 0% commission / pay-vendor-directly, app receipt vs BIR
// OR, non-VAT V1 tax posture, RA 10173 + RA 8792, mandatory NSFW filter,
// per-event face-data scoping, force majeure, in-app dispute flow).
// ⚠ OWNER/COUNSEL: confirm the operating-entity legal name + registration
// numbers below and have PH counsel review before relying on this at a full
// public launch. Functional product rules are accurate as built.
export const revalidate = 3600;

export const metadata = {
  title: 'Terms of service · Setnayan',
  description:
    'The terms couples, vendors, and guests agree to when using Setnayan. Account responsibilities, payments and receipts, refunds, vendor terms, content and IP, privacy, disputes, and governing law.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of service · Setnayan',
    description:
      'The terms couples, vendors, and guests agree to when using Setnayan.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-cream">
      <Header />
      <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Terms of service
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Setnayan terms of service
          </h1>
          <p className="text-xs text-ink/55">
            Effective 2026-06-28 · Last updated 2026-06-28
          </p>
        </header>

        <Section title="Summary (not a substitute for the full terms)">
          <ul className="ml-5 list-disc space-y-1">
            <li>Setnayan is a planning platform and marketplace — not a wedding vendor or an escrow.</li>
            <li>
              You see a price before you pay. We charge <strong>0% commission</strong> on
              vendor bookings, and you pay vendors directly — Setnayan never holds your
              booking money.
            </li>
            <li>You own the content you create. You give us a limited licence to run the service for you.</li>
            <li>
              We process personal data under the Philippine Data Privacy Act (RA 10173);
              see the{' '}
              <Link href="/privacy" className="text-terracotta hover:underline">
                Privacy Policy
              </Link>
              .
            </li>
            <li>Philippine law governs these terms.</li>
          </ul>
        </Section>

        <Section title="1. Who we are & acceptance">
          <p>
            &ldquo;Setnayan&rdquo; (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a Philippines-first
            life-events platform operated by ICASA, a sole proprietorship registered with the
            Philippine Department of Trade and Industry (Business Name Reg. No. 8267788), based
            in Quezon City, Philippines. Version 1 of the service focuses on weddings.
          </p>
          <p className="mt-2">
            By creating an account, accessing, or using Setnayan (the &ldquo;Service&rdquo;) you
            agree to these Terms of Service (&ldquo;Terms&rdquo;) and to our{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">Privacy Policy</Link>,
            which is incorporated here by reference. If you don&rsquo;t agree, don&rsquo;t use the Service.
          </p>
        </Section>

        <Section title="2. Eligibility & your account">
          <ul className="ml-5 list-disc space-y-1">
            <li>You must be at least 18 years old to create an account.</li>
            <li>
              You&rsquo;re responsible for the accuracy of your information and for keeping your
              login credentials secure. You&rsquo;re responsible for activity under your account.
            </li>
            <li>
              One account per person. Couples and co-hosts collaborate on a single event through
              event membership and roles — not by sharing one login.
            </li>
            <li>
              We may suspend, restrict, or close an account that violates these Terms or
              applicable law. When an account is deleted, data is retained for 30 days before
              permanent removal, except where the law requires longer retention (e.g. tax and
              transaction records).
            </li>
          </ul>
        </Section>

        <Section title="3. The Service & marketplace role">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Setnayan provides planning tools (guest lists, seating, budget, timeline, mood
              board, an event website, and similar) and a marketplace that helps couples
              discover and message wedding vendors.
            </li>
            <li>
              For vendor bookings, Setnayan is a <strong>venue that connects couples and
              vendors</strong>. The agreement for a vendor&rsquo;s services is strictly between the
              couple and that vendor. Setnayan is not a party to it, does not supply those
              services, and is not responsible for a vendor&rsquo;s acts, omissions, pricing,
              quality, or no-shows.
            </li>
            <li>
              A &ldquo;Verified&rdquo; badge means a vendor completed our verification checks at a
              point in time. It is a signal, not a guarantee of performance — do your own due
              diligence before paying anyone.
            </li>
            <li>
              Separately, some features are <strong>Setnayan in-app services</strong> (for example
              Setnayan AI, Papic, Panood, the Animated Monogram, Pakanta, and the couple website
              upgrade). For those, Setnayan is the provider and these Terms plus the in-product
              description govern.
            </li>
          </ul>
        </Section>

        <Section title="4. Payments, pricing & receipts">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Apply-then-pay.</strong> Every Setnayan in-app service shows its price
              before you commit. You pay only what you&rsquo;ve agreed to.
            </li>
            <li>
              <strong>Vendor payments.</strong> Couples pay vendors directly. Setnayan charges{' '}
              <strong>0% commission</strong> and does not hold, escrow, or disburse vendor booking
              funds. Any payment terms, deposits, and refunds for a vendor booking are set by that
              vendor.
            </li>
            <li>
              <strong>Currency &amp; tax.</strong> Prices are in Philippine Pesos (PHP) and are
              the final amounts shown. Setnayan is currently a non-VAT-registered taxpayer, so
              in-app service prices are <strong>not</strong> subject to 12% VAT. Applicable taxes
              are accounted for by Setnayan as required by the BIR.
            </li>
            <li>
              <strong>Receipts.</strong> We issue an in-app <strong>transaction receipt</strong>{' '}
              for every paid order, downloadable from the order page. This is for your records and
              is <em>not</em> a BIR Official Receipt. Where a BIR Official Receipt applies,
              Setnayan issues it separately.
            </li>
            <li>
              <strong>Payment verification.</strong> During V1, payment is confirmed by uploading
              proof of payment, which our team reviews. Service activates once payment is verified.
            </li>
          </ul>
        </Section>

        <Section title="5. Refunds & cancellations">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              For Setnayan in-app services, you may request a refund via the{' '}
              <Link href="/help" className="text-terracotta hover:underline">help center</Link>{' '}
              within <strong>7 days</strong> of payment.
            </li>
            <li>
              Custom or AI-generated deliverables (for example a bespoke Animated Monogram, a
              Pakanta song, or a rendered video) are <strong>non-refundable once production has
              begun</strong>, because the work is made specifically for you.
            </li>
            <li>
              Refunds for vendor bookings are governed by your agreement with the vendor, not by
              Setnayan.
            </li>
          </ul>
        </Section>

        <Section title="6. Vendor terms">
          <ul className="ml-5 list-disc space-y-1">
            <li>Your vendor profile is published only when you choose to make it visible.</li>
            <li>
              You must represent your business, services, credentials, and prices accurately, and
              keep them current. You&rsquo;re responsible for your own tax compliance and for the
              services you deliver.
            </li>
            <li>
              Setnayan masks a couple&rsquo;s identity in chat until they choose to share it.
              Don&rsquo;t solicit personal information a couple hasn&rsquo;t volunteered, and
              don&rsquo;t use couple data for anything other than serving that couple&rsquo;s event.
            </li>
            <li>
              Subscriptions (where applicable) renew per the plan you select and can be cancelled
              from your dashboard; fees already paid for a started billing period are
              non-refundable unless required by law.
            </li>
            <li>
              Reviews are tied to real, completed events. Fabricated reviews, review manipulation,
              and self-reviews are prohibited and may result in removal or suspension.
            </li>
          </ul>
        </Section>

        <Section title="7. Content you create & licence">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              You own the content you put into Setnayan — guest lists, event details, photos,
              palettes, messages, and the like.
            </li>
            <li>
              You grant Setnayan a non-exclusive, worldwide, royalty-free licence to host,
              display, process, and adapt your content <strong>solely to provide the Service</strong>{' '}
              to you and your event&rsquo;s members (for example, generating your website, reels, or
              monogram). This licence ends when you delete the content or your account, except for
              copies we must keep by law or that others have already lawfully saved.
            </li>
            <li>
              We do not sell your event data, and we do not share it with third parties for their
              own marketing.
            </li>
            <li>
              <strong>AI-generated outputs.</strong> Designs, songs, and videos Setnayan generates
              for your event are licensed to you for personal, event-related use. Music in rendered
              outputs comes from Setnayan&rsquo;s own catalogue; don&rsquo;t substitute third-party
              copyrighted music into Setnayan renders.
            </li>
          </ul>
        </Section>

        <Section title="8. Acceptable use">
          <p>You agree not to:</p>
          <ul className="ml-5 mt-1 list-disc space-y-1">
            <li>break the law, infringe others&rsquo; rights, or upload content you don&rsquo;t have the rights to;</li>
            <li>
              upload sexual, hateful, harassing, or otherwise prohibited content. A safety filter
              runs on uploads and <strong>cannot be disabled</strong>;
            </li>
            <li>impersonate others, scrape the Service, resell access, or interfere with its operation or security;</li>
            <li>misuse QR codes, seat-claim links, or capture tools to access events or data you&rsquo;re not invited to.</li>
          </ul>
        </Section>

        <Section title="9. Guests & event participants">
          <p>
            Guests who interact with an event (RSVP pages, QR check-in, photo capture, the
            day-of experience) do so under these Terms and the host&rsquo;s privacy choices.
            Photo and face-recognition features are scoped to a single event, require consent at
            RSVP, and offer an opt-out. See the{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">Privacy Policy</Link>{' '}
            for how guest data is handled.
          </p>
        </Section>

        <Section title="10. Privacy & data protection">
          <p>
            We process personal data in accordance with the Philippine Data Privacy Act of 2012
            (RA 10173) and its IRR. The{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">Privacy Policy</Link>{' '}
            explains what we collect, how we use it, your rights (access, correction, objection,
            erasure, data portability), and how to reach our Data Protection Officer.
          </p>
        </Section>

        <Section title="11. Electronic signatures & contracts">
          <p>
            Where the Service supports signing a vendor contract online, both parties&rsquo;
            electronic signatures are legally recognized under the Philippine Electronic Commerce
            Act of 2000 (RA 8792). We store signature evidence (timestamp, IP, and device
            information) as an audit trail. Setnayan is not your legal counsel and the contract
            remains between the couple and the vendor.
          </p>
        </Section>

        <Section title="12. Intellectual property">
          <p>
            The Setnayan name, logo and symbol mark, the &ldquo;Set na &rsquo;yan&rdquo; brand
            line, the software, and the look and feel of the Service are owned by Setnayan and
            protected by law. We grant you a limited, revocable, non-transferable right to use the
            Service for its intended purpose. Don&rsquo;t copy, modify, or use our brand or
            software outside that purpose without our written permission.
          </p>
        </Section>

        <Section title="13. Disputes & resolution">
          <p>
            If something goes wrong, start with the in-app dispute flow or the{' '}
            <Link href="/help" className="text-terracotta hover:underline">help center</Link>{' '}
            — most issues are resolved fastest there. For disputes about a vendor booking, your
            primary recourse is against the vendor under your agreement with them; Setnayan may
            help facilitate but is not the counterparty.
          </p>
        </Section>

        <Section title="14. Service availability & force majeure">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We aim for
            high availability but don&rsquo;t guarantee uninterrupted or error-free operation, and
            we&rsquo;ll communicate planned maintenance in-app where practical. We&rsquo;re not
            liable for delays or failures caused by events beyond our reasonable control
            (&ldquo;force majeure&rdquo;) — including natural disasters, typhoons, power or network
            outages, government action, or third-party platform failures.
          </p>
        </Section>

        <Section title="15. Disclaimers & limitation of liability">
          <p>
            To the maximum extent permitted by Philippine law, Setnayan disclaims implied
            warranties of merchantability, fitness for a particular purpose, and non-infringement.
            Setnayan&rsquo;s total liability for any claim arising from the Service is limited to
            the amount you paid Setnayan in the 12 months before the claim. We are not liable for
            indirect, incidental, or consequential damages, or for the acts, omissions, or
            services of third-party vendors. Nothing here limits liability that cannot be limited
            under Philippine law.
          </p>
        </Section>

        <Section title="16. Indemnity">
          <p>
            You agree to indemnify and hold Setnayan harmless from claims arising out of your
            content, your use of the Service, your breach of these Terms, or — for vendors — the
            services you provide to couples.
          </p>
        </Section>

        <Section title="17. Changes to these terms">
          <p>
            We may update these Terms. We&rsquo;ll announce material changes via in-app
            notification at least <strong>14 days</strong> before they take effect. Continuing to
            use the Service after changes take effect means you accept the updated Terms.
          </p>
        </Section>

        <Section title="18. Governing law & venue">
          <p>
            These Terms are governed by the laws of the Republic of the Philippines, without
            regard to conflict-of-laws rules. The proper courts of Quezon City, Metro Manila have
            exclusive jurisdiction, subject to any mandatory consumer-protection venue rights you
            have under Philippine law.
          </p>
        </Section>

        <Section title="19. Contact">
          <p>
            Questions about these Terms? Reach us through the{' '}
            <Link href="/help" className="text-terracotta hover:underline">help center</Link>.
          </p>
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center text-ink">
          <Logo height={32} withWordmark />
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/5">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-8 text-xs text-ink/55 sm:px-6 lg:px-8">
        <Link href="/" className="hover:text-ink">Home</Link>
        <Link href="/help" className="hover:text-ink">Help</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      </div>
    </footer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-sm text-ink/75">{children}</div>
    </section>
  );
}
