import { localeAlternates } from '@/lib/marketing-i18n';
import { FeaturesPageBody, FEATURES_PATHS } from '@/app/features/_PageBody';

// /features — the deep-dive feature catalog page. Per iteration 0015 §
// Routes, this is the "features deep-dive (each tab + service explained
// more)" surface for couples who want to read more before applying.
//
// Localized (English + Taglish, owner 2026-06-13). This route is the thin
// English wrapper: all copy + structure live in the section components'
// per-locale dictionaries; <FeaturesPageBody locale> renders them. The
// Taglish twin lives at /tl/features and shares this exact body.
//
// 2026-10-19 — THE HUB MOVED INTO app/(shell)/ (sweep row C5). It wore the
// older floating glass nav ("Prices · Download · Suppliers") while every
// /features/<slug> page under it wore the front-door bar and rail, so one
// press from the hub to a feature swapped the whole header. It now sits in the
// same group as its children and inherits the one shared shell.
// ⚠ NO `revalidate` HERE ANY MORE: the group layout is force-dynamic because
// the shell reads the session, and a page re-declaring caching under it is the
// /privacy defect (`one-shell-mount.test.ts`). It sits in the `(hub)` group
// so its `loading.tsx` wraps the hub alone — /features/[slug] calls notFound()
// and must not stream (see the boundary's own note).

export const metadata = {
  title: 'Every Feature in Setnayan · Wedding & Life-Events Platform Philippines',
  description:
    'Guest list, seating, budget, mood board, schedule, supplier ledger, plus day-of apparatus (Live Watch, Papic, Pakulay). The full feature catalog of the Filipino-first events platform.',
  alternates: localeAlternates('en', FEATURES_PATHS),
  keywords: [
    'Filipino wedding features',
    'wedding planning tools Philippines',
    'Live Watch live streaming',
    'Papic wedding photography',
    'Pakulay mood board',
    'wedding seating chart',
    'wedding budget tracker',
  ],
  openGraph: {
    title: 'Every Feature in Setnayan · Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, supplier ledger, plus day-of apparatus (Live Watch, Papic, Pakulay).',
    url: '/features',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Every Feature in Setnayan · Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, supplier ledger, plus day-of apparatus (Live Watch, Papic, Pakulay).',
  },
};

export default function FeaturesPage() {
  return <FeaturesPageBody locale="en" />;
}
