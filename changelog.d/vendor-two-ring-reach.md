## 2026-07-25 · feat(vendor): two-ring reach + ENFORCED free transport (flag-dark)

Owner-locked model `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6 — "Reach: two rings, free-transport ENFORCED". Ships entirely behind a NEW flag `NEXT_PUBLIC_VENDOR_REACH_RINGS_V1`, **default OFF**; with the flag off nothing renders, no new column is read or written, no extra query is issued, and the Proposal Maker's transportation control behaves byte-identically to today.

**The model.** The EVENT VENUE decides the ring:

- **Ring 1 "free travel"** — served + discoverable, and in the Proposal Maker the transportation line is **locked to ₱0 with the field DISABLED**. The couple's quote carries a "Free Transportation" line.
- **Ring 2 "willing to travel"** — discoverable; the couple sees "travel fee may apply" and the line stays editable.
- **Beyond Ring 2** — the vendor is not shown to that couple.
- Vendors set both rings; the Ring-2 outer bound is **tier-capped: Free/Solo 30 km · Pro 60 km · Enterprise/Custom 100 km.**

**What landed**

- `lib/vendor-reach-rings.ts` — the pure resolver (no env, no clock, no I/O): the `RING2_CAP_KM` ladder, `resolveRingRadii` (clamping), `resolveReachRing` (ring verdict + `transportLocked` + `discoverable`), `parseRingSettings` (server-authoritative settings parse) and `enforceFreeTransport` (server re-assertion over a client-composed itemization). Reuses `haversineKm` from `lib/geo.ts` and `asVendorTier` from `lib/vendor-tier-caps.ts`; **no new geo columns and no new distance math.**
- `lib/vendor-reach-rings-flag.ts` — the flag, in its own module so the resolver stays `tsx --test`-friendly.
- `lib/vendor-reach-rings.server.ts` — the DB half. Reads the ring columns in their OWN narrow query (never folded into `FULL_VENDOR_PROFILE_SELECT` — PostgREST answers an unknown column with 42703 and nulls the whole row) and short-circuits to `null` before issuing anything while the flag is dark. `resolveThreadTransportRing` returns only the RING — **never the venue pin and never the distance** — so the couple's coordinates don't reach the vendor's browser.
- Migration `20271003528118_vendor_reach_rings.sql` — `vendor_profiles.reach_ring1_km` + `reach_ring2_km` (nullable INT, 0–100 CHECK, partial index). Fail-safe defaults: NULL Ring 1 → 0 km → **nothing is ever forced to ₱0** (a vendor opts IN to free transport); NULL Ring 2 → the tier cap, so discovery never narrows on deploy.
- Proposal Maker (`app/_components/proposal-maker.tsx`) — new optional `transportRing` prop (default `null` = today's behaviour). Ring 1 ⇒ the transportation `<select>` is disabled, the mode is DERIVED to `included`/₱0 (never written into state, so the vendor's own draft survives underneath), and a ₱0 "Transportation — Free Transportation…" line joins the composed itemization. Wired from the vendor thread page.
- Vendor settings — new `app/vendor-dashboard/shop/_components/reach-rings-card.tsx` (two sliders + the two-ring map) and `shop/reach-actions.ts`. `ReachMap` grows an optional `freeRadiusKm` inner ring; every existing caller renders unchanged. This is the follow-up `reach-map.tsx` promised in its own header ("read-only here; a follow-up makes it vendor-settable up to the tier ceiling").

**Why the ring columns are deliberately NOT in `guard_vendor_profiles_entitlement`:** they are a vendor PREFERENCE, not a paid entitlement — the vendor is supposed to write them. The paid thing is the CAP, and the cap is applied at **read** time by `resolveRingRadii`, so a Solo vendor who PATCHes `reach_ring2_km = 999` through PostgREST still resolves to 30 km. Clamp-at-read, not trust-the-column. The DB test pins this decision so a future "hardening" that adds them to the guard fails loudly instead of silently killing the settings card.

Tests — `lib/vendor-reach-rings.test.ts` (34 cases: flag-OFF byte-identity across every env spelling; the cap ladder + monotonicity for EVERY tier incl. `verified`/`custom`/garbage; clamping order and downgrade behaviour; the three ring boundaries; seven fail-open paths — missing/NaN/out-of-domain pins all resolve `unknown` → discoverable + transport editable; the `enforceFreeTransport` rewrite/collapse/add/pass-through matrix) and `tests/db/vendor-reach-rings.db.test.ts` (7 cases against the fully replayed prod schema — **verified to FAIL without the migration**: column shape/nullability/no-default, the 0–100 CHECK, the venue anchor still present, vendor-writability, over-tier value storable-but-inert). Typecheck clean; full unit suite green.

**Not wired (cross-track):** the marketplace discovery filter still uses the legacy single `tierCaps.serviceRadiusKm` gate in `app/dashboard/[eventId]/vendors/_actions/category-search.ts` — the "beyond Ring 2 = not shown" half needs that file, which belongs to another track. And `sendCustomProposalCore` does not yet call `enforceFreeTransport`, so until it does the ₱0 lock is UI-only (the helper is written, tested and ready).

SPEC IMPACT: Implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6 (two rings + enforced free transport + tier-capped Ring 2). Introduces a SECOND, flag-dark reach ladder (30/30/30/60/100) that does **not** yet replace `TIER_CAPS.serviceRadiusKm` (0/20/20/50/100) — the two disagree by design until the owner flips the flag and the discovery gate is migrated. No price change, no SKU change, no catalog row.
