import { FeaturesHero } from './_sections/_Hero';
import { FeatureGroups } from './_sections/_FeatureGroups';
import { EcosystemBand } from './_sections/_Ecosystem';
import { WhySetnayan, whyFaqItems } from './_sections/_WhySetnayan';
import { HowItWorks } from './_sections/_HowItWorks';
import { FinalCTA } from './_sections/_FinalCTA';
import { FeaturesStory } from './_sections/_Story';
import { FeaturesPlans } from './_sections/_Plans';
import { PersonaScope } from './_story-client';
import story from './features-story.module.css';
import { featuresHubItemList, SITE_URL } from '@/lib/feature-pages/seo';
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
        mainEntity: whyFaqItems(locale).map((item) => ({
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

/**
 * The v3 story's frame: in English the persona scope (the "I am" choice, the moments, the ⓘ sheet); in Taglish the
 * same container with no persona, so the shared sections keep their gutters and breakpoints.
 */
function Scope({ locale, children }: { locale: MarketingLocale; children: React.ReactNode }) {
  return locale === 'en' ? <PersonaScope>{children}</PersonaScope> : <div className={story.scope}>{children}</div>;
}

export function FeaturesPageBody({
  locale,
  search,
  results,
  roomForRow = false,
}: {
  locale: MarketingLocale;
  /** The one help · features · guides search (English hub only), under the head. */
  search?: React.ReactNode;
  /** A search's results — when present they draw IN PLACE of the sections below the head. */
  results?: React.ReactNode;
  /** The search is the thumb row docked at the screen's foot below 1024 — the page ends above it. */
  roomForRow?: boolean;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featuresJsonLd(locale)) }}
      />
      <main className={roomForRow ? 'min-h-dvh pb-24 lg:pb-16' : 'min-h-dvh pb-16'}>
        {/* 2026-11-11 — v3, THE STORY (DECISION_LOG "FEATURES PAGE v3 — APPROVED; BUILD THE LIVE /features FROM IT").
            English: the hero's "I am" pick chooses whose story is told — numbered chapters per persona, each with a
            live moment and its rows (every FEATURE_REGISTER row, planned ones chipped "Coming"), then "Nothing is
            typed twice", the Plans compare (prices from the catalogue) and the close with two equal buttons. The
            rows' links to every /features/<slug> page live on inside the story.
            Taglish: the shipped hub (2026-10-01 "/FEATURES — THE FULL LIST") — the five groups from the one
            registry — until the v3 rows are written in Taglish.
            The two framing sections folded in on 2026-09-01 (Why · How) stay after the features, for the reader
            who wants the frame. */}
        <Scope locale={locale}>
          <FeaturesHero locale={locale} />
          {/* 🔎 2026-10-25 — the one search for "how does Setnayan work" (owner:
              "also the HELP and Features where we can mazimize the app to be
              searchable"). Empty → the hub exactly as before; words → the
              results in the sections' place. */}
          {search ? <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">{search}</div> : null}
          {results ? (
            <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">{results}</div>
          ) : (
            /* 🚫✂️ LIGHT "NO SELECT" — /features only (owner 10 Nov: *"we dont want them to be able to select text to copy
               and tell AI to make a website"* → *"Yes, light only"*; DECISION_LOG 2026-11-10). `user-select: none` on the
               feature cards and sections, NOTHING more: the text stays in the HTML (search engines, AI crawlers,
               /llms.txt, screen readers and the browser's Find all keep working), links and buttons still work, robots
               is untouched, no right-click or key blocker. The search field above is outside it on purpose.
               🔒 `supplier-plan-table-tells-the-truth.test.ts`. */
            <div className="select-none" data-features-no-select="">
              {locale === 'en' ? <FeaturesStory locale={locale} /> : <FeatureGroups locale={locale} />}
              <EcosystemBand locale={locale} />
              <FeaturesPlans locale={locale} />
              <WhySetnayan locale={locale} />
              <HowItWorks locale={locale} />
              <FinalCTA locale={locale} />
            </div>
          )}
        </Scope>
      </main>
    </>
  );
}
