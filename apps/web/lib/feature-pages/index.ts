/**
 * feature-pages — THE ONE LIST OF WHAT SETNAYAN DOES (DECISION_LOG 2026-10-01).
 *
 * Owner, 2026-10-01: *"A page where they can learn and view our features?"* →
 * `/features` (the hub) + one page per feature at `/features/<slug>`, each
 * with a Tagalog twin at `/tl/features/<slug>`. *"the features menu will help
 * us make the setnayan more visible to the internet?"* → they are written as
 * real pages, tagged for regular and AI search.
 *
 * Everything that lists features reads THIS module: the hub's five groups,
 * the per-feature pages, `sitemap-features.xml` and the feature section of
 * `/llms.txt`. A second list anywhere is a defect — it is how the sidebar,
 * the old catalogue sections and the product pages drifted apart before.
 *
 * PURE. The catalogue read lives in `app/features/_feature-price.ts`; the
 * pure label rules live in `./price.ts` so a node test can run them.
 *
 * ⚠ ONLY WHAT SHIPS. Every entry names the code that makes it true
 * (`evidence`), and `app/features/features-page-says-what-ships.test.ts` fails
 * the moment a named file is gone or a banned (false) claim reappears.
 */
import { FEATURE_SLUGS, type Bi, type FeatureGroupKey, type FeaturePageEntry, type FeatureSlug, type FeatureLocale } from './types';
import { PLAN_A_FEATURES } from './plan-a';
import { PLAN_B_FEATURES } from './plan-b';
import { INVITE_FEATURES } from './invite';
import { DAY_MEMORIES_FEATURES } from './day-memories';
import { SUPPLIERS_A_FEATURES } from './suppliers-a';
import { SUPPLIERS_B_FEATURES } from './suppliers-b';

export * from './types';

/** The five groups, in the order the hub shows them. */
export const FEATURE_GROUPS: readonly Readonly<{ key: FeatureGroupKey; name: Bi<string> }>[] = [
  { key: 'plan', name: { en: 'Plan it', tl: 'Planuhin' } },
  { key: 'invite', name: { en: 'Invite & gather', tl: 'Mag-imbita at magtipon' } },
  { key: 'day', name: { en: 'The Day', tl: 'Sa mismong araw' } },
  { key: 'memories', name: { en: 'Keep the memories', tl: 'Itago ang Memories' } },
  { key: 'suppliers', name: { en: 'For suppliers', tl: 'Para sa suppliers' } },
];

const ALL: readonly FeaturePageEntry[] = [
  ...PLAN_A_FEATURES,
  ...PLAN_B_FEATURES,
  ...INVITE_FEATURES,
  ...DAY_MEMORIES_FEATURES,
  ...SUPPLIERS_A_FEATURES,
  ...SUPPLIERS_B_FEATURES,
];

/** Every feature page, in `FEATURE_SLUGS` order (the hub's reading order). */
export const FEATURE_PAGES: readonly FeaturePageEntry[] = FEATURE_SLUGS.flatMap((slug) =>
  ALL.filter((f) => f.slug === slug),
);

export function featurePage(slug: string): FeaturePageEntry | undefined {
  return FEATURE_PAGES.find((f) => f.slug === slug);
}

export function featuresInGroup(group: FeatureGroupKey): readonly FeaturePageEntry[] {
  return FEATURE_PAGES.filter((f) => f.group === group);
}

/** The EN + Tagalog path pair for one feature page (and the hub). */
export function featurePaths(slug: FeatureSlug): { en: string; tl: string } {
  return { en: `/features/${slug}`, tl: `/tl/features/${slug}` };
}

export const FEATURES_HUB_PATHS = { en: '/features', tl: '/tl/features' } as const;

export function featureHref(slug: FeatureSlug, locale: FeatureLocale): string {
  const p = featurePaths(slug);
  return locale === 'tl' ? p.tl : p.en;
}

/**
 * The last day the feature copy was edited. Stamped as every feature URL's
 * `<lastmod>` — a real edit date, never a build-time `Date()` (Google reads a
 * shared fresh stamp as freshness fraud; see `app/sitemap.xml/route.ts`).
 * Bump it in the same commit as any copy change in this folder.
 */
export const FEATURES_LASTMOD = '2026-10-01';

/**
 * THE ECOSYSTEM, AS A MAP (DECISION_LOG 2026-10-01 "EVERY FEATURE PAGE SAYS WHY
 * IT'S AHEAD — AND HOW IT WORKS WITH THE REST OF SETNAYAN"). Each chain is one
 * real path a person's work travels — every hop is a shipped hand-off, not a
 * slogan. The hub draws these as connected rows; each node links to its page.
 */
export const ECOSYSTEM_CHAINS: readonly Readonly<{
  name: Bi<string>;
  line: Bi<string>;
  slugs: readonly FeatureSlug[];
}>[] = [
  {
    name: { en: 'Your guests', tl: 'Ang mga bisita mo' },
    line: {
      en: 'One guest list feeds the invitation, the seats, the door and the photos.',
      tl: 'Iisang guest list ang pinagkukunan ng imbitasyon, upuan, pinto at mga litrato.',
    },
    slugs: ['guest-list', 'event-hub', 'seat-plan', 'papic', 'alaala'],
  },
  {
    name: { en: 'Your suppliers', tl: 'Ang mga supplier mo' },
    line: {
      en: 'Find them, compare them, book them, and track every peso.',
      tl: 'Hanapin, ikumpara, i-book, at bantayan ang bawat piso.',
    },
    slugs: ['marketplace', 'compare', 'budget', 'setnayan-ai'],
  },
  {
    name: { en: 'Your day', tl: 'Ang araw mo' },
    line: {
      en: 'One look and one timeline, carried from the plan to the party.',
      tl: 'Iisang itsura at iisang timeline, mula sa plano hanggang sa handaan.',
    },
    slugs: ['mood-board', 'logo-maker', 'schedule', 'live-watch'],
  },
];
