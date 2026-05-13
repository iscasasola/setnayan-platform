import Link from 'next/link';

export const metadata = {
  title: 'Terms of service · Setnayan',
  description: 'Setnayan terms of service.',
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
          <p className="text-xs text-ink/55">Effective 2026-05-13 · Starter draft</p>
        </header>

        <Section title="Starter draft">
          <p>
            This is a starter draft pending legal review. Functional product rules are
            accurate; legal phrasing will be refined before any public launch.
          </p>
        </Section>

        <Section title="Who we are">
          <p>
            Setnayan is a Philippines-first life-events platform operated from Quezon City.
            V1 focuses on weddings.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="ml-5 list-disc space-y-1">
            <li>You must be at least 18 to create an account.</li>
            <li>You&rsquo;re responsible for keeping your password safe.</li>
            <li>One account per person. Couples share an event via event_members.</li>
            <li>
              We may suspend or close accounts that violate these terms or applicable law.
              Soft-deleted accounts are retained for 30 days before permanent removal.
            </li>
          </ul>
        </Section>

        <Section title="Payments + receipts">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              All Setnayan services are quoted before payment. You only pay what you&rsquo;ve
              agreed on with our team.
            </li>
            <li>
              We issue a BIR-compliant Official Receipt for every paid order, downloadable
              from the order detail page.
            </li>
            <li>
              Pricing is in PHP and inclusive of 12% VAT unless otherwise noted on the
              receipt.
            </li>
            <li>
              Refunds: contact us via the{' '}
              <Link href="/help" className="text-terracotta hover:underline">
                help center
              </Link>
              {' '}within 7 days of payment for refund eligibility.
            </li>
          </ul>
        </Section>

        <Section title="Content you create">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              You own the content you put into Setnayan — guest lists, event details, photos,
              palettes, messages.
            </li>
            <li>
              You grant Setnayan a limited license to display + process your content for the
              purpose of providing the service to you and your event&rsquo;s members.
            </li>
            <li>
              We don&rsquo;t sell or share your event data with third parties for marketing.
            </li>
          </ul>
        </Section>

        <Section title="Vendor terms">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Vendor profiles are published only when you toggle them visible.
            </li>
            <li>
              You must accurately represent your business, services, and prices.
            </li>
            <li>
              Setnayan masks couples&rsquo; identities in chat threads until the couple
              chooses to share. Don&rsquo;t solicit personal info couples haven&rsquo;t
              explicitly provided.
            </li>
          </ul>
        </Section>

        <Section title="Service availability">
          <p>
            Setnayan is provided &ldquo;as is&rdquo;. We aim for high availability but
            don&rsquo;t guarantee uptime. We&rsquo;ll communicate scheduled maintenance via
            the in-app notification system.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the extent permitted by Philippine law, Setnayan&rsquo;s liability for any
            claim is limited to the amount you paid us in the 12 months before the claim.
            We aren&rsquo;t liable for your relationships with third-party vendors you book
            outside the platform.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms. Material changes will be announced via in-app
            notification at least 14 days before they take effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Reach us via the{' '}
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
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
          >
            S
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
            Setnayan
          </span>
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
