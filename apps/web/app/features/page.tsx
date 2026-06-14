import { localeAlternates } from '@/lib/marketing-i18n';
import { FeaturesPageBody, FEATURES_PATHS } from './_PageBody';

// /features — the deep-dive feature catalog page. Per iteration 0015 §
// Routes, this is the "features deep-dive (each tab + service explained
// more)" surface for couples who want to read more before applying.
//
// Localized (English + Taglish, owner 2026-06-13). This route is the thin
// English wrapper: all copy + structure live in the section components'
// per-locale dictionaries; <FeaturesPageBody locale> renders them. The
// Taglish twin lives at /tl/features and shares this exact body.
//
// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29) — 1hr Vercel edge cache so static
// marketing routes serve Google's crawl budget without origin pressure.

export const revalidate = 3600;

export const metadata = {
  title: 'Every Feature in Setnayan — Wedding & Life-Events Platform Philippines',
  description:
    'Guest list, seating, budget, mood board, schedule, vendor ledger, plus day-of apparatus (Panood, Papic, Pakulay). The full feature catalog of the Filipino-first events platform.',
  alternates: localeAlternates('en', FEATURES_PATHS),
  keywords: [
    'Filipino wedding features',
    'wedding planning tools Philippines',
    'Panood live streaming',
    'Papic wedding photography',
    'Pakulay mood board',
    'wedding seating chart',
    'wedding budget tracker',
  ],
  openGraph: {
    title: 'Every Feature in Setnayan — Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, vendor ledger, plus day-of apparatus (Panood, Papic, Pakulay).',
    url: '/features',
  },
};

export default function FeaturesPage() {
  return <FeaturesPageBody locale="en" />;
}
