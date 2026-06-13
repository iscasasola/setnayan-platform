import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Final CTA — primary "Start planning · free" + soft secondary
// "I'm a vendor →" linking to /for-vendors. Per the homepage redesign
// pattern (single primary CTA, visually subordinate secondary).

const COPY: Record<
  MarketingLocale,
  { eyebrow: string; heading: string; body: string; ctaPrimary: string; ctaSecondary: string }
> = {
  en: {
    eyebrow: 'Set na ‘yan. — it’s all set.',
    heading: 'That’s the catalog. Want a quote for your event?',
    body: 'Apply now and the Setnayan Team will contact you within 24 hours with your activation link and a quote shaped to your guest count, your venue, and the apparatus you actually want.',
    ctaPrimary: 'Start planning · free',
    ctaSecondary: 'I’m a vendor →',
  },
  tl: {
    eyebrow: 'Set na ‘yan. — set na lahat.',
    heading: 'Yan ang catalog. Gusto mo ng quote para sa event mo?',
    body: 'Mag-apply na, at kokontakin ka ng Setnayan Team within 24 hours — kasama ang activation link mo at isang quote na hinubog para sa guest count mo, sa venue mo, at sa mga apparatus na talagang gusto mo.',
    ctaPrimary: 'Magsimula · free',
    ctaSecondary: 'Vendor ako →',
  },
};

export function FinalCTA({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.body}</p>
          <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
            <Link
              className="button-primary inline-flex w-full items-center justify-center gap-2 px-8 text-sm sm:w-auto"
              href="/signup"
            >
              {c.ctaPrimary}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              href="/for-vendors"
              className="text-sm font-medium text-ink/65 underline-offset-4 hover:text-ink hover:underline"
            >
              {c.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
