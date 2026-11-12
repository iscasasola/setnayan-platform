import { skuBackedLiterals, parsePesoLiteral, type PriceLiteral } from '@/lib/public-price-literals';
import { FEATURE_PAGES, featurePaths } from '@/lib/feature-pages';
import { findStaleClaims } from '@/lib/seo/stale-claims';

/**
 * SEO / GEO health checks — the daily drift + coverage audit that backs
 * /api/cron/seo-health and the /admin/seo surface.
 *
 * These are PURE functions (no I/O) so they unit-test cleanly and so the cron
 * can feed them the live catalog + the served llms.txt. The whole point is to
 * turn the one-off manual reconciliation in SEO_GEO_UPDATE_2026-07-10.md §3 into
 * a standing daily check: a repriced SKU or a deleted route that leaves stale
 * copy in the AI-crawler surface (public/llms.txt) surfaces automatically instead
 * of sitting there feeding every LLM a wrong answer.
 *
 * The price check is deliberately a figure-SET diff (catalog pesos vs llms.txt
 * pesos), not prose parsing — robust to how a price is worded, and it catches
 * exactly the two failure modes: a catalog price that never made it into the
 * copy, and a figure in the copy that no live SKU backs.
 */

export type HealthStatus = 'ok' | 'warn' | 'fail';

export type HealthFinding = {
  check: string;
  status: HealthStatus;
  detail: string;
};

/** One catalog price the AI-crawler surface disagrees with. */
export type PriceDriftEntry = {
  figure: string;
  /** 'missing' = in live catalog, absent from llms.txt (stale/omitted copy). */
  /** 'orphan'  = in llms.txt, no live SKU at that figure (retired/typo). */
  kind: 'missing' | 'orphan';
  note?: string;
};

export type SeoHealthResult = {
  findings: HealthFinding[];
  priceDrift: PriceDriftEntry[];
  counts: { ok: number; warn: number; fail: number };
};

/**
 * One live, active, priced SKU. Prices are in PHP pesos (the live catalogs store
 * `retail_price_php` / `price_php`, NOT centavos). `source` decides how strict we
 * are: `retail` = a customer à-la-carte service, which llms.txt is expected to
 * quote (absence ⇒ `missing` fail); `vendor` = a vendor-billing SKU, many of them
 * micro-SKUs (extra seat, custom-plan components) that llms.txt intentionally
 * omits — these only ever SUPPRESS false orphans, never raise a `missing` fail.
 */
export type CatalogRow = {
  sku_code: string;
  price_php: number;
  source: 'retail' | 'vendor';
  /**
   * `false` = on sale but deliberately NOT described to answer engines (`UNLISTED_UNTIL_PROVEN` in lib/llms-txt.ts —
   * Patiktok, owner 2026-09-27). Such a row may only SUPPRESS an orphan, never raise a `missing`: its absence from
   * llms.txt is the rule, not drift. Omitted = advertised.
   */
  advertised?: boolean;
};

