import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Final CTA — primary "Start planning · free" + soft secondary supplier
// link. Per the homepage redesign pattern (single primary CTA, visually
// subordinate secondary). 2026-10-01: the old copy promised "the Setnayan
// Team will contact you within 24 hours … with a quote" — the concierge
// flow, not the self-serve sign-up this button opens. Rewritten to what the
// button does.

const COPY: Record<
  MarketingLocale,
  { eyebrow: string; heading: string; body: string; ctaPrimary: string; ctaSecondary: string }
> = {
  en: {
    eyebrow: 'Set na ‘yan. · it’s all set.',
    heading: 'Start free. Add only what your event needs.',
    body: 'The planning tools are free with every account. Paid features are one price each, listed on the pricing page — nothing is bundled in.',
    ctaPrimary: 'Start planning · free',
    ctaSecondary: 'I’m a supplier →',
  },
  tl: {
    eyebrow: 'Set na ‘yan. · set na lahat.',
    heading: 'Magsimula nang libre. Idagdag lang ang kailangan ng event mo.',
    body: 'Libre ang planning tools sa bawat account. Ang mga bayad na feature ay may kanya-kanyang presyo sa pricing page — walang naka-bundle.',
    ctaPrimary: 'Magsimula · libre',
    ctaSecondary: 'Supplier ako →',
  },
};

export function FinalCTA({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
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
              href="/for-suppliers"
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
