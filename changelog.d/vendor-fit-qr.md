## 2026-07-09 · feat(vendors): scan-a-vendor "fit check" QR route

Shipped the couple-facing **fit-check** flow — the deferred "scan-vendor-QR fit-check" item from `unify-vendor-tabs.md` and owner ask (c) ("scan to check if they can provide service for the event"). A couple who scans a vendor's QR lands on a stable, read-only page that answers *"does this vendor fit MY event?"* against date · reach · budget, then can one-tap add to their shortlist.

- **Read-only, reusable URL** (`lib/vendor-fit-qr.ts` · `buildVendorFitUrl(ref)` → `/vendor/fit/{slug|public_id}`) — the deliberate opposite of the single-use, booking-committing Locked QR (`vendor-locked-qr.ts`): no DB token row, one QR reused forever, and it only READS + shortlists.
- **`/vendor/fit/[ref]`** (`app/vendor/fit/[ref]/page.tsx`) — resolves the ref → vendor (market slug, else `public_id`), shows the vendor's identity (hybrid-anonymity aware via `hydrateVendorCards`), then for a signed-in couple lets them pick one of their events and renders the live fit verdict. Signed-out → sign-up CTA; no event → create-event CTA.
- **Fit verdict** reuses the exact dashboard primitives: `vendor-availability` (date), `vendor-tier-caps` radius + `distance` Haversine (reach), `budget` snapshot `totals.remaining` vs the service's `starting_price_php` (budget). Warn-only + fail-open — an unknown input reads `null` and never fails the fit (pure `computeVendorFit`, 5 unit tests).
- **Add to shortlist** (`actions.ts` · `addVendorFromFit`) reuses the canonical `attachMarketplaceVendorToCategory` (`status='considering'`); the vendor's `VendorCategory` is resolved canonical → tile → category via the taxonomy.

No new tables, no new tracking — every read is against existing data. Follow-up (small, lower-risk than swapping the live invite-QR): surface the fit URL as a vendor-dashboard QR (point the existing "Shortlist" QR at `/vendor/fit/[slug]`, or add a mode to `QrCard`).

Files: `apps/web/lib/vendor-fit-qr.ts`, `apps/web/lib/vendor-fit-qr.test.ts`, `apps/web/app/vendor/fit/[ref]/page.tsx`, `apps/web/app/vendor/fit/[ref]/actions.ts`.

SPEC IMPACT: None — new couple-facing route reusing existing fit primitives + the canonical shortlist action; no schema, pricing, SKU, or engine change. (Advances the "scan-vendor-QR fit-check" item the corpus tracked as deferred.)
