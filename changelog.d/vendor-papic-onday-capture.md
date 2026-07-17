## 2026-07-18 · feat(vendor): on-the-day Papic capture — tier brain + capture-points model

Builds the vendor on-the-day Papic capture controller (owner-locked 2026-07-18).
A vendor's free capture tier for a booked event is **earned by how they accepted
the inquiry**, never chosen:

- Accepted by **spending a lead token**, or a **founder**-comped (token-free,
  as-if-paid) accept → **Papic Ltd** (70 capture points, photos + 5s clips).
- Any other accept (no token) → **Papic Lite** (20 points, **photos-only**).
- Event-scoped **+₱50 upgrade to Papic Unli** (unlimited). Non-transferable.

Capture-points currency: 1 photo = 1 pt · 1×5s clip = 3 pts. The base tier
(Lite/Ltd) is **derived live** from `vendor_event_unlocks` (`comp_reason` +
`tokens_burned`/`lead_token_holds`) — never stored; only the paid Unli upgrade is
persisted (`vendor_papic_capture_grants.tier='unli'`), so **no new migration** is
needed for the core.

This slice (the brain, no guest-PI surface yet):
- `apps/web/lib/vendor-papic-tier.ts` — pure tier + capture-points model
  (`baseTierFromProvenance`, `resolveVendorPapicTier`, `canCapture`,
  `captureAllowance`, `tierReadout`) + 16 unit tests.
- `apps/web/lib/vendor-papic-grants.ts` — the DB derivation over that model
  (`deriveVendorPapicTier`, `fetchVendorPapicAllowance`), service-role reads,
  **fail-closed** to Lite (a free perk only ever under-grants; the Unli check is
  money logic and never opens on error).
- The launcher step-2 module card now shows the derived tier as a **readout
  badge** ("Papic Ltd · 70 pts · photos + video") when the capability is live;
  module copy updated off the old "free 10 + 3".

**Still counsel-gated / flag-OFF** — the whole surface stays behind
`isVendorPapicCaptureEnabled()` (the admin Data Privacy control
`vendor_papic_capture`, default OFF). The tier readout only computes/renders when
that control is approved; until then the module shows "Needs setup" and no
capture runs. No guest PI is collected by this slice.

SPEC IMPACT: None to the corpus beyond the already-logged decision — the pricing
+ tier rule is recorded in `DECISION_LOG.md` (2026-07-18) and the
`project_setnayan_vendor_on_the_day` / `project_setnayan_papic_gbb_pricing`
memories. No SKU/schema/scope change lands live (counsel-gated, flag-OFF).
