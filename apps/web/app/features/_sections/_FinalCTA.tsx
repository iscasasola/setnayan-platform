import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Final CTA — primary "Start planning · free" + soft secondary
// "I'm a vendor →" linking to /for-vendors. Per the homepage redesign
// pattern (single primary CTA, visually subordinate secondary).

export function FinalCTA() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Set na &lsquo;yan. &mdash; it&rsquo;s all set.
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            That&rsquo;s the catalog. Want a quote for your event?
          </h2>
          <p className="text-base text-ink/65">
            Apply now and the Setnayan Team will contact you within 24 hours
            with your activation link and a quote shaped to your guest count,
            your venue, and the apparatus you actually want.
          </p>
          <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
            <Link
              className="button-primary inline-flex w-full items-center justify-center gap-2 px-8 text-sm sm:w-auto"
              href="/apply"
            >
              Start planning &middot; free
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              href="/for-vendors"
              className="text-sm font-medium text-ink/65 underline-offset-4 hover:text-ink hover:underline"
            >
              I&rsquo;m a vendor &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