export type HealthCheckInput = {
  /** The body of the served llms.txt (footer changelog excluded is fine either way). */
  llmsText: string;
  /** Live active priced SKUs — platform_retail_catalog_v2 (retail) + vendor_billing_catalog (vendor). */
  catalog: CatalogRow[];
  /**
   * The SKU-backed literals Check 5 verifies. Defaults to the declared inventory (`skuBackedLiterals()`); a test
   * passes its own so the check can be watched failing even while the inventory holds no SKU-backed figure at all
   * (it holds none since 2026-11-04 — the demo's two were deleted, not re-typed).
   */
  literals?: readonly (PriceLiteral & { sku: string })[];
  /**
   * True peso figures that are NOT a SKU price — today the booking-fee schedule's threshold and minimum, derived by
   * the caller from the LIVE schedule (`bookingFeeFigures`). Without them the audit warned "orphan ₱100,000 · ₱50"
   * every single day (measured in prod 2026-11-10), and an alarm that always fires stops being an alarm.
   */
  nonSkuFigures?: readonly string[];
  /**
   * The questions people ask AI about Setnayan that `/llms.txt` must answer (lib/seo/ai-answers.ts, Lane K). When
   * given, a served file missing any of them FAILS — that is how the 15-line fallback stub, or a refactor that dropped
   * the section, gets caught the next day instead of never.
   */
  requiredQuestions?: readonly string[];
  /**
   * Paths the served sitemaps list (the caller fetches them). When given, every front page in `MUST_BE_IN_SITEMAP`
   * must be among them.
   */
  sitemapPaths?: readonly string[];
  /** Env presence flags — the owner-action nags. */
  env: {
    googleSiteVerification?: string;
    bingSiteVerification?: string;
    /**
     * Domain ownership proven by a `google-site-verification=…` TXT record on
     * setnayan.com's DNS, resolved by the caller (I/O — this module stays pure).
     * Search Console accepts DNS-TXT as an alternative to the meta-tag/env-var
     * route; ownership verified this way needs no `googleSiteVerification` env
     * var at all, so without this flag the check nags forever for a token that
     * will never exist even though the domain is already verified.
     */
    googleDnsTxtVerified?: boolean;
    /** Organization.sameAs entries currently wired (FB / LinkedIn / etc.). */
    orgSameAs?: string[];
  };
};

// The changelog footer narrates retired figures on purpose — exclude it from
// the price diff exactly as the existing llms-price-drift.test.ts does.
const FOOTER_MARKER = 'This file was last refreshed on';

// A peso figure like ₱0, ₱499, ₱1,299, ₱74,999 (no trailing punctuation).
const PESO = /₱[0-9](?:[0-9,]*[0-9])?/g;

// Absolute links to our own domain inside llms.txt.
const SELF_LINK = /https:\/\/www\.setnayan\.com(\/[A-Za-z0-9\-/[\]]*)?/g;

/**
 * Canonical set of indexable/public routes the AI-crawler surface is allowed to
 * point at. Anything llms.txt links to that is NOT here is flagged as a possible
 * dead route (the /venues + /venue 404 class the audit caught). Keep in sync
 * when a public surface ships or retires — this is the one small maintained list
 * that lets the daily check catch route drift.
 */
export const KNOWN_PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  '/',
  '/about',
  '/our-story',
  // 2026-09-01 — /features ABSORBED /why-setnayan, /how-it-works and
  // /tl/how-it-works. Those three are gone from this set because they are no
  // longer PAGES; they are 308s (next.config.ts). A redirect left in this list
  // makes the daily drift check assert a page exists where none does.
  '/features',
  '/pricing',
  // '/explore' left 2026-11-12 — a 308 to Discover `/` now (Find suppliers moved inside Discover).
  '/explore/compare',
  '/for-suppliers',
  // Build 6 Lane K — the coordinator front page (live since 2026-11-04, in the static sitemap) was missing here, so
  // llms.txt could not link it without the audit calling it a dead route.
  '/for-coordinators',
  '/open-shop',
  '/v/',
  '/setnayan-ai',
  '/papic',
  '/panood',
  '/pa3d',
  '/palogo',
  '/pawebsite',
  '/patiktok',
  '/pakanta',
  // The mood board's public doorway — free tool, page added 2026-09-03.
  '/mood-board',
  // The other three free tools' doorways — pages added 2026-09-05.
  '/marketplace',
  '/guest-list',
  '/seat-plan',
  // Added 2026-09-06 with their doorways.
  '/budget',
  '/schedule',
  // Added 2026-09-27 — the supplier landing pages' index (SEO Playbook §5.1).
  '/suppliers',
  '/monogram',
  '/alaala',
  '/weddings',
  '/realstories',
  '/blog',
  '/help',
  '/download',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/refunds',
  '/cookies',
  '/acceptable-use',
  '/waitlist',
  // '/tl' left 2026-11-10 (Build 6 Lane K): there is no /tl page and no redirect for it — only /tl/about and
  // /tl/features exist — so the set claimed a public page that answers 404.
  '/tl/about',
  '/tl/features',
  // 2026-10-01 — one page per feature + its Tagalog twin, DERIVED from the one
  // registry so a new feature page is public here the moment it exists, and a
  // removed one stops being claimed the moment it goes.
  ...FEATURE_PAGES.flatMap((f) => {
    const p = featurePaths(f.slug);
    return [p.en, p.tl];
  }),
]);

