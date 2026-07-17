## 2026-07-18 · feat(vendor): on-the-day Papic capture controller (counsel-gated, flag-OFF)

Builds the vendor on-the-day Papic capture controller (owner-locked 2026-07-18).
A vendor's free capture tier for a booked event is **earned by how they accepted
the inquiry**, never chosen:

- Accepted by **spending a lead token**, or a **founder**-comped (token-free,
  as-if-paid) accept → **Papic Ltd** (70 capture points, photos + 5s clips).
- Any other accept (no token) → **Papic Lite** (20 points, **photos-only**).

Capture-points currency: 1 photo = 1 pt · 1×5s clip = 3 pts. The tier is
**derived live** from `vendor_event_unlocks` (`comp_reason` + `tokens_burned`/
`lead_token_holds`) — never stored, so **no new migration** (the counsel-gated
tables already exist in prod, empty).

**No self-serve Unli upgrade.** The +₱50 vendor Unli upgrade was **dropped**
(owner 2026-07-18 — "not allow upgrade +50 if it is difficult"), which removes
the whole apply-then-pay order + reconciliation-hook path. Unli remains only a
latent tier an admin can comp (a `vendor_papic_capture_grants` row with
`tier='unli'`); there is no vendor-facing purchase.

**What's in it**
- `lib/vendor-papic-tier.ts` — the pure tier + capture-points model
  (`baseTierFromProvenance`, `resolveVendorPapicTier`, `canCapture`,
  `captureAllowance`, `tierReadout`) + `lib/vendor-papic-grants.ts` — the
  fail-closed service-role DB derivation. **26 unit tests** (the pure model +
  a stubbed-client suite proving the DB reads → provenance → tier translation).
- `POST /api/vendor/papic-capture` — server route: flag → resolve vendor →
  capture-point enforcement → R2 PUT → RLS insert into `vendor_papic_captures`
  → always-on NSFW screen in `after()`. Geo never stored; 5s clip cap.
- Live surface at `…/live/[eventId]/papic` — consent gate, gesture shutter
  (tap = photo, hold = ≤5s clip on Ltd), capture-point meter, flip/lens; the
  floor-console link is flag-gated.
- The launcher step-2 module card shows the derived tier as a badge and unlocks
  its toggle once the capability is approved.

**Still counsel-gated / flag-OFF everywhere** — every surface fail-closes behind
`isVendorPapicCaptureEnabled()` (the admin Data Privacy control
`vendor_papic_capture`, default OFF). Until the DPO/NPC ruling approves it, the
module reads "Needs setup", the route 403s, and **no guest PI is collected**.
`tsc` 0 · lint clean · full unit suite green.

Known follow-ups (not blocking): capture is the vendor owner/admin path (a
per-event grantee views the console but can't capture — matches the RLS insert
policy); uploads are non-blocking but not yet the durable offline queue the
couple seat surface has; `consent_basis='event_consent'` is a placeholder the
DPO ruling governs.

SPEC IMPACT: None to the corpus beyond the already-logged decisions — the
pricing/tier rule and the dropped-upgrade decision are in `DECISION_LOG.md`
(2026-07-18) and the `project_setnayan_vendor_on_the_day` /
`project_setnayan_papic_gbb_pricing` memories. No SKU/schema/scope change goes
live (counsel-gated, flag-OFF). Go-live still awaits the DPO/NPC ruling + the
admin Data Privacy approval.
