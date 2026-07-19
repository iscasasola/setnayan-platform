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
};

export type HealthCheckInput = {
  /** The body of the served llms.txt (footer changelog excluded is fine either way). */
  llmsText: string;
  /** Live active priced SKUs — platform_retail_catalog_v2 (retail) + vendor_billing_catalog (vendor). */
  catalog: CatalogRow[];
  /** Env presence flags — the owner-action nags. */
  env: {
    googleSiteVerification?: string;
    bingSiteVerification?: string;
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
  '/why-setnayan',
  '/how-it-works',
  '/features',
  '/pricing',
  '/explore',
  '/explore/compare',
  '/explore/categories',
  '/vendors',
  '/open-shop',
  '/v/',
  '/setnayan-ai',
  '/papic',
  '/panood',
  '/pa3d',
  '/palogo',
  '/pawebsite',
  '/patiktok',
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
  '/tl',
  '/tl/about',
  '/tl/features',
  '/tl/how-it-works',
]);

/** Peso figure from a PHP amount, e.g. 1299 → "₱1,299" (matches the copy's format). */
export function pesoFigure(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-US')}`;
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
  const stripped = path.replace(/\/+$/, '');
  if (stripped.startsWith('/v/')) return '/v/';
  return stripped;
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
    if (row.source === 'retail' && !retailFigures.has(fig)) retailFigures.set(fig, row.sku_code);
  }

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
  if (!input.env.googleSiteVerification) missingTokens.push('Google Search Console');
  if (!input.env.bingSiteVerification) missingTokens.push('Bing Webmaster');
  findings.push(
    missingTokens.length > 0
      ? {
          check: 'verification tokens',
          status: 'warn',
          detail: `not configured: ${missingTokens.join(' + ')} (owner: paste tokens into Vercel env)`,
        }
      : { check: 'verification tokens', status: 'ok', detail: 'Google + Bing verification present' },
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

  const counts = {
    ok: findings.filter((f) => f.status === 'ok').length,
    warn: findings.filter((f) => f.status === 'warn').length,
    fail: findings.filter((f) => f.status === 'fail').length,
  };

  return { findings, priceDrift, counts };
}
