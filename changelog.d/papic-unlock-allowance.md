## 2026-06-26 · feat(papic): Papic Unlock — the deferred unli-camera + unli-guest allowance

Completes "Unlock all of Papic". PR9 (#2269) shipped the `PAPIC_UNLOCK` umbrella
bundle (grants every Papic add-on FEATURE) but explicitly **deferred** the metered
allowances — its package even promises "unlimited Unli cameras" while the code
still metered them. This is that deferred half, keyed to the merged `PAPIC_UNLOCK`
(no new SKU — reconciled away from a parallel-session duplicate `PAPIC_UNLOCK_ALL`).

- **Allowance reader** (`lib/entitlements.ts`) — new `eventHasPapicUnlock`
  (active-only `PAPIC_UNLOCK` ownership). The `PAPIC_UNLOCK` bundle gains
  `PAPIC_GUEST`, `SDE`, `PATIKTOK_COMPILER` so all Papic features unlock — and
  the guest camera surface opens so "unli guests" can take effect (`PAPIC_SEATS`
  stays out: deprecated, superseded by the per-camera model).
- **Per-camera unlimited** (`app/papic/actions.ts` + `app/api/upload/route.ts`) —
  an unlocked event treats every camera as unlimited-tier + paid (skips
  `papicCameraOrderPaid` + the daily quota). Fails toward the normal metered gate
  on a read error.
- **Guest 150-credit cap lift** — `fetchGuestQuota` reports `unlimited` (also
  bypasses the route pre-check); the composer shows "Unlimited"; both guest
  surfaces thread the flag. Hard cap lifted in the `papic_record_guest_capture`
  RPC (migration `…900000`), active-only.
- **No new buy surface / SKU / catalog row** — #2269's `PAPIC_UNLOCK` package +
  Studio buy card already exist; this only makes them deliver what they promise.
- +4 unit tests (eventHasPapicUnlock + the completed bundle).

Migration `20270303900000_papic_unlock_guest_cap.sql` needs apply via
`supabase db push` (additive + idempotent; app degrades to today's behavior if
unapplied — the hard guest cap stays 150 until it lands).

Verified: web typecheck · test:unit · next lint · lint:papic-keep ·
lint:entitlement-gates · radius · legibility · retired — all clean.

SPEC IMPACT: DECISION_LOG 2026-06-26 (PAPIC_UNLOCK allowance half BUILT; the
deferred per-camera/guest allowance from PR9 is now delivered).
