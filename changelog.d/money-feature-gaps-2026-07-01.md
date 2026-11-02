## 2026-07-01 · fix(vendor/money+correctness): close 4 gap-audit money + feature-correctness gaps

Four fix-forward edits to already-merged code from a gap audit. No new
migrations (every DB column already exists).

1. **Token-copy LIE on three for-vendors surfaces** — verified-unlock is NOT
   free: the live `unlock_vendor_event` RPC puts verified on the burning path
   (capped ≤10 unlocks/week AND burns 1–3 region-banded tokens per accept;
   Solo/Pro/Enterprise are uncapped + also burn). Reconciled the public copy to
   the truth, mirroring the already-correct wording in
   `app/_components/home/vendor-benefits.ts` + `vendor-pricing-matrix.tsx`:
   - `for-vendors/_components/page-tail.tsx` — "How does Setnayan make money?"
     FAQ: dropped "Verified vendors get up to 10 free unlocks a week"; now states
     every unlock burns 1–3 region-banded tokens, verified capped ≤10/wk (still
     burns), Solo/Pro/Enterprise uncapped (still burn).
   - `for-vendors/_components/vendor-vision.tsx` — "Free weekly unlocks to start"
     → "Weekly unlocks to start", body corrected to ≤10/wk-and-burns vs
     uncapped-and-burns.
   - `for-vendors/_components/stack-close-vendor.tsx` — "Verified is free" →
     "The verified badge is free" so the TRUE badge/listing-is-free meaning can
     no longer read as "unlocks are free".

2. **Under-charge leak (root-cause)** — `dashboard/[eventId]/vendors/build-anchors-actions.ts`
   wrote the Build-tab Location anchor as arbitrary free text (a city like
   "Tagaytay") straight onto `events.region`. The burn RPC alias-resolves only
   slug/psgc_code/aliases[], so a city string floored to band-1 = a silent
   inquiry-burn under-charge (CALABARZON band-3 ₱300 charged at ₱100). FIX at
   write time: new `normalizeRegionAnchor()` resolves the typed value to the
   canonical region slug — `resolveRegion()` for an exact region spelling, else
   `regionSlugForCity()` (DB city-alias cache), else `regionForCity()` (returns
   PSGC) → `regionByPsgc().slug`; unrecognized free text is kept verbatim
   (capped) as an explicit narrow fallback rather than the default. `events.region`
   is a single column with no separate display field, so the resolved slug is what
   we persist. FORWARD-FIX ONLY — existing mis-stored rows need a separate
   backfill follow-up (not in this PR).

3. **Stale comment** — `vendor-dashboard/services/actions.ts` claimed the founder
   "token-gate bypass lives in unlock_vendor_event". That bypass was DROPPED at
   migration 20270221294989 and no longer exists. Reworded: founders get
   unlimited categories/services-per-leaf ONLY; there is NO founder token-gate
   bypass — founders burn tokens like any paid tier.

4. **Reverse-image threshold had no admin UI** — `platform_settings
   .repost_watch_hamming_threshold` is read by `lib/vendor-image-repost-watch.ts`
   and the comments claimed it was "admin-managed via /admin/settings", but no
   field rendered it and no action persisted it. Added a numeric input
   (`name="repost_watch_hamming_threshold"`, min 0 / max 64) to the
   `/admin/settings` business-identity form; `saveBusinessIdentity` now parses,
   rejects non-numeric, and clamps to 0..64 before persisting. Corrected the two
   stale comments (`lib/platform-settings.ts` type doc + `vendor-image-repost-watch.ts`
   header) to point at the real surface. The DB column already exists
   (migration 20270330665855); no migration added.

SPEC IMPACT: None — corpus already documents the verified-burns model
(DECISION_LOG 2026-07-01 burn-band single source) and the admin-managed
repost-watch threshold. These edits make the shipped code/copy match the
already-canonical spec; no corpus rows change.
