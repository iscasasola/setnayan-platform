## 2026-09-04 · fix(frontdoor): "What you run" rows show real identity, not generic icons

The shop row in the front-door rail drew a generic `Store` lucide icon next to
the vendor's business name; the HQ row drew a generic `ShieldCheck` icon. Both
now show the actual identity: the shop row renders the vendor's uploaded logo
(via the existing `VendorAvatar`, falling back to initials when no logo is
uploaded) and the HQ row renders the Setnayan brand mark (via the existing
`LogoMark`, which already flows through the admin-uploaded brand override).

`resolveRailAccount()` (`app/_components/frontdoor/rail-data.ts`) now resolves
`vendor_profiles.logo_url` — already selected by `fetchUserRoleSummary` — to a
presigned display URL via `displayUrlForStoredAsset`, and threads it through a
new optional `shopLogoUrl` field on `FrontDoorAccount`.

SPEC IMPACT: None.
