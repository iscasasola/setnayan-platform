import type { CoverageParent } from '@/lib/vendor-coverages';

/**
 * service-card-kind.ts — WHAT A SERVICE CARD IS FILED UNDER, IN THE SHOP'S OWN
 * WORDS.
 *
 * 🔴 THE DECISION THIS IMPLEMENTS (owner 2026-08-28, asked and answered twice:
 * *"yes their own words"*). A supplier said what they sell TWICE, in two lists
 * that do not agree:
 *
 *   · COVERAGE speaks the live admin taxonomy — 262 visible leaves. SetnaProd
 *     covers a leaf called **Pabati**.
 *   · SERVICE CARDS spoke `VENDOR_CATEGORIES` — 52 keys hardcoded in
 *     `lib/vendors.ts`, with no *Pabati* in it and no way to add one without a
 *     deploy.
 *
 * The maker bridged them BY FAMILY, which is correct and is not the same as the
 * two lists agreeing: a Pabati shop was asked to file under *Photobooth*.
 *
 * 🔑 SO A CARD'S KIND MAY NOW BE A COVERAGE LEAF, AND THE LEGACY LIST STAYS AS
 * THE FALLBACK. Nothing is removed and nothing is migrated — a supplier's own
 * words lead, and the 52 remain one tap below for a shop whose coverage does not
 * cover what this card is for. Both vocabularies are legal in
 * `vendor_services.category`, which is why every reader goes through this file
 * instead of asking `VENDOR_CATEGORIES` and printing the raw key when the answer
 * is no.
 *
 * 🔢 SAFE BY ARITHMETIC, MEASURED IN PRODUCTION 2026-08-28 BEFORE THIS WAS
 * WRITTEN: 2 shops · 2 coverage rows · 2 card rows, and BOTH cards belong to one
 * seeded fixture shop (`created_at` identical to the microsecond, shop hidden
 * from the public). **No supplier has ever authored a service card.** There is
 * nothing to migrate, and this is the last moment that is true.
 *
 * ⛔ THE COUPLE SIDE IS NOT THIS AND MUST NOT FOLLOW. `event_vendors.category`
 * is a DIFFERENT column holding a couple's own private supplier list — 45 real
 * rows in production, all 15 distinct values legitimate legacy keys. It stays on
 * `VENDOR_CATEGORIES`. Nothing here touches it.
 *
 * ⚖ AND A COUPLE'S SEARCH IS UNAFFECTED, WHICH IS WHY THIS IS SAFE. Measured:
 * every supplier-discovery path filters `vendor_profiles.services[]` — the
 * COVERAGE words — and every `?category=` link the app emits carries a canonical
 * leaf key. `vendor_services` is read on `/explore` only for the price floor,
 * the photo and the off-peak badge, never as the category filter. Changing what
 * a card is filed under moves nothing a couple types or gets back.
 *
 * 🔒 PURE ON PURPOSE — no `@/lib/supabase/*` import, so this is reachable from a
 * plain `node:test` file. The caller fetches the tree (`getCoverageTaxonomy()`)
 * and hands it in; `server-only` is not installed in this repo, so a module that
 * reaches the server client cannot be unit-tested at all.
 */

/**
 * Leaf key → the two things every reader needs: the supplier's own word for it,
 * and the tier-1 family it counts against for plan caps.
 *
 * Built from the SAME tree the coverage picker renders (`getCoverageTaxonomy`),
 * so a leaf that is retired or marketplace-hidden is absent here for exactly the
 * reason it is absent there — one visibility rule, asked once.
 */
export type LeafIndex = {
  readonly label: ReadonlyMap<string, string>;
  readonly folder: ReadonlyMap<string, string>;
};

/** An empty index — every lookup misses, so every caller falls back to legacy. */
export const EMPTY_LEAF_INDEX: LeafIndex = { label: new Map(), folder: new Map() };

/**
 * Flatten the coverage tree into the leaf lookups.
 *
 * ⚠ FAILS TOWARD LEGACY, NEVER TOWARD EMPTY MEANING. A tree that could not be
 * read yields an index in which nothing is a leaf, so every caller behaves
 * exactly as it did before this file existed. The opposite default — treating an
 * unknown key as a leaf — would print a database key at a couple the first time
 * the taxonomy read hiccuped.
 */
export function buildLeafIndex(tree: readonly CoverageParent[]): LeafIndex {
  const label = new Map<string, string>();
  const folder = new Map<string, string>();
  for (const parent of tree) {
    for (const branch of parent.branches) {
      for (const leaf of branch.leaves) {
        label.set(leaf.canonicalService, leaf.label);
        folder.set(leaf.canonicalService, parent.folderId);
      }
    }
  }
  return { label, folder };
}

/** Is this stored kind one of the shop's own taxonomy words? */
export function isCoverageLeafKind(key: string, index: LeafIndex): boolean {
  return index.label.has(key);
}

/**
 * Humanise a key we have no better name for.
 *
 * 🔑 NEVER RETURNS THE RAW KEY. `lib/vendors.ts` learned this on 2026-08-09
 * ("NEVER PRINT A DATABASE KEY AT A COUPLE") after `pre_nup_photographer`
 * reached the public shop page and schema.org, and the rule is repeated here
 * because the shop page's OWN card fallback still printed the key for any
 * category outside the 52 — which is the state both production cards are in
 * (`live_band`, `host_mc`).
 */
export function humanizeKind(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * THE ONE NAME FOR A CARD'S KIND, wherever it is shown.
 *
 * Order is deliberate and is the whole point of the change: **the shop's own
 * coverage word wins**, then the legacy label if the caller has one, then a
 * humanised key. A supplier who wrote *Pabati* reads *Pabati* — on their own
 * list, in the couple's chat, on the public shop page and in the QR picker.
 *
 * `legacyLabel` is passed rather than looked up so this file never imports the
 * legacy list: callers that already hold `VENDOR_CATEGORY_LABEL` (or the live
 * tile label via `labelForVendorCategory`) hand in whichever is right for them.
 */
export function cardKindLabel(
  key: string,
  index: LeafIndex,
  legacyLabel?: string | null,
): string {
  const leaf = index.label.get(key);
  if (leaf && leaf.trim().length > 0) return leaf;
  const legacy = legacyLabel?.trim();
  if (legacy && legacy.length > 0) return legacy;
  return humanizeKind(key);
}

/**
 * The tier-1 families a stored kind counts against, when that kind is a leaf.
 *
 * `null` means "not a leaf" — the caller must fall back to
 * `parentsOfCategory()`, the legacy bridge. An empty array is a DIFFERENT
 * answer: a leaf whose folder could not be resolved counts against no family, so
 * it can never be refused by the family cap.
 *
 * ⚖ FAILS OPEN, matching `standingForCategory`'s own contract. A cap that
 * mis-reads must not delete a kind a supplier is entitled to sell; the save's
 * gate still runs either way.
 */
export function leafFamilies(key: string, index: LeafIndex): string[] | null {
  if (!index.label.has(key)) return null;
  const folder = index.folder.get(key);
  return folder ? [folder] : [];
}
