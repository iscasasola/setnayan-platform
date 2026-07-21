## 2026-07-21 · test(taxonomy): fail the build when a marketplace tile resolves to zero canonical services

A zero-canonical tile is a **silently empty shelf**, and this class of bug has now shipped three times. This adds the guard; it does not seed the data.

**Why a test and not a fix.** Marketplace search resolves tile → canonicals → vendors and short-circuits — `if (canonicals.length === 0) return EMPTY;` (`dashboard/[eventId]/vendors/_actions/category-search.ts`). There is no error, no log, and no empty-state distinct from "nobody has signed up yet", so a tile with zero canonicals renders **exactly** like a healthy tile with no vendors. `getCoverageTaxonomy()` then prunes empty branches on the vendor side (`if (!leaves.length) continue`), so the tile does not merely render empty in the picker — it **does not exist** there. One half of the app advertises the shelf while the other half denies it, and the only production symptom is a whole trade that couples never find and vendors are never booked from. Invisible in code review, invisible in staging.

The fix is *data* (seeding canonicals is sign-off #1 of `Taxonomy_Expo_Gap_Verdict_2026-07-21.md`, and a full seed regeneration re-emits all 84 nodes with `ON CONFLICT DO UPDATE` on every column — it clobbers prod hand-edits). The guard is *code*, ships independently, and is what stops the fourth instance.

**Measured, not transcribed.** The verdict named three dead tiles. Walking `WEDDING_TILE_ORDER` through the marketplace's own `canonicalServicesForTile()` found **two** — `ceremony_venue` (Venue) and `editorial` (Documentary). `filipiniana_barongs` resolves fine; that claim was wrong. Both real ones are allowlisted with their reason, so the suite is green today and loud tomorrow.

**The allowlist is self-cleaning, asserted in both directions.** A dead tile that is not allowlisted fails (new bug); an allowlisted tile that now resolves fine **also** fails (stale entry). The second direction is the point — you cannot fix a tile and leave its entry behind to quietly re-hide the next regression on that same tile. The list can only shrink, and a third test rejects misspelled keys, which would otherwise sit there protecting nothing while reading as if the defect were tracked. Verified by mutation: removing an entry fails test 1, pointing an entry at a healthy tile fails test 2.

**Known and deliberately not encoded:** `reception` resolves to exactly one canonical and it is `accommodation` (lodging, owner directive 2026-05-22) — non-empty, so this guard passes it, but function halls must mis-tag as *accommodation* to surface at all. A count check cannot see a semantic mismatch, and pinning an exact canonical set would fail on every legitimate edit and teach the next reader to ignore the file. Tracked in the expo verdict as `reception_venue`.

Pre-existing on `main` and unrelated: 5 unit failures (pHash ×4, `vendor-deep-search`) — identical count before and after this change.

SPEC IMPACT: None. The two dead tiles remain open as `Taxonomy_Expo_Gap_Verdict_2026-07-21.md` sign-off #1 (`ceremony_venue_booking`); `editorial`'s leaf naming still needs an owner call.
