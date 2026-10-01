/**
 * feature-pages/types.ts — the shape of ONE entry in the /features registry.
 *
 * PURE. No I/O, no `server-only`, no React — the guards import it under
 * `tsx --test`, and the pages read it on the server.
 *
 * The registry is the ONE list of what Setnayan does (DECISION_LOG 2026-10-01
 * "/FEATURES — THE FULL LIST"). The /features hub, every /features/<slug> page,
 * their Tagalog twins under /tl, sitemap-features.xml and /llms.txt all render
 * from it. Never type a feature's name, line or price anywhere else.
 */
import type { EventMenuIconName } from '@/lib/customer-menu';

export type FeatureLocale = 'en' | 'tl';

/** One string (or list) per locale. Both are required — the twins never drift. */
export type Bi<T> = Readonly<{ en: T; tl: T }>;

export type FeatureGroupKey = 'plan' | 'invite' | 'day' | 'memories' | 'suppliers';

/**
 * Every feature page's address, as a closed list — so a "Works with" link to a
 * page that does not exist is a TYPE error, not a 404 found by a visitor.
 */
export const FEATURE_SLUGS = [
  'budget',
  'guest-list',
  'seat-plan',
  '3d-plan',
  'schedule',
  'mood-board',
  'marketplace',
  'compare',
  'setnayan-ai',
  'event-hub',
  'logo-maker',
  'music-maker',
  'groups',
  'papic',
  'live-watch',
  'patiktok',
  'alaala',
  'real-stories',
] as const;

export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

/**
 * Icons not already in the event menu's set (`EVENT_MENU_ICONS`). The page
 * resolves these through `FEATURE_EXTRA_ICONS` in `app/features/_icons.ts`;
 * every other name is the shipped sidebar glyph.
 */
export type FeatureExtraIconName =
  | 'checklist'
  | 'date'
  | 'compare'
  | 'contracts'
  | 'traditions'
  | 'std'
  | 'march'
  | 'helpers'
  | 'store'
  | 'package'
  | 'inbox'
  | 'calendar-check'
  | 'earnings'
  | 'performance'
  | 'branches'
  | 'verified'
  | 'shield'
  | 'handshake'
  | 'receipt'
  | 'subscription'
  | 'challenge';

export type FeatureIconName = EventMenuIconName | FeatureExtraIconName;

/**
 * Where a price comes from. NEVER a number — the page reads the catalogue row
 * at render (`platform_retail_catalog_v2` for hosts, `vendor_billing_catalog`
 * for suppliers). An unreadable row renders "See pricing", never a guess.
 *
 *   free       — nothing to buy.
 *   paid       — the lowest active row among `codes` ("₱X", or "From ₱X" when
 *                there is more than one rung).
 *   free-plus  — free to use; an optional upgrade from the lowest row.
 *
 * `inactiveRowsArePrices` exists for ONE ladder: Setnayan AI's B/C/D rows are
 * `is_active = false` by design (price-source only — see
 * `lib/setnayan-ai-type-pricing.ts`). Nothing else may set it.
 */
export type FeaturePrice =
  | { kind: 'free' }
  | {
      kind: 'paid' | 'free-plus';
      catalogue: 'retail' | 'supplier';
      codes: readonly string[];
      inactiveRowsArePrices?: true;
    };

/** A REAL picture already on disk. Open it before naming it (see `_spotlights.tsx`). */
export type FeatureShot = {
  src: `/add-ons/demo/stills/${string}.jpg` | `/demo/${string}`;
  alt: Bi<string>;
};

/** The existing pages a visitor can try a feature on — no new try pages here. */
export type FeatureTryHref = '/papic' | '/panood' | '/pa3d/try' | '/pawebsite' | '/explore' | '/explore/compare';

export type FeaturePageEntry = Readonly<{
  slug: FeatureSlug;
  group: FeatureGroupKey;
  icon: FeatureIconName;
  /** Product name. Same in both locales for named products (Papic, Live Watch). */
  name: Bi<string>;
  /** The hub's one line — ≤ 12 words, plain. */
  line: Bi<string>;
  /** `<title>` WITHOUT the brand (the root layout appends " · Setnayan"). Unique. */
  title: Bi<string>;
  /** Meta description, 70–160 characters, in the words people search. Unique. */
  description: Bi<string>;
  /** The answer-first opening paragraph — what it is, in two or three plain sentences. */
  answer: Bi<string>;
  /** Who it is for — one or two sentences. */
  forWho: Bi<string>;
  /** How it works, exactly three steps. */
  steps: Bi<readonly [string, string, string]>;
  /** "What makes it different" — 3 to 5 TRUE, shipped facts. No competitor names. */
  different: Bi<readonly string[]>;
  /** "Works with the rest of Setnayan" — 2 to 5 links to other feature pages. */
  worksWith: readonly Readonly<{ slug: FeatureSlug; how: Bi<string> }>[];
  /** 3–6 questions in the words people search. */
  faq: Bi<readonly Readonly<{ q: string; a: string }>[]>;
  /** Search phrases for the keywords meta. */
  keywords: Bi<readonly string[]>;
  /** 0–3 real pictures. */
  shots: readonly FeatureShot[];
  price: FeaturePrice;
  /** The existing page to try it on. Omitted when there is none. */
  tryHref?: FeatureTryHref;
  /** The feature's existing product page, when it has one (e.g. /guest-list). */
  moreHref?: string;
  /** Related articles — `lib/blog.ts` slugs, published only. */
  guides?: readonly string[];
  /**
   * The shipped code that makes every claim on this page true — repo paths
   * relative to apps/web. `features-page-says-what-ships.test.ts` fails if any
   * stops existing, so a feature cannot outlive its code on the page.
   */
  evidence: readonly string[];
}>;
