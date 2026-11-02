## 2026-07-16 · feat(seating): lock-gated booth vendors + Setnayan promotion default (2D/3D)

Seat-plan vendor presence per the owner directive (2026-07-16): only
**finalized** vendors appear in the room; every open slot defaults to Setnayan
promotion. Reuses the existing lock gate — **no schema change / no migration**.

- **"Finalized" = the committed set** already enforced everywhere: a booth may
  only link an `event_vendors` row whose `status ∈ {contracted, deposit_paid,
  delivered, complete}` (`BOOKED_VENDOR_STATUSES`, written by `finalizeVendor` →
  `'contracted'`). The picker (`fetchBookedVendorsForBooths`) offers ONLY those,
  and the save path (`nullOutForeignBoothVendors`) nulls any non-finalized /
  cross-event link. `event_floor_booths.event_vendor_id` (nullable) already
  carries the assignment — nothing to add.
- **Setnayan-promotion default (data-driven seam)** — new pure helper
  `boothPresenceLabel` + `SETNAYAN_BOOTH_PROMO_LABEL` in `lib/seating.ts`: a
  slot resolves to the finalized vendor's name when linked, else `"SETNAYAN"`.
  One source so the 2D marker and 3D sign never diverge (the 3D Booth Ads
  inventory seam — future ad inventory swaps in with no render-layer change).
- **3D** (`plan3d/venue-objects.tsx` `BoothMesh`): a branded (pro/enterprise)
  vendor keeps its logo `BoothSign`; an **open slot renders the new
  `SetnayanBoothSign`** — a tasteful kit-gold (`#c5a059`, Royal Champagne Gold)
  board + SETNAYAN wordmark (canvas texture, no fetched asset / no troika font,
  same browser-only pattern as ghost-booth). A booked-but-unbrandable vendor
  (solo/verified) is NOT overwritten — it is still a real vendor's slot.
- **2D** (`seating-editor.tsx`): the blueprint booth marker label mirrors it —
  finalized vendor name when linked, `SETNAYAN` (mono) otherwise; the blank
  pre-pick pin keeps its "Pick type" editor prompt. Empty-picker copy now points
  at the lock flow: "lock a vendor in Merkado to place them here."
- Tests: `lib/seating.test.ts` — presence-label matrix (finalized → name; open /
  empty-id → SETNAYAN) + a finalized-gate guard (`considering`/`shortlisted`
  never place). 50/50 pass. `tsc --noEmit` + `next lint` + prod build clean.

SPEC IMPACT: iter 0008 (seating) / 3D Booth Ads backlog — implements
`Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md` "Vendor presence rule (owner,
2026-07-16)": 3D shows only finalized vendors, unassigned slots = Setnayan
promotion, 2D mirrors skeletally. No corpus/decision beyond the directive.
