import { LocaleSwitch, type MarketingLocale } from '@/lib/marketing-i18n';
import { FEATURES_HUB_PATHS } from '@/lib/feature-pages';

// The /features hub's opening (rewritten 2026-10-01, DECISION_LOG "/FEATURES —
// THE FULL LIST" + prototypes/sidebar_collapse_and_features_2026-10-01_fable.html
// frame E). Phone first: a title of ≤5 words and ONE line of ≤12, so the first
// group of features lands in the top third of a 390 px screen. The old hero's
// CTA block and long paragraph went: the page's job is now to SHOW the
// features, and the one start button lives at the bottom (FinalCTA).

const COPY: Record<MarketingLocale, { title: string; line: string }> = {
  en: {
    title: 'Everything Setnayan does',
    line: 'Plan, invite, celebrate, remember — and for suppliers, get booked.',
  },
  tl: {
    title: 'Lahat ng kaya ng Setnayan',
    line: 'Magplano, mag-imbita, magdiwang, mag-alala — at sa suppliers, ma-book.',
  },
};

export function FeaturesHero({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section className="bg-cream">
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-8 sm:px-6 sm:pt-14">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-5xl">{c.title}</h1>
          <LocaleSwitch locale={locale} paths={FEATURES_HUB_PATHS} />
        </div>
        <p className="mt-3 text-base text-ink/70 sm:text-lg">{c.line}</p>
      </div>
    </section>
  );
}
