/**
 * deep-search-findings.ts — 🔎 WHAT DEEP SEARCH GIVES A SUPPLIER, IN THE WORDS EVERY SURFACE USES (owner 2026-10-29,
 * Supplier dashboard v13 note 2: *"Deep Search is explained, not 'fill in my details'"*).
 *
 *   Shop › Details' card ("See what the web says about your shop"), the result (`DossierView`) and the PDF of a search
 *   (`lib/deep-search-pdf.ts`) all name the same five findings, in the same order, from THIS list — so the card never
 *   promises a heading the result or the file does not carry.
 *
 * ── NOTHING IS SOLD, NO NUMBER IS TYPED HERE ────────────────────────────────
 * Since 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH") Deep Search
 * has no price: Plus, Pro and Ultra include `platform_settings.deep_search_runs_per_month` runs each paid month (read
 * by the caller, `fetchDeepSearchRunsPerMonth`), Free and Verified none. The words below are BUILT from that read —
 * never a typed count, never a peso.
 *
 * ── HOW LONG A SEARCH IS KEPT ───────────────────────────────────────────────
 * `DEEP_SEARCH_KEEP_DAYS` is the ONE number: the retention sweep (`lib/vendor-dossier-retention.ts`) deletes a result
 * at this age, the card says it, and the PDF route refuses a file of a result older than it — so the PDF of a search
 * lives exactly as long as the search (owner, with the v13 approval: *"run search would also create a pdf file of the
 * search created"*).
 *
 * PURE: no I/O, no env read (the caller passes the flag's answer).
 */
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import { formatCount } from '@/lib/format-number';
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

/** "Plus, Pro and Ultra" — the plans that include Deep Search, in the plan words people read. */
export const DEEP_SEARCH_PLANS_WORDS = `${TIER_LABEL.solo}, ${TIER_LABEL.pro} and ${TIER_LABEL.enterprise}`;

/** "1 search" / "3 searches". */
export const deepSearchRunsWords = (n: number): string => `${formatCount(n)} ${n === 1 ? 'search' : 'searches'}`;

/**
 * What the plans include, in words, for the card's ⓘ and the plan rows: "Included in Plus, Pro and Ultra: 1 search
 * each paid month. Unused searches don't carry over." `null` (the admin has not set it) says no number; an unread
 * setting is the caller's "couldn't read", never this.
 */
export function deepSearchAllowanceWords(perMonth: number | null): string {
  if (perMonth === null) return `Included in ${DEEP_SEARCH_PLANS_WORDS}.`;
  return `Included in ${DEEP_SEARCH_PLANS_WORDS}: ${deepSearchRunsWords(perMonth)} each paid month. Unused searches don’t carry over.`;
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