/**
 * The front pages a person and an answer engine must both be able to find (Build 6 Lane K: "the sitemap covers every
 * real public page"). The daily audit fails if a served sitemap stops listing one.
 */
export const MUST_BE_IN_SITEMAP: readonly string[] = [
  '/',
  '/pricing',
  '/features',
  '/for-suppliers',
  '/for-coordinators',
  // '/explore' left 2026-11-12 — it forwards to `/`, which is listed.
  '/download',
];

/**
 * Peso figure from a PHP amount, e.g. 1299 → "₱1,299".
 *
 * @rounds-to-the-peso AN AUDIT MIRROR, not a charge — it exists to compare the
 * spelling `lib/llms-txt.ts#peso` produces, so it must round exactly as that
 * one does or the health check reports a drift it invented itself.
 */
export function pesoFigure(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-US')}`;
}

/**
 * The two true peso figures the booking-fee sentence prints (its band edge and its minimum), spelled exactly as the
 * audit spells figures. Fed to `nonSkuFigures` by the cron from the LIVE schedule, so an owner edit at /admin/pricing
 * moves both the copy and the allowance together.
 */
export function bookingFeeFigures(schedule: { tier1LimitPhp: number; minPhp: number } | null): string[] {
  return schedule ? [pesoFigure(schedule.tier1LimitPhp), pesoFigure(schedule.minPhp)] : [];
}

/** Everything above the changelog footer. */
export function llmsBody(raw: string): string {
  const idx = raw.indexOf(FOOTER_MARKER);
  return idx === -1 ? raw : raw.slice(0, idx);
}

function normalizeRoutePath(path: string): string {
  if (path === '' || path === '/') return '/';
  // Collapse a concrete slug under a directory route to its directory anchor so
  // /v/some-vendor matches the '/v/' allowlist entry.
  //
  // ⚠ Test the prefix on the ORIGINAL path, before the trailing slash is
  // stripped. Doing it after (the behaviour until 2026-07-31) meant the bare
  // directory link '/v/' became '/v', which does not start with '/v/' and so
  // failed the allow-list — the one form the '/v/' entry was written for was the
  // only form that could never match. That produced a standing daily FAIL
  // ("routes not in the known-public set: /v") against perfectly valid content.
  if (path.startsWith('/v/')) return '/v/';
  return path.replace(/\/+$/, '');
}

/**
 * The core daily audit. Returns findings + the price-drift list + roll-up counts.
 */
