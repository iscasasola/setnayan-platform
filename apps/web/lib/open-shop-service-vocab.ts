/**
 * PURE half of the /open-shop service picker — no I/O, no `server-only`, so a
 * unit or db test can import it directly. The fetching half lives in
 * `lib/open-shop-service-tree.ts` and composes this.
 *
 * Split for the same reason `booking-fee-gate.ts` is split out of
 * `booking-fee-charge.ts`: the safety-critical predicate has to be testable
 * without a Next.js server runtime. The first attempt put `isFirstPartyService`
 * behind `import 'server-only'` and the db test could not load it at all —
 * a guard you cannot run is not a guard.
 */

export type PickerLeaf = {
  canonicalService: string;
  label: string;
  /** The branch this leaf hangs off — needed to resolve its coarse category. */
  tileId: string;
  /** Allowed event types (vocab keys); null = universal. */
  allowedEventTypes: string[] | null;
};
export type PickerBranch = { tileId: string; label: string; leaves: PickerLeaf[] };
export type PickerParent = { folderId: string; label: string; branches: PickerBranch[] };

/**
 * 🔴 First-party Setnayan service keys — the picker must never offer one.
 *
 * NINE OF THEM ARE ORDINARY MARKETPLACE-VISIBLE LEAVES IN THE ADMIN TAXONOMY,
 * sitting beside the real trades (verified in production 2026-08-09):
 * `setnayan_papic`, `setnayan_ai_edited_highlight` and
 * `setnayan_save_the_date_mp4` under Documentary › Photo & Video, next to
 * `photography`; `setnayan_panood` under Livestream; `setnayan_patiktok` under
 * Booths › Photo Booth; `setnayan_concierge` under Planning › Coordinator; and
 * `setnayan_pakanta` / `setnayan_pailaw` / `setnayan_custom_monogram` under
 * Design › Digital Services.
 *
 * `vendor_market_stats` computes `is_setnayan_service` by array-membership of
 * `vendor_profiles.services` against exactly those keys, and `/explore` excludes
 * every row where it is true. A vendor who picked one would finish onboarding,
 * get verified, and **never appear in the marketplace** — no error, no log.
 *
 * A PREFIX RULE, NOT A COPIED LIST: a tenth SKU named `setnayan_*` is covered
 * the day it is seeded. `tests/db/open-shop-service-tree.db.test.ts` asserts the
 * convention still holds against the live view, so a first-party key that breaks
 * it fails CI rather than shipping a vendor into invisibility.
 */
export function isFirstPartyService(canonicalService: string): boolean {
  return canonicalService.startsWith('setnayan_');
}
