## 2026-06-26 · feat(papic): Papic Unlock All — the Papic-vertical everything-pass

Owner 2026-06-26: *"Papic Unlock All unlocks all the features of Papic alone.
unli guests, unli camera bridge, and all other features are unlocked."* Builds
the BUILD-PENDING "Unlock all" item (PR7/PR8 notes). ONE `PAPIC_UNLOCK_ALL`
purchase unlocks every Papic feature for an event — and ONLY Papic.

- **Entitlement override** (`lib/entitlements.ts`) — new `PAPIC_UNLOCK_ALL_SKU`
  + `PAPIC_UNLOCK_ALL_GRANTS` allowlist. `eventSkuActive` / `eventOwnsSku` /
  `eventActiveSkus` now honor an active (or pending, for double-buy) pass for
  every allowlisted Papic SKU — so every existing Papic gate unlocks with zero
  per-gate changes. **Allowlist-scoped**: structurally cannot confer a non-Papic
  SKU (PANOOD, PRO_WEBSITE, PAKANTA, …). New `eventHasPapicUnlockAll` reader for
  the allowance bypasses. +13 unit tests (49 total green).
- **Per-camera allowance bypass** (`app/papic/actions.ts` + `app/api/upload/
  route.ts`) — an Unlock All event treats every camera as unlimited-tier + paid:
  skips `papicCameraOrderPaid` and the daily quota (`papicTierDailyLimit` /
  reserve RPC). Fails toward the normal metered gate on any read error.
- **Guest 150-credit cap lift** — `fetchGuestQuota` (`lib/papic-guest.ts`) reports
  `unlimited` (large `remaining`) for an Unlock All event, which also bypasses the
  route pre-check; the guest composer shows "Unlimited"; both guest surfaces
  (`/papic/guest` + the `[slug]` in-context camera) thread the flag. The hard cap
  is lifted in the `papic_record_guest_capture` RPC (migration).
- **Buy surface** — `purchasePapicUnlockAll` apply-then-pay action + a self-
  fetching `UnlockAllCard` on the Studio Papic page (active / pending / buy
  states; price read LIVE from the admin catalog).
- **Migrations** (need apply via `supabase db push`): `…568400` seeds the
  `PAPIC_UNLOCK_ALL` catalog row (₱15,000 PROVISIONAL · admin-editable · on
  conflict never clobbers an admin price); `…568500` redefines
  `papic_record_guest_capture` to skip the 150 cap for an active pass. Both
  additive + idempotent; the app degrades to today's behavior if unapplied.

Price is PROVISIONAL + admin-managed (holistic pricing pass).

Verified: web typecheck · test:unit (49) · next lint · lint:papic-keep ·
lint:entitlement-gates · radius · legibility · retired · botnav · navicon — all clean.

SPEC IMPACT: DECISION_LOG 2026-06-26 (Unlock All scope confirmed + now BUILT);
`0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md` + `0012_papic.md`
"Unlock all = ₱15,000 · BUILD PENDING" → BUILT.