export function runSeoHealthChecks(input: HealthCheckInput): SeoHealthResult {
  const findings: HealthFinding[] = [];
  const body = llmsBody(input.llmsText);

  // --- Check 1: price drift (catalog ⟷ llms.txt figure sets) -----------------
  const llmsFigures = new Set(body.match(PESO) ?? []);

  // `retail` SKUs (platform_retail_catalog_v2) are the customer à-la-carte
  // services llms.txt is expected to quote — a retail figure absent from the copy
  // is real drift. `vendor` figures (vendor_billing_catalog) include the headline
  // tier ladder (which IS quoted) alongside micro-SKUs the copy intentionally
  // omits (extra seat, custom-plan components) — so ALL catalog figures suppress
  // orphans, but only `retail` figures can raise a `missing`.
  const retailFigures = new Map<string, string>(); // figure -> sample sku (must appear)
  const allCatalogFigures = new Set<string>(); // any active figure (orphan suppression)
  for (const row of input.catalog) {
    if (row.price_php <= 0) continue; // free SKUs render as prose, not ₱-figures
    const fig = pesoFigure(row.price_php);
    allCatalogFigures.add(fig);
    if (row.source === 'retail' && row.advertised !== false && !retailFigures.has(fig)) {
      retailFigures.set(fig, row.sku_code);
    }
  }
  // ₱0 is "free", and the booking-fee figures are true numbers with no SKU row — neither is an orphan.
  allCatalogFigures.add(pesoFigure(0));
  for (const fig of input.nonSkuFigures ?? []) allCatalogFigures.add(fig);

  const priceDrift: PriceDriftEntry[] = [];
  for (const [fig, sku] of retailFigures) {
    if (!llmsFigures.has(fig)) {
      priceDrift.push({
        figure: fig,
        kind: 'missing',
        note: `active retail SKU ${sku} priced ${fig} — figure absent from llms.txt`,
      });
    }
  }
  // Orphan figures: a price in the copy that no active SKU (retail OR vendor)
  // backs. Downgraded to a warn because example figures (voucher "up to ₱500"),
  // banded token prices (₱300), and daily caps (₱15,000) legitimately appear
  // without a 1:1 SKU row.
  for (const fig of llmsFigures) {
    if (!allCatalogFigures.has(fig)) {
      priceDrift.push({
        figure: fig,
        kind: 'orphan',
        note: `figure in llms.txt not matched to any active SKU price (may be an example / band / cap)`,
      });
    }
  }

  const missingCount = priceDrift.filter((d) => d.kind === 'missing').length;
  const orphanCount = priceDrift.filter((d) => d.kind === 'orphan').length;
  if (missingCount > 0) {
    findings.push({
      check: 'llms.txt price coverage',
      status: 'fail',
      detail: `${missingCount} active retail price(s) missing from llms.txt: ${priceDrift
        .filter((d) => d.kind === 'missing')
        .map((d) => d.figure)
        .join(', ')}`,
    });
  } else {
    findings.push({
      check: 'llms.txt price coverage',
      status: 'ok',
      detail: 'every active retail catalog price appears in llms.txt',
    });
  }
  if (orphanCount > 0) {
    findings.push({
      check: 'llms.txt orphan figures',
      status: 'warn',
      detail: `${orphanCount} figure(s) in llms.txt with no matching active SKU (verify these are examples / token bands): ${priceDrift
        .filter((d) => d.kind === 'orphan')
        .map((d) => d.figure)
        .join(', ')}`,
    });
  }

  // --- Check 2: dead routes in the AI-crawler surface ------------------------
  const linkedPaths = new Set<string>();
  for (const m of body.matchAll(SELF_LINK)) {
    linkedPaths.add(normalizeRoutePath(m[1] ?? '/'));
  }
  const deadRoutes = [...linkedPaths].filter((p) => !KNOWN_PUBLIC_ROUTES.has(p)).sort();
  if (deadRoutes.length > 0) {
    findings.push({
      check: 'llms.txt route validity',
      status: 'fail',
      detail: `${deadRoutes.length} link(s) in llms.txt point at routes not in the known-public set: ${deadRoutes.join(', ')}`,
    });
  } else {
    findings.push({
      check: 'llms.txt route validity',
      status: 'ok',
      detail: `all ${linkedPaths.size} linked routes are known-public`,
    });
  }

  // --- Check 3: search-engine verification tokens ----------------------------
  const missingTokens: string[] = [];
  if (!input.env.googleSiteVerification && !input.env.googleDnsTxtVerified) {
    missingTokens.push('Google Search Console');
  }
  if (!input.env.bingSiteVerification) missingTokens.push('Bing Webmaster');
  findings.push(
    missingTokens.length > 0
      ? {
          check: 'verification tokens',
          status: 'warn',
          detail: `not configured: ${missingTokens.join(' + ')} (owner: paste tokens into Vercel env)`,
        }
      : {
          check: 'verification tokens',
          status: 'ok',
          detail: `Google (${input.env.googleDnsTxtVerified ? 'DNS-TXT' : 'token'}) + Bing verification present`,
        },
  );

  // --- Check 4: Organization.sameAs entity grounding -------------------------
  const sameAs = input.env.orgSameAs ?? [];
  findings.push(
    sameAs.length === 0
      ? {
          check: 'Organization.sameAs',
          status: 'warn',
          detail: 'empty — create FB Page + LinkedIn, then populate sameAs[] (cheapest entity-grounding win)',
        }
      : { check: 'Organization.sameAs', status: 'ok', detail: `${sameAs.length} profile(s) wired` },
  );

  // --- Check 5: hardcoded price literals on public surfaces ------------------
  // The CI scanner (lib/public-price-literals.test.ts) can only prove a literal
  // is DECLARED — it has no prod credentials. This is the half that proves a
  // declared literal is still TRUE. Splitting it this way is the lesson from the
  // llms.txt drift: never let both sides of a check be hand-maintained.
  const priceBySku = new Map(input.catalog.map((r) => [r.sku_code, r.price_php]));
  const literalDrift: string[] = [];
  const declaredLiterals = input.literals ?? skuBackedLiterals();
  for (const lit of declaredLiterals) {
    const want = priceBySku.get(lit.sku);
    if (want === undefined) continue; // SKU absent from the active set — Check 1's job.
    const have = parsePesoLiteral(lit.literal);
    if (have !== null && Math.round(want) !== have) {
      literalDrift.push(`${lit.file} says ${lit.literal} but ${lit.sku} is ${pesoFigure(want)}`);
    }
  }
  findings.push(
    literalDrift.length > 0
      ? {
          check: 'hardcoded public price literals',
          status: 'fail',
          detail: `${literalDrift.length} hardcoded figure(s) no longer match the catalog: ${literalDrift.join('; ')}`,
        }
      : {
          check: 'hardcoded public price literals',
          status: 'ok',
          detail: `all ${declaredLiterals.length} declared SKU-backed literal(s) match the catalog`,
        },
  );

  // --- Check 6: the answers to what AI gets wrong (Build 6 Lane K) ---------
  if (input.requiredQuestions && input.requiredQuestions.length > 0) {
    const unanswered = input.requiredQuestions.filter((q) => !body.includes(q));
    findings.push(
      unanswered.length > 0
        ? {
            check: 'llms.txt answers what AI gets wrong',
            status: 'fail',
            detail: `${unanswered.length} of ${input.requiredQuestions.length} saved question(s) missing from the served llms.txt: ${unanswered.join(' · ')}`,
          }
        : {
            check: 'llms.txt answers what AI gets wrong',
            status: 'ok',
            detail: `all ${input.requiredQuestions.length} saved questions are answered`,
          },
    );
  }

  // --- Check 7: retired names and untrue claims (lib/seo/stale-claims.ts) ---
  const stale = findStaleClaims(body);
  findings.push(
    stale.length > 0
      ? {
          check: 'llms.txt retired names',
          status: 'fail',
          detail: `${stale.length} retired name(s) or untrue claim(s): ${stale.map((s) => `"${s.match}" (${s.why})`).join('; ')}`,
        }
      : { check: 'llms.txt retired names', status: 'ok', detail: 'no retired plan, product or claim is named' },
  );

  // --- Check 8: the front pages are in the sitemap ---------------------------
  if (input.sitemapPaths) {
    const listed = new Set(input.sitemapPaths.map(normalizeRoutePath));
    const absent = MUST_BE_IN_SITEMAP.filter((p) => !listed.has(p));
    findings.push(
      absent.length > 0
        ? {
            check: 'sitemap coverage',
            status: 'fail',
            detail: `${absent.length} front page(s) missing from the served sitemap: ${absent.join(', ')}`,
          }
        : {
            check: 'sitemap coverage',
            status: 'ok',
            detail: `all ${MUST_BE_IN_SITEMAP.length} front pages are listed (${listed.size} paths read)`,
          },
    );
  }

  const counts = {
    ok: findings.filter((f) => f.status === 'ok').length,
    warn: findings.filter((f) => f.status === 'warn').length,
    fail: findings.filter((f) => f.status === 'fail').length,
  };

  return { findings, priceDrift, counts };
}
