## 2026-11-19 · feat(reach): a shop's range no longer depends on its plan — unverified 0 km, verified sets its own

Owner, 19 Nov, verbatim: *"ok unlock the range. not plan dependend anymore."* · *"Free Unverified account will have a
range of 0km."* · *"but the plan must depend on how many accounts are using it."* This replaces the 18 Nov
5 · 10 · 50 · 100 km · nationwide ladder.

- **One ceiling, and it is verification.** `reachCeilingKm(verified)` in `lib/vendor-service-radius.ts`: ∞ for a
  verified shop, 0 otherwise. `effectiveOuterRadiusKm`, `resolveDeclaredRings`, `travelFeeVerdictForVendor` and
  `validateServiceRadiusPair` take `verified`, never a tier. The typo guard `MAX_DECLARABLE_RADIUS_KM` (1,000 km, the
  existing sane max) is unchanged and the same for every shop.
- **`serviceRadiusKm` is gone from `TIER_CAPS`**, with `reachLadderWords`, `nextPlanReach` and `tierOuterRadiusCapKm`.
- **The save** (`radius-actions.ts`) reads `verification_state` from the database; a verified shop on any plan can
  save 200 km, an unverified one can only clear its rings. Free transport enforcement and `/vendor/fit` read the same.
- **Coverage reach card**: the "next plan reaches X km" upsell and its ⓘ ladder are gone. An unverified shop sees ONE
  locked row, "Coverage reach · Get verified to be found", that opens Get verified (`GetVerifiedLine`).
- **No km per plan anywhere**: Plans table (one "Shown in search · Once verified · you set how far" row for every
  plan), plan cards (`growSpec` / `verifiedSpec`), /for-coordinators, the home vendor benefits, admin plan contents,
  the plan sheet's limits (`PLAN_LIMITS` loses Reach), "What a plan gives you", the downgrade sheet (no reach row) and
  the Open-a-shop ladder.
- Search gates (category search, recommendations, the couple's bench) no longer cut by a plan radius; the shop's own
  declared ring speaks through the travel-fee verdict. Branch auto radius is the column max on every plan.
- No DB function returned a radius per tier (`vendor_tier_limit` has no reach key), so there is no migration.
- New guard: `lib/reach-is-not-a-plan-allowance.test.ts`.
- **"Verified sets its own range" in couple search (review fix):** a verified shop is found only inside its OWN declared
  outer ring (`outer_radius_km`; no ring = no limit). Both search gates — `radiusOk` in `lib/wizard-recommendations.ts`
  and `withinRadius` in the dashboard category search — go through one helper, `reachAdmits` (lib/vendor-service-radius.ts).
  A 20 km ring is not found at 500 km (test). Unverified stays out via `is_findable`.
- Leftover reach-by-plan copy removed (home tier intro, Verification + Supplier plans feature pages, /features How it
  works, the features plan line, one December news post, the shop-reach comment): reach comes from getting Verified.

SPEC IMPACT: None in this PR — the ruling is already logged in the corpus DECISION_LOG on 2026-11-19 (986d99be,
504c4101).
