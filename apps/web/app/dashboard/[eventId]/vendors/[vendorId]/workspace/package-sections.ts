/**
 * WHAT THE SERVICE WORKSPACE PRINTS UNDER "WHAT'S INCLUDED".
 *
 * 🔧 A day-of view may not claim a vendor is delivering something they are not.
 *
 * Two overstatements shipped on that heading:
 *
 *   1. REMOVED LINES. The page selected `package_id, status,
 *      total_locked_centavos` off `event_vendor_packages` and never read
 *      `customizations_json`, so `removed_item_ids` was invisible to it. A line
 *      the couple explicitly removed on the booking receipt kept printing under
 *      "What's included" here.
 *   2. ADD-ONS. A line with `is_default_included = false` is never inside
 *      `total_price_centavos` and is never charged, yet it rendered in the SAME
 *      list as bought lines — a dimmed tick and an inline " (optional add-on)"
 *      suffix under a heading that still said "What's included".
 *
 * ── THE RULING (owner, 2026-07-27) ──────────────────────────────────────────
 * REMOVED LINES ARE HIDDEN HERE. ADD-ONS GET THEIR OWN LABELLED SECTION.
 *
 * The two pages answer different questions. `packages/[bookingId]` is the
 * RECEIPT — "what did we agree, and what changed?" — so a removed line belongs
 * there, and it already prints one under "Removed". This page is the SERVICE
 * DETAIL / DAY-OF view — "what is this vendor actually delivering?" — and a
 * removed line is not being delivered. A struck-through line on an operational
 * view is noise that misreads at a glance, exactly when a couple is scanning
 * quickly.
 *
 * Hiding is not a claim, it is an omission — it cannot be false. The defect was
 * ASSERTING that removed lines are included; omitting them ends the assertion.
 * Verification of what was removed lives on the receipt, which is the record.
 *
 * ⚠ BOTH PAGES USE THE SAME `receiptSections` HELPER, so they can never
 * disagree about which BUCKET a line falls in — only about which buckets they
 * choose to DISPLAY. That is a deliberate presentation difference, not drift.
 * Said out loud here because the difference will otherwise read as the bug this
 * wave exists to close.
 *
 * Add-ons DO show, in their own clearly-labelled section: on a service-detail
 * view "what else this vendor offers on this package" is live, useful context,
 * and the owner's design models the couple side as Included · add-ons ·
 * requests. An add-on is a live option; a removed line is a settled past
 * decision.
 *
 * Pure module — no React, no Supabase, no clock. That is the point: the rule is
 * testable without rendering a server component.
 */

import { receiptSections } from '@/app/dashboard/[eventId]/vendors/packages/[bookingId]/receipt-sections';
import type {
  VendorPackageItemRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';

export type WorkspaceSections = {
  /** Being delivered. Inside `total_price_centavos`, minus what was removed. */
  included: ReadonlyArray<VendorPackageItemRow>;
  /** Offered on this package, never charged, never booked. Own section. */
  addOns: ReadonlyArray<VendorPackageItemRow>;
};

/**
 * The two lists this page prints.
 *
 * `receiptSections` owns the bucketing — included · notIncluded · removed — and
 * is imported, never re-derived. This function only drops the bucket the
 * service-detail view does not show. If the rule ever changes, it changes for
 * both pages at once, which is the whole reason the helper is shared.
 */
export function workspaceSections(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): WorkspaceSections {
  const { included, notIncluded } = receiptSections(pkg, removedItemIds);
  return { included, addOns: notIncluded };
}

/**
 * `removed_item_ids` out of a stored `customizations_json`, defensively.
 *
 * The column is typed `PackageCustomizations` in TypeScript and `jsonb` in the
 * database, which means the type is a PROMISE, not a guarantee: the shape is
 * whatever was written, by whatever version of whatever client. So this reads
 * it as `unknown` and degrades to an empty list for every shape that is not
 * literally an array of non-empty strings.
 *
 * ⚠ EMPTY MEANS "NOTHING WAS REMOVED", so this must never be reached by a
 * FAILED READ. A PostgREST error is not a malformed value — it is no value at
 * all, and treating it as "no removals" would print removed lines as included,
 * i.e. the exact defect. The caller checks `error` and throws; this function
 * only ever sees a row that came back.
 */
export function parseRemovedItemIds(value: unknown): string[] {
  const source = typeof value === 'string' ? safeJsonParse(value) : value;
  if (source === null || typeof source !== 'object') return [];
  const ids = (source as { removed_item_ids?: unknown }).removed_item_ids;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && id !== '');
}

/** One level, never throws. A `json`-typed column can arrive as text. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
