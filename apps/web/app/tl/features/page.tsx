import { localeAlternates } from '@/lib/marketing-i18n';
import { FeaturesPageBody, FEATURES_PATHS } from '@/app/features/_PageBody';

// /tl/features — Taglish edition of /features. Thin route: it reuses the
// exact same <FeaturesPageBody> as the English page, passing locale="tl".
// All copy lives in the section components' per-locale dictionaries, so the
// two pages can never structurally drift — only the prose differs.
// Reciprocal hreflang lives in both pages' `alternates` via localeAlternates.

export const revalidate = 3600;

export const metadata = {
  title: 'Lahat ng Feature sa Setnayan — Wedding & Life-Events Platform Philippines',
  description:
    'Guest list, seating, budget, mood board, schedule, vendor ledger, plus day-of apparatus (Panood, Papic, Pakulay). Ang buong feature catalog ng Filipino-first events platform — sa Taglish.',
  alternates: localeAlternates('tl', FEATURES_PATHS),
  keywords: [
    'Filipino wedding features',
    'wedding planning tools Philippines',
    'Panood live streaming',
    'Papic wedding photography',
    'Pakulay mood board',
    'wedding seating chart Tagalog',
    'wedding budget tracker Philippines',
  ],
  openGraph: {
    title: 'Lahat ng Feature sa Setnayan — Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, vendor ledger, plus day-of apparatus (Panood, Papic, Pakulay) — sa Taglish.',
    url: '/tl/features',
  },
};

export default function FeaturesPageTaglish() {
  return <FeaturesPageBody locale="tl" />;
}
