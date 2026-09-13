import { FeaturesHero } from './_sections/_Hero';
import { FeaturesAnchorNav } from './_sections/_AnchorNav';
import { WhySetnayan, WHY_FAQ } from './_sections/_WhySetnayan';
import { HowItWorks } from './_sections/_HowItWorks';
import { PlanningToolkit } from './_sections/_PlanningToolkit';
import { Communications } from './_sections/_Communications';
import { VendorsLedger } from './_sections/_VendorsLedger';
import { DayOfApparatus } from './_sections/_DayOfApparatus';
import { OutsourcingPacing } from './_sections/_OutsourcingPacing';
import { Compliance } from './_sections/_Compliance';
import { FinalCTA } from './_sections/_FinalCTA';
import { StickyMobileCTA } from './_sections/_StickyMobileCTA';
import {
  inLanguageTag,
  localeUrl,
  type LocalePaths,
  type MarketingLocale,
} from '@/lib/marketing-i18n';

// Shared body for the /features page — rendered by BOTH the English route
// (/features) and the Taglish route (/tl/features). The only difference
// between the two is the `locale` prop threaded into every section + the
// JSON-LD `inLanguage`/`url`. This is the "thin routes" half of the
// dictionary + thin-routes localization architecture (owner, 2026-06-13).

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

/** EN + Taglish path pair for /features — used by both routes' metadata. */
export const FEATURES_PATHS: LocalePaths = { en: '/features', tl: '/tl/features' };

function featuresJsonLd(locale: MarketingLocale) {
  const url = localeUrl(locale, FEATURES_PATHS);
  const name =
    locale === 'tl'
      ? 'Features deep-dive · Setnayan (Taglish)'
      : 'Features deep-dive · Setnayan';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Setnayan',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.svg`,
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        inLanguage: inLanguageTag(locale),
      },
      /*
        FAQPage — carried over from the retired /why-setnayan so its rich-result
        eligibility MOVES with the content rather than being dropped on the
        floor. Built from `WHY_FAQ`, the SAME constant the section renders: a
        rich result quoting an answer the page no longer shows is worse than no
        rich result at all, and two copies of an FAQ do not stay equal.
      */
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: inLanguageTag(locale),
        mainEntity: WHY_FAQ[locale].map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Features', item: url },
        ],
      },
    ],
  };
}

export function FeaturesPageBody({ locale }: { locale: MarketingLocale }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featuresJsonLd(locale)) }}
      />
      <main className="min-h-dvh">
        <FeaturesHero locale={locale} />
        <FeaturesAnchorNav locale={locale} />
        {/* The two framing sections, folded in 2026-09-01 from the retired
            /why-setnayan and /how-it-works. They come BEFORE the numbered
            catalogue deliberately: a reader needs the frame and the cast before
            the inventory. Section NUMBERING was left alone — these are
            orientation, not catalogue entries, so Sections 1–6 keep their
            labels and six files stayed shut. */}
        <WhySetnayan locale={locale} />
        <HowItWorks locale={locale} />
        <PlanningToolkit locale={locale} />
        <Communications locale={locale} />
        <VendorsLedger locale={locale} />
        <DayOfApparatus locale={locale} />
        <OutsourcingPacing locale={locale} />
        <Compliance locale={locale} />
        <FinalCTA locale={locale} />
        <StickyMobileCTA locale={locale} />
      </main>
    </>
  );
}
