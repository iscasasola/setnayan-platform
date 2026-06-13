import Link from 'next/link';

// Shared foundation for marketing-site localization (English + Taglish).
//
// Owner-chosen architecture (2026-06-13, "dictionary + thin routes"): a page
// keeps ONE component that renders both locales; the per-locale COPY lives in a
// dictionary; the EN page and the /tl/<page> route are thin wrappers that pass
// `locale`. This module holds the bits every localized page needs — the locale
// type, the reciprocal-hreflang helper, and the hero locale switcher — so each
// page doesn't hand-roll its own `LANGUAGES` map again.
//
// NOTE: NOT `server-only` — client section components (e.g. the scroll-spy nav)
// import `MarketingLocale`. Type-only imports erase at compile time, and
// `next/link` is itself client-safe, so this module is safe on both sides.
//
// "Taglish" has no ISO/hreflang code, so we use `tl` / `tl-PH` (the Tagalog
// family) as the closest standard; the register + user-facing label are Taglish.

export type MarketingLocale = 'en' | 'tl';

/** A page's EN + Taglish path pair, e.g. { en: '/features', tl: '/tl/features' }. */
export type LocalePaths = { en: string; tl: string };

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

/**
 * `alternates` block for a localized page: an absolute canonical for THIS
 * locale + the reciprocal en-PH / tl-PH / x-default hreflang map. x-default
 * always points at the English page.
 */
export function localeAlternates(locale: MarketingLocale, paths: LocalePaths) {
  return {
    canonical: `${SITE_URL}${locale === 'tl' ? paths.tl : paths.en}`,
    languages: {
      'en-PH': `${SITE_URL}${paths.en}`,
      'tl-PH': `${SITE_URL}${paths.tl}`,
      'x-default': `${SITE_URL}${paths.en}`,
    },
  };
}

/** Absolute URL for a given locale (for JSON-LD `url`, breadcrumbs, etc.). */
export function localeUrl(locale: MarketingLocale, paths: LocalePaths): string {
  return `${SITE_URL}${locale === 'tl' ? paths.tl : paths.en}`;
}

/** schema.org `inLanguage` tag for the locale. */
export function inLanguageTag(locale: MarketingLocale): string {
  return locale === 'tl' ? 'tl-PH' : 'en-PH';
}

/**
 * Hero locale switcher — links to the OTHER locale. On the English page it
 * offers "Taglish"; on the Taglish page it offers "English". Carries the
 * matching `hrefLang` so crawlers read it as a language alternate.
 */
export function LocaleSwitch({
  locale,
  paths,
  className,
}: {
  locale: MarketingLocale;
  paths: LocalePaths;
  className?: string;
}) {
  const toTaglish = locale !== 'tl';
  return (
    <Link
      href={toTaglish ? paths.tl : paths.en}
      hrefLang={toTaglish ? 'tl-PH' : 'en-PH'}
      className={
        className ??
        'font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 underline-offset-4 hover:text-ink hover:underline'
      }
    >
      {toTaglish ? 'Taglish' : 'English'}
    </Link>
  );
}
