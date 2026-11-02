## 2026-07-02 · refactor(vendor-dashboard): move the QR code block from My Shop to the top of My Customers

Owner request: relocate the whole vendor QR row (the Shortlist ↔ Locked card —
reusable shortlist QR + scoped "Update QR" form + copy-link + Download QR, plus
the Locked single-customer generator) off **My Shop** and onto **My Customers**,
sitting directly **above the customers table** (between the three summary cards
and the Customers list).

**What moved**

- `shop/_components/qr-card.tsx` → `_components/qr-card.tsx` and
  `shop/_components/collapsible.tsx` → `_components/collapsible.tsx` — both are
  now shared vendor-dashboard primitives (My Shop's Manage panels still use
  `Collapsible`; the QR card uses both). `manage-tiles.tsx` import repointed to
  `../../_components/collapsible`.
- New `_components/qr-section.tsx` — a **self-contained** async server component
  (`VendorQrSection`) that owns all the QR data it needs off the caller's
  `vendorProfileId` + `slug` + `profileServices`: event types, the Locked
  service picker (active services w/ coverage-category fallback), contracts, and
  the rendered QR SVG. It carries the `ShortlistBody` / `LockedBody` bodies that
  previously lived inline in the shop page (moved verbatim). Fail-soft
  throughout so a QR query hiccup can't take down the host page.

**Shop page** — QR data-prep, the `<QrCard>` render, the inline QR bodies, and
the now-dead `coverage` / `serviceOptions` / `contractOptions` loader fields +
their imports (`renderUrlQrSvg`, `buildVendorInviteUrl`, `getCreatableEventTypes`,
`fetchVendorServices`, `fetchVendorContracts`, `VENDOR_CATEGORY_LABEL`,
`LockedQrGenerator`, `Download`, the `searchParams` prop) were removed. `My Shop`
no longer renders a QR anywhere.

**Customers page** — renders `<VendorQrSection>` above the customers table;
`searchParams` widened to `{ m?, et?, cat? }`. The Shortlist "Update QR" GET form
now carries a hidden `m` input so scoping the QR keeps the calendar's month view
(the calendar drives `?m=` on the same URL) instead of resetting it.

Typecheck + ESLint clean on the six touched files.

SPEC IMPACT: None (surface relocation within the vendor dashboard — no schema,
pricing, SKU, RLS, or copy-contract change). The QR block's function, links, and
generators are unchanged; only its host page moved (My Shop → My Customers). The
"My Shop rework · Shortlist/Locked QR" note (PR #2576) is superseded on the QR's
location only.
