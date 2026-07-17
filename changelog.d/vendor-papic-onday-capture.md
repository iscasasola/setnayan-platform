## 2026-07-18 · feat(vendor): on-the-day Papic capture controller (counsel-gated, flag-OFF)

Builds the vendor on-the-day Papic capture controller end-to-end (owner-locked
2026-07-18). A vendor's free capture tier for a booked event is **earned by how
they accepted the inquiry**, never chosen:

- Accepted by **spending a lead token**, or a **founder**-comped (token-free,
  as-if-paid) accept → **Papic Ltd** (70 capture points, photos + 5s clips).
- Any other accept (no token) → **Papic Lite** (20 points, **photos-only**).
- Event-scoped **+₱50 upgrade to Papic Unli** (unlimited). Non-transferable.

Capture-points currency: 1 photo = 1 pt · 1×5s clip = 3 pts. The base tier
(Lite/Ltd) is **derived live** from `vendor_event_unlocks` (`comp_reason` +
`tokens_burned`/`lead_token_holds`) — never stored; only the paid Unli upgrade is
persisted (`vendor_papic_capture_grants.tier='unli'`), so **no new migration** is
needed (the counsel-gated tables already exist in prod, empty).

**The tier brain** — `lib/vendor-papic-tier.ts` (pure model: `baseTierFromProvenance`,
`resolveVendorPapicTier`, `canCapture`, `captureAllowance`, `tierReadout`; 16 unit
tests) + `lib/vendor-papic-grants.ts` (fail-closed service-role derivation:
`deriveVendorPapicTier`, `fetchVendorPapicAllowance`). A free perk only ever
under-grants on error; the Unli check is money logic and never opens on error.

**The launcher readout** — the step-2 module card shows the derived tier as a
badge ("Papic Ltd · 70 pts · photos + video"); the module's "Needs setup" lock
lifts once the capability is approved.

**The capture controller** — `/api/vendor/papic-capture` (server-side route
mirroring the guest lane: flag → resolve vendor → tier/capture-point enforcement
→ R2 PUT → RLS insert into `vendor_papic_captures` → always-on NSFW screen in
`after()`; geo never stored; 5s clip cap) + a live-console surface at
`…/live/[eventId]/papic` with a consent gate, gesture shutter (tap=photo,
hold=≤5s clip on Ltd/Unli), a capture-point meter, flip/lens controls, and an
inline "out of shots → go Unli ₱50" panel.

**The +₱50 Unli upgrade** — `startVendorPapicUnliUpgrade` creates an apply-then-pay
`orders` row (`service_key='VENDOR_PAPIC_UNLI_UPGRADE'`, `vendor_profile_id`
stamped, dedups pending); on admin approval the new `EXACT_HOOKS` branch in
`lib/sku-activation.ts` upserts the grant to `tier='unli'`.

**Still counsel-gated / flag-OFF everywhere** — every surface (route, capture
page, live-console link) fail-closes behind `isVendorPapicCaptureEnabled()` (the
admin Data Privacy control `vendor_papic_capture`, default OFF). Until the
DPO/NPC ruling approves it, the module reads "Needs setup", the route 403s, and
**no guest PI is collected**. `tsc` 0 · lint clean · full unit suite green
(1988, +16).

Known follow-ups (noted, not blocking): capture is the vendor owner/admin path
(a per-event grantee views the console but can't capture — matches the RLS
insert policy); uploads are non-blocking but not yet the durable offline queue
the couple seat surface has; the `consent_basis`='event_consent' value is a
placeholder the DPO ruling governs.

SPEC IMPACT: None to the corpus beyond the already-logged decision — the pricing
+ tier rule is in `DECISION_LOG.md` (2026-07-18) and the
`project_setnayan_vendor_on_the_day` / `project_setnayan_papic_gbb_pricing`
memories. No SKU/schema/scope change goes live (counsel-gated, flag-OFF). Go-live
still awaits the DPO/NPC ruling + the admin Data Privacy approval.
