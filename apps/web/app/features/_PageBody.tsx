import { FeaturesHero } from './_sections/_Hero';
import { FeatureGroups } from './_sections/_FeatureGroups';
import { EcosystemBand } from './_sections/_Ecosystem';
import { WhySetnayan, WHY_FAQ } from './_sections/_WhySetnayan';
import { HowItWorks } from './_sections/_HowItWorks';
import { FinalCTA } from './_sections/_FinalCTA';
import { featuresHubItemList } from '@/lib/feature-pages/seo';
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
      // Every feature page, in the hub's order — from the one registry.
      featuresHubItemList(locale),
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
      <main className="min-h-dvh pb-16">
        {/* 2026-10-01 — THE HUB (DECISION_LOG "/FEATURES — THE FULL LIST" +
            "SIDEBAR COLLAPSE + FEATURES PAGE — OWNER ANSWERS"). The six
            numbered catalogue sections, the anchor-pill nav and the sticky
            phone CTA are gone: the five groups below are rendered from the one
            registry (`lib/feature-pages`), each feature linking to its own
            page. Phone first — the first group starts in the top third. The
            two framing sections folded in on 2026-09-01 (Why · How) stay,
            after the map: the frame for a reader who wants it, below the
            features for the one who came to see them. */}
        <FeaturesHero locale={locale} />
        <FeatureGroups locale={locale} />
        <EcosystemBand locale={locale} />
        <WhySetnayan locale={locale} />
        <HowItWorks locale={locale} />
        <FinalCTA locale={locale} />
      </main>
    </>
  );
}
