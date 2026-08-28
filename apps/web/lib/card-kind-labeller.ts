import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { buildLeafIndex, cardKindLabel } from '@/lib/service-card-kind';
import {
  isCanonicalService,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@/lib/vendors';

/**
 * card-kind-labeller.ts — ONE NAME FOR A CARD'S KIND, ON EVERY SCREEN.
 *
 * 🔴 WHY THIS EXISTS. `vendor_services.category` may now hold either vocabulary
 * (owner 2026-08-28, *"yes their own words"*): a COVERAGE LEAF the supplier
 * chose in their own words, or a legacy `VENDOR_CATEGORIES` key. Before this,
 * six separate screens each wrote their own version of the same fallback —
 * `isCanonicalService(cat) ? VENDOR_CATEGORY_LABEL[cat] : cat` — and **the last
 * branch prints the raw database key**.
 *
 * That was not theoretical even before leaves became choosable: both service
 * cards in production hold `live_band` / `host_mc`, which are tile ids and not
 * in the 52, so those screens were already one published shop away from showing
 * a couple a database key. It is the exact harm `lib/vendors.ts` recorded on
 * 2026-08-09 — *"NEVER PRINT A DATABASE KEY AT A COUPLE"* — surviving in a
 * different fallback, in six places, because the rule was fixed at one site.
 *
 * 🔑 SO THE FALLBACK CHAIN IS WRITTEN ONCE: the shop's own coverage word wins,
 * then the legacy label, then a humanised key. A screen cannot opt out of the
 * last step by forgetting it.
 *
 * ⚠ SERVER-ONLY BY DEPENDENCY (it reaches the Supabase server client through
 * `getCoverageTaxonomy`), which is why the rule itself lives in the PURE
 * `lib/service-card-kind.ts` and only this thin wrapper is unreachable from a
 * `node:test`. `server-only` is not installed in this repo, so a guard can still
 * read this file as source — it just cannot execute it.
 *
 * One taxonomy read per render tree: `getCoverageTaxonomy` is `cache()`d, so
 * several callers in one page cost one round trip.
 */
export type CardKindLabeller = (key: string) => string;

/**
 * Build the labeller for this request.
 *
 * FAIL-SOFT: an unreadable taxonomy yields an empty leaf index, so every kind
 * falls through to the legacy label or a humanised key — degraded wording, never
 * a thrown page and never a raw key.
 */
export async function cardKindLabeller(): Promise<CardKindLabeller> {
  const leaves = buildLeafIndex(await getCoverageTaxonomy().catch(() => []));
  return (key: string) =>
    cardKindLabel(
      key,
      leaves,
      isCanonicalService(key) ? VENDOR_CATEGORY_LABEL[key as VendorCategory] : null,
    );
}
