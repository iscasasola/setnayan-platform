## 2026-07-11 · feat(plan3d): 3D Booth Ads Parts C + D — vendor booth showcase + guest-walk Book CTA

Completes the 3D Booth Ads slice — Parts C (vendor shareable showcase, Pro) and D
(guest-walk "Book this vendor" CTA, free for verified).

### Part C — "Walk into my booth" (NEW public route, Pro entitlement)
- `app/v/[slug]/booth/page.tsx` (server) — fetches the vendor by slug, gates
  public-visible + verified (else notFound), then the **Pro/Enterprise
  entitlement** (`boothCanBrand` — the same gate that brands a booth). Non-Pro (or
  a category with no booth template) → a soft "3D booth is a Pro feature" card
  with a link to the profile, never a broken canvas. Coerces `services[]` →
  `VendorCategory`, resolves the logo (`displayUrlForStoredAsset`), builds a
  synthetic `Lab3DBooth`, and renders it via a ssr:false loader →
  `booth-showcase-client.tsx`: a single branded `<BoothMesh>` (the exact
  production booth — chassis + mascot staff + Pro logo sign) on a small orbitable
  floor. `generateMetadata` sets share-friendly OG/Twitter tags.
- `app/v/[slug]/page.tsx` — a "Walk into my booth" button in the hero actions row,
  gated on the same Pro entitlement (`ShareButton` already shares the URL).

### Part D — guest-walk Book CTA (already functional; type gap closed)
Part D was already live: the guest 3D venue walk's booth card defaults to
`profileCta='book'` and `page.tsx` joins `slug` + `bookable` per booth, so a
verified vendor already shows "Book this vendor for your event". This PR only
closes a type-hygiene gap — `bookable?: boolean` added to the `VenueScene` booth
`vendor` type (it was flowing untyped at runtime).

`tsc` clean · guards clean. The WebGL booth look is owner-eyeballed (can't run
headless), so Part C is behind `NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE` (off →
the route 404s and the profile button hides) — flip it after eyeballing. No
migration. Part D is free for verified and already live (type fix only).

SPEC IMPACT: None (implements locked slice-9 Parts C + D).

### Adversarial review — 3 defects found + fixed before ship
A 2-lens find→refute review of the new public route caught (all CONFIRMED):
- **[med] Anonymity leak** — the booth page used raw `business_name` in the
  SoftGate + OG metadata, bypassing `resolveVendorDisplayName`; a non-name-revealed
  tier (free/verified) would have leaked its real name. Now routed through the same
  anonymity resolver the profile uses, and `generateMetadata` is gated (generic
  title unless flag + public + verified). The Canvas path is Pro-only (name
  revealed day-1), so it's unaffected.
- **[low] 500 on logo-signing failure** — `displayUrlForStoredAsset` now has a
  `.catch(() => null)` (unset R2 on a preview env would have 500'd the page;
  degrades to an unbranded booth).
- **[low] Dead profile link** — `canShowBooth` now also checks
  `verification_state === 'verified'`, matching the route's gate (the profile
  skips its verified-gate for owner-preview/demo).
