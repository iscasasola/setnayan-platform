/**
 * feature-pages/seo.ts — the search and AI-search tags for /features and every
 * /features/<slug>, in both locales (DECISION_LOG 2026-10-01 "EVERY FEATURE
 * PAGE, ARTICLE AND THE PAGES INSIDE THEM CARRY FULL SEARCH + AI-SEARCH
 * TAGGING").
 *
 * Built HERE, as plain functions over the registry, so ONE guard
 * (`app/features/features-tagging.test.ts`) can walk every route and both
 * locales without rendering a page: unique title + description, canonical,
 * hreflang en ↔ tl + x-default, Open Graph + Twitter image, and the JSON-LD
 * graph (Organization · BreadcrumbList · SoftwareApplication + Offer from the
 * catalogue · FAQPage · HowTo). The pages call exactly these functions — a
 * page that hand-builds its own tags is a second copy the guard cannot see.
 */
import { inLanguageTag, localeAlternates, localeUrl } from '@/lib/marketing-i18n';
import type { FeatureLocale, FeaturePageEntry } from './types';
import { FEATURES_HUB_PATHS, featurePaths, featureHref, FEATURE_GROUPS, FEATURE_PAGES } from './index';
import { featureOffer, type ResolvedFeaturePrice } from './price';

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const BRAND_CARD = { path: '/brand/og-card.webp', width: 1200, height: 630 } as const;

/**
 * The share image: the feature's first real PHOTOGRAPH (our own demo
 * celebration, 1024×1024), else the brand card. Product stills are tall phone
 * frames (460×972) and crop to nonsense in a link preview, so they are shown
 * on the page but never used as the card.
 */
export function featureShareImage(f: FeaturePageEntry, locale: FeatureLocale) {
  const photo = f.shots.find((s) => s.src.startsWith('/demo/'));
  if (photo) return { url: `${SITE_URL}${photo.src}`, width: 1024, height: 1024, alt: photo.alt[locale] };
  return { url: `${SITE_URL}${BRAND_CARD.path}`, width: BRAND_CARD.width, height: BRAND_CARD.height, alt: f.name[locale] };
}

const OG_LOCALE: Record<FeatureLocale, string> = { en: 'en_PH', tl: 'tl_PH' };

export function featureMetadata(f: FeaturePageEntry, locale: FeatureLocale) {
  const paths = featurePaths(f.slug);
  const alternates = localeAlternates(locale, paths);
  const image = featureShareImage(f, locale);
  const fullTitle = `${f.title[locale]} · Setnayan`;
  return {
    // The root layout's template appends " · Setnayan" to the document title.
    title: f.title[locale],
    description: f.description[locale],
    keywords: [...f.keywords[locale], 'Setnayan'],
    alternates,
    openGraph: {
      title: fullTitle,
      description: f.description[locale],
      url: alternates.canonical,
      type: 'website' as const,
      siteName: 'Setnayan',
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[locale === 'en' ? 'tl' : 'en']],
      images: [image],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: fullTitle,
      description: f.description[locale],
      images: [image.url],
    },
  };
}

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Setnayan',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon-512.svg`,
  areaServed: 'PH',
};

const HUB_NAME = { en: 'Features', tl: 'Mga feature' } as const;

/** The full JSON-LD graph for one feature page. `price` is the resolved catalogue price. */
export function featureJsonLd(f: FeaturePageEntry, locale: FeatureLocale, price: ResolvedFeaturePrice) {
  const url = localeUrl(locale, featurePaths(f.slug));
  const hubUrl = localeUrl(locale, FEATURES_HUB_PATHS);
  const lang = inLanguageTag(locale);
  const offer = featureOffer(price, url);
  const app: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${url}#app`,
    name: f.name[locale],
    url,
    description: f.answer[locale],
    applicationCategory: f.group === 'suppliers' ? 'BusinessApplication' : 'LifestyleApplication',
    operatingSystem: 'Any (web browser)',
    inLanguage: lang,
    areaServed: 'PH',
    featureList: [...f.different[locale]],
    publisher: { '@id': ORGANIZATION['@id'] },
  };
  if (offer) app.offers = offer;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: f.title[locale],
        description: f.description[locale],
        inLanguage: lang,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${url}#app` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        primaryImageOfPage: featureShareImage(f, locale).url,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Setnayan', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: HUB_NAME[locale], item: hubUrl },
          { '@type': 'ListItem', position: 3, name: f.name[locale], item: url },
        ],
      },
      app,
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: lang,
        mainEntity: f.faq[locale].map((x) => ({
          '@type': 'Question',
          name: x.q,
          acceptedAnswer: { '@type': 'Answer', text: x.a },
        })),
      },
      {
        '@type': 'HowTo',
        '@id': `${url}#howto`,
        name: locale === 'tl' ? `Paano gamitin ang ${f.name.tl}` : `How to use ${f.name.en}`,
        inLanguage: lang,
        step: f.steps[locale].map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: text,
          text,
          url: `${url}#how-it-works`,
        })),
      },
    ],
  };
}

/** The hub's graph: the five groups as one ItemList of every feature page. */
export function featuresHubItemList(locale: FeatureLocale) {
  const url = localeUrl(locale, FEATURES_HUB_PATHS);
  let position = 0;
  return {
    '@type': 'ItemList',
    '@id': `${url}#features`,
    name: locale === 'tl' ? 'Lahat ng feature ng Setnayan' : 'Every Setnayan feature',
    itemListElement: FEATURE_GROUPS.flatMap((g) =>
      FEATURE_PAGES.filter((f) => f.group === g.key).map((f) => ({
        '@type': 'ListItem',
        position: ++position,
        name: f.name[locale],
        url: `${SITE_URL}${featureHref(f.slug, locale)}`,
      })),
    ),
  };
}
