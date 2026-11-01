/**
 * deep-search-findings.ts — 🔎 WHAT DEEP SEARCH GIVES A SUPPLIER, IN THE WORDS EVERY SURFACE USES (owner 2026-10-29,
 * Supplier dashboard v13 note 2: *"Deep Search is explained, not 'fill in my details'"*).
 *
 *   Shop › Details' card ("See what the web says about your shop"), the result (`DossierView`) and the PDF of a search
 *   (`lib/deep-search-pdf.ts`) all name the same five findings, in the same order, from THIS list — so the card never
 *   promises a heading the result or the file does not carry.
 *
 * ── THE PRICE IS NEVER TYPED HERE ──────────────────────────────────────────
 * The band words are BUILT from the one price source the run action charges from: the 2026-07-25 band matrix
 * (`VENDOR_ADDON_TIER_PRICES_PHP.deep_search_about_you`) while `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` is on, else
 * the admin catalogue row (`vendor_billing_catalog.vendor_deep_search`, read by the caller). Who gets the free search
 * each 28 days is `deepSearchHasFreeAllowance` (Pro and up) — the old "1 free on Solo" line was wrong (owner note 2).
 *
 * ── HOW LONG A SEARCH IS KEPT ───────────────────────────────────────────────
 * `DEEP_SEARCH_KEEP_DAYS` is the ONE number: the retention sweep (`lib/vendor-dossier-retention.ts`) deletes a result
 * at this age, the card says it, and the PDF route refuses a file of a result older than it — so the PDF of a search
 * lives exactly as long as the search (owner, with the v13 approval: *"run search would also create a pdf file of the
 * search created"*).
 *
 * PURE: no I/O, no env read (the caller passes the flag's answer).
 */
import { VENDOR_ADDON_TIER_PRICES_PHP } from '@/lib/vendor-addon-tier-pricing';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import type { VendorDossier } from '@/lib/vendor-deep-search';

/** A Deep Search result is kept this many days, then deleted (RA 10173 storage limitation). */
export const DEEP_SEARCH_KEEP_DAYS = 180;

export type DeepSearchFindingKey = 'summary' | 'services' | 'prices' | 'presence' | 'flags';

/** The five findings, in the card's order: the heading, and one short line of what it is. */
export const DEEP_SEARCH_FINDINGS: ReadonlyArray<{ key: DeepSearchFindingKey; title: string; line: string }> = [
  { key: 'summary', title: 'Business summary', line: 'How the web describes you' },
  { key: 'services', title: 'Services we found', line: 'Ready to become service cards' },
  { key: 'prices', title: 'Prices we found', line: 'Your rates as posted elsewhere' },
  { key: 'presence', title: 'Where you show up', line: 'Pages, listings and reviews' },
  { key: 'flags', title: 'Things to double-check', line: 'Old numbers, wrong addresses' },
];

export const deepSearchFindingTitle = (k: DeepSearchFindingKey): string =>
  DEEP_SEARCH_FINDINGS.find((f) => f.key === k)!.title;

/** How many of each finding a result carries — the card's "Last search" line and the PDF's figures. */
export function deepSearchCounts(d: VendorDossier): Record<Exclude<DeepSearchFindingKey, 'summary'>, number> {
  return {
    services: d.detected_services.length,
    prices: d.price_signals.length,
    presence: d.web_presence.length,
    flags: d.consistency_flags.length,
  };
}

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

/**
 * The per-search price on each side of the band. Tiered (the flag on): the matrix's two figures. Flat (the flag off):
 * the catalogue's one price for everyone — `catalogPhp` must be the caller's READ of the catalogue, never a literal.
 */
export function deepSearchBand(input: { tiered: boolean; catalogPhp: number }): { entryPhp: number; growthPhp: number } {
  if (input.tiered) {
    const b = VENDOR_ADDON_TIER_PRICES_PHP.deep_search_about_you;
    return { entryPhp: b.entry, growthPhp: b.growth };
  }
  return { entryPhp: input.catalogPhp, growthPhp: input.catalogPhp };
}

/**
 * The band in words, for the card's ⓘ: "₱1,000 a search on Free and Solo · ₱500 on Pro and Ultra, with 1 free every
 * 28 days on Pro and Ultra." One price for everyone reads "₱500 a search on every plan, with 1 free …".
 */
export function deepSearchBandWords(band: { entryPhp: number; growthPhp: number }, periodDays: number): string {
  const entry = `${TIER_LABEL.free} and ${TIER_LABEL.solo}`;
  const growth = `${TIER_LABEL.pro} and ${TIER_LABEL.enterprise}`;
  const free = `1 free every ${periodDays} days on ${growth}`;
  return band.entryPhp === band.growthPhp
    ? `${peso(band.entryPhp)} a search on every plan, with ${free}.`
    : `${peso(band.entryPhp)} a search on ${entry} · ${peso(band.growthPhp)} on ${growth}, with ${free}.`;
}

/** The date a result stops being kept (and its PDF with it). */
export function deepSearchKeptUntil(createdAt: string, keepDays = DEEP_SEARCH_KEEP_DAYS): Date | null {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) ? new Date(t + keepDays * 24 * 60 * 60 * 1000) : null;
}

/** Still inside its keep window at `nowMs`. An unreadable stamp is NOT kept (fail closed: no file of unknown age). */
export function deepSearchStillKept(createdAt: string, nowMs: number, keepDays = DEEP_SEARCH_KEEP_DAYS): boolean {
  const until = deepSearchKeptUntil(createdAt, keepDays);
  return until !== null && nowMs < until.getTime();
}

/** Where a search's PDF is made (`app/api/vendor/deep-search-pdf/route.ts`) — the Share button's `href`. */
export const deepSearchPdfHref = (dossierId: number): string => `/api/vendor/deep-search-pdf?dossier=${dossierId}`;

/** The file's name — "setnayan-deep-search-2026-10-29.pdf". */
export function deepSearchPdfFileName(searchedAt: string | null | undefined): string {
  const t = searchedAt ? Date.parse(searchedAt) : NaN;
  const ymd = Number.isFinite(t) ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : 'result';
  return `setnayan-deep-search-${ymd}.pdf`;
}
