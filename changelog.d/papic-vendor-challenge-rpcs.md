## 2026-07-22 · feat(papic-games): Phase 4a — custom vendor challenge data layer

The data layer for the paid custom vendor challenge (spec §3.4 / §3.6). A booked
vendor authors custom copy; it lands hidden until the couple approves it. No
table changes — Phase 1's `papic_missions` already carries `source` / `vendor_id`
/ `approved`. Flag-gated at the call site (`NEXT_PUBLIC_PAPIC_GAMES_V1`, OFF).

- **Migration** `20270902380131_papic_vendor_challenge_rpcs.sql` — three
  `SECURITY DEFINER` RPCs (event_vendors has no vendor RLS; papic_missions is a
  couple table, so a vendor reaches neither directly):
  - `papic_create_vendor_challenge(p_event_id, p_prompt)` — a **booked paid
    Pro-and-up** vendor (`pro`/`enterprise`/`custom`) authors a challenge
    (`source='vendor'`, `approved=false`). Booked-gated on
    `event_vendors.marketplace_vendor_id` + booked status (mirrors
    `get_vendor_event_brief`); tier gate matches the ratified Pro+ precedents
    (includes `custom`, the tier above Enterprise). Bounds the copy to the
    1..280 CHECK.
  - `papic_review_vendor_challenge(p_mission_id, p_approve)` — the
    **couple/coordinator** approves (→ live) or rejects (→ deactivated) a pending
    vendor challenge (§3.6). `FOR UPDATE` + status-precondition single-winner
    UPDATE (mirrors `respond_vendor_proposal`).
  - `papic_vendor_challenges(p_event_id)` — a booked vendor reads their own
    challenges + status + completion count (non-PII aggregate; photos stay
    DPO-gated for Phase 5).
- **`lib/papic-games.ts`** — `createVendorChallenge` (tagged result so the UI can
  tell "needs Pro" from "not booked"), `reviewVendorChallenge`,
  `fetchVendorChallenges` (flag-guarded).
- **`lib/papic-missions.ts`** — `VendorChallengeRow` type + pure
  `vendorChallengeStatus` (pending/live/rejected); 6 tests total, all passing.

SPEC IMPACT: **Surfaced for owner sign-off — §3.4 prices the custom challenge at
"₱400/event · unlimited on Pro+" (₱400 = 2 retired tokens).** Tokens are retired
and there is NO per-event vendor add-on entitlement table, so the ₱400
pay-per-event path for Solo/Verified vendors is NOT buildable yet. This layer
enforces the buildable half — **paid Pro-and-up unlimited**
(`pro`/`enterprise`/`custom`; the "upgrade to Pro on challenges alone"
crossover). The Solo pay-per-use path is deferred to a
vendor add-on entitlement (owner decision). Phase 4b = the two UI surfaces
(vendor authoring in `vendor-dashboard/clients/[eventId]`, couple approval in
`dashboard/[eventId]/studio/papic`).
