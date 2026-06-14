import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LocaleSwitch, type MarketingLocale } from '@/lib/marketing-i18n';

// Features-page hero. Per iteration 0015 § Routes — /features is the
// "deep-dive (each tab + service explained more)" surface for couples
// who want depth before applying. The hero stays restrained: editorial
// promise, single primary CTA. No vendor toggle here — vendor visitors
// have their own /for-vendors page.
//
// Copy is bilingual (EN + Taglish) — see _copy notes in _PageBody.tsx.

const FEATURES_PATHS = { en: '/features', tl: '/tl/features' };

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    bodyA: string;
    bodyB: string;
    ctaTitle: string;
    ctaSub: string;
  }
> = {
  en: {
    eyebrow: 'For couples · the full feature catalog',
    titleLine1: 'Every part of your event,',
    titleLine2: 'in one place.',
    bodyA:
      'From the first guest invite to the same-day highlight reel — here’s everything Setnayan does. Read as much or as little as you want; when you’re ready, sign up and pick the à-la-carte SKUs your event needs. Fixed PHP prices live on ',
    bodyB: '.',
    ctaTitle: 'Start planning · free',
    ctaSub: 'Fixed PHP prices · no card',
  },
  tl: {
    eyebrow: 'Para sa couples · ang buong feature catalog',
    titleLine1: 'Bawat parte ng event mo,',
    titleLine2: 'nasa isang lugar.',
    bodyA:
      'Mula sa unang guest invite hanggang sa same-day highlight reel — eto lahat ng ginagawa ng Setnayan. Basahin mo lang kung gaano karami ang gusto mo; pag ready ka na, mag-sign up at piliin ang à-la-carte SKUs na kailangan ng event mo. Fixed PHP prices, nasa ',
    bodyB: '.',
    ctaTitle: 'Magsimula · free',
    ctaSub: 'Fixed PHP prices · walang card',
  },
};

export function FeaturesHero({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              {c.eyebrow}
            </p>
            <LocaleSwitch locale={locale} paths={FEATURES_PATHS} />
          </div>
          <h1 className="font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {c.titleLine1}
            <span className="block text-ink/65">{c.titleLine2}</span>
          </h1>
          <p className="max-w-2xl text-lg text-ink/70">
            {c.bodyA}
            <Link
              href="/pricing"
              className="underline decoration-ink/30 underline-offset-2 hover:text-terracotta hover:decoration-terracotta"
            >
              /pricing
            </Link>
            {c.bodyB}
          </p>
          <div className="pt-2">
            <Link
              className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm sm:max-w-xs"
              href="/signup"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">{c.ctaTitle}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  {c.ctaSub}
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
