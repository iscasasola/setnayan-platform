import { localeAlternates } from '@/lib/marketing-i18n';
import { FeaturesPageBody, FEATURES_PATHS } from '@/app/features/_PageBody';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { runHowSearch } from '@/lib/how-search';
import { HowSearchField, HowSearchResults } from '@/app/_components/how-search/how-search';

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

const HUB_METADATA = {
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
    images: BRAND_OG_IMAGES,
    title: 'Every Feature in Setnayan · Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, supplier ledger, plus day-of apparatus (Live Watch, Papic, Pakulay).',
    url: '/features',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: 'Every Feature in Setnayan · Wedding & Life-Events Platform Philippines',
    description:
      'Guest list, seating, budget, mood board, schedule, supplier ledger, plus day-of apparatus (Live Watch, Papic, Pakulay).',
  },
};

type Props = { searchParams: Promise<{ q?: string }> };

/**
 * 🔎 A search address (`/features?q=…`) is `noindex, follow` — every typed
 * phrase would otherwise be a thin duplicate of the hub. The canonical stays
 * `/features`; the bare hub is unchanged.
 */
export async function generateMetadata({ searchParams }: Props) {
  const { q } = await searchParams;
  return q?.trim() ? { ...HUB_METADATA, robots: { index: false, follow: true } } : HUB_METADATA;
}

export default async function FeaturesPage({ searchParams }: Props) {
  // 🔎 The one search for help, features and guides (owner 2026-10-25) — the
  // same one /help mounts. The words ride in this page's `?q=`.
  const q = ((await searchParams).q ?? '').trim().slice(0, 120);
  const found = q ? await runHowSearch(q) : null;
  return (
    <FeaturesPageBody
      locale="en"
      roomForRow
      search={<HowSearchField q={q} action="/features" />}
      results={
        found ? (
          <HowSearchResults
            q={q}
            hits={found.hits}
            storiesFailed={found.storiesFailed}
            clearHref="/features"
            askHref="/help#contact"
          />
        ) : null
      }
    />
  );
}
