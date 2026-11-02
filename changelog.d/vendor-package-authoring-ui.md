## 2026-07-26 · feat(packages): the package authoring UI (PR-3)

The form a vendor actually fills in — the last missing piece of the write path. Behind
`NEXT_PUBLIC_PACKAGE_AUTHORING` (default OFF); flag-off, My Shop renders exactly as today.

- `/vendor-dashboard/packages` — the vendor's packages, Live / Draft
- `/vendor-dashboard/packages/[packageId]` — build or edit one (`new` handled by the same
  route, so the empty and loaded forms are literally the same component)
- **Doorway on My Shop**, directly under Services, because a package is a bundle OF services.
  Ships in the same PR as the route, per the no-orphaned-pages rule.

The form runs the SAME `validatePackageDraft` the server action re-runs, showing problems
inline keyed by `itemRef`/`optionRef`. The client copy is feedback only and never trusted —
but a vendor should never press Save and get a surprise.

Three UI rules that exist to keep the data honest rather than to be pretty:

- **Choices seed with two options, the first standard.** One option is not a choice, so an
  empty choice would start invalid.
- **Picking a standard option clears the others and zeroes its own extra cost** — the standard
  IS the baseline. The database enforces both; the UI just makes them unreachable.
- **Ticking "always included" forces default-included on.** Required-implies-included is a
  CHECK constraint; letting the vendor build the rejected shape would only surface as a
  constraint violation on save.

A booked package renders read-only with a plain-language explanation (*"that booking is a
promise you have already made"*) and keeps rename + unlist, mirroring `editScopeForPackage`.

Money is edited in pesos, stored in centavos, converted once at the input boundary.

- `apps/web/app/vendor-dashboard/packages/page.tsx` (new)
- `apps/web/app/vendor-dashboard/packages/[packageId]/page.tsx` (new)
- `apps/web/app/vendor-dashboard/packages/_components/package-editor.tsx` (new)
- `apps/web/app/vendor-dashboard/shop/page.tsx` — flag-dark doorway

SPEC IMPACT: `Vendor_Card_Actions_Findings_2026-07-26.md` §3b — closes the "vendor authoring
surface does not exist" gap. The couple-side configurator finally has something to render.
