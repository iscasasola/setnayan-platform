## 2026-07-21 · fix(shortlist): inverse category bridge must return a bucketable category — repairs the Budget regression from #3466

Fix-forward on PR #3466. That PR added a third, canonical-fill pass to
`CATEGORY_TO_TILE` so the 14 non-wedding gap leaves (tour_guide,
referee_official, event_medic, …) stop vanishing from the Shortlist. The
**forward** direction was correct and is untouched. The **inverse** map
(`TILE_TO_CATEGORY` → `categoryForTile`) is built from the same object, so those
14 tiles silently flipped their write-back value from `'misc'` to the leaf name.

`categoryForTile` is a WRITE path — `app/vendor/fit/[ref]/page.tsx:110` stores
its result in `event_vendors.category`, and that stored value is exactly what the
Budget tab's `bucketVendorsByGroup` keys on. None of the 14 leaves is in any
`PLAN_GROUP`, and the bucketer had no catch-all, so **a vendor added via the
fit-QR flow disappeared from Budget** (measured: 14 of the taxonomy's tiles).
`'misc'` — the old value — is in the `logistics` group, so this was a pure
regression against main.

- `lib/shortlist-taxonomy.ts` — `TILE_TO_CATEGORY` now skips any category no plan
  group claims, so the tile falls through to the bucketable `'misc'` default
  exactly as before #3466. Hard invariant documented on the map and on
  `categoryForTile`.
- `lib/wedding-plan-groups.ts` — `bucketVendorsByGroup` gains a catch-all
  (`UNBUCKETED_FALLBACK_GROUP = 'logistics'`, where `misc` already lives). Belt
  and braces: the map fix stops NEW bad writes, the catch-all surfaces rows
  already written while #3466 was live and any written by another path.
- `lib/wedding-plan-groups.ts` + `lib/todays-one-thing.ts` +
  `lib/setnayan-ai-cockpit.ts` — the catch-all is **stamped**
  (`PlanCardPick.bucketed_by_fallback`) and the lock/progress consumers ignore
  stamped picks. `bucketVendorsByGroup` is not a Budget-only helper: three of its
  four callers read completeness off the bucketed map. A raw catch-all would have
  made one contracted `av_production` row read as "Logistics & Misc is locked" —
  `countUnlockedCategories` returning 20 instead of 21 and the home hero
  permanently dropping the transport / security / giveaways nudge. Display
  surfaces still render the row; it just doesn't vote on a group it never
  belonged to. (Caught in adversarial review — same shape as the #3466 defect
  this PR repairs: a shared helper changed, its other callers untraced.)
- `lib/wedding-plan-groups.ts` — `planGroupForCategory`'s docstring no longer
  claims to "mirror `bucketVendorsByGroup`". The two now deliberately diverge
  (bucketer catches all, resolver stays null-returning for the finalize gate) and
  restoring parity in either direction re-breaks one half.
- `lib/shortlist-taxonomy.ts` — the pick-preservation invariant ("a couple's
  existing pick must never vanish from their own Shortlist") was carried only by
  the hidden-tile guard. The event-type and faith guards now carry the same
  `vendors.length === 0` qualifier, so a considered pick survives an event-type
  or rite change instead of being dropped wholesale.
- `lib/shortlist-taxonomy-coverage.test.ts` — 12 tests, **every assertion
  mutation-verified** (each guarded line reverted in turn, failure observed,
  restored): every tile's write-back is `planGroupForCategory`-bucketable (the
  assertion whose absence hid the regression); the bucketer's catch-all; the
  catch-all's *scope* (a category newly falling out of a plan group fails loudly
  instead of being swept into Logistics); the stamp + its lock/progress
  consequences; and all three legs of the pick-preservation invariant at the
  `buildShortlistFolders` level — event-type, faith, and hidden-tile. The faith
  and hidden guards previously had NO test: reverting either left the whole suite
  green, which is exactly how the last regression survived. The old "gap-leaf
  round-trip" test hard-coded `=== 'misc'`; it now asserts the *invariant*
  (bucketability), so the owner's recommended data follow-up — adding the 14
  leaves to real plan groups — won't turn a correct fix into a red build.

SPEC IMPACT: None. No SKU, price, schema or product-surface change — this
restores pre-#3466 write behaviour for 14 taxonomy tiles and hardens an existing
invariant.
