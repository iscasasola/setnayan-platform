## 2026-07-21 · feat(admin): catalog-driven SKU picker for comp grants

Salvaged the still-wanted UI half of the abandoned PR #2294 (commit 4d68e5857)
onto the relocated live admin surface, and closed the rest.

The admin comp-grant form's "specific services" scope used a **free-text
`<textarea>`** where an admin hand-typed comma/newline-separated SKU codes —
error-prone and stale the moment the catalog changed. It's now a **grouped
checkbox picker** auto-populated from the live catalog tables
(`fetchV2CustomerCatalog` + `fetchV2BundleCatalog` + `fetchV2VendorCatalog`),
grouped **Customer service · Bundle · Vendor subscription/tokens**, each row
showing display name + `sku_code` + price. New paid SKUs appear automatically as
they land in the catalog. Fail-soft: a catalog read error degrades to "No
catalog SKUs found" (form still submits).

- `app/admin/accounts/_surfaces/users-surface.tsx` — page fetches the catalog
  once, threads `services` through `UsersTable` → `CompGrantsPanel`; textarea
  replaced by the grouped checkbox list.
- `app/admin/users/actions.ts` — `issueCompGrant` now reads the multi-value
  checkbox field via `formData.getAll('scoped_skus')` (graceful fallback still
  splits a single comma/newline string); validation messages updated to
  "select a service".

**Deliberately NOT ported** from PR #2294: the first commit (8d72809 —
`lib/entitlements.ts hasAllServicesGrant` + migration
`20270307500000_owner_all_services_comp_grant.sql`) and the `entitlements.ts`
"specific_skus enforcement" from 4d68e5857. That client-side `comp_grants` read
is a rejected cross-account-leak anti-pattern; entitlement enforcement on main
already goes through the SECURITY DEFINER functions (`event_has_comp_for_sku` /
`event_host_is_internal` / `event_host_holds_founder_seat`). This PR is UI +
form-parsing only — it changes what an admin can *pick*, not how comps are
*enforced*. PR #2294 can be closed once this lands.

SPEC IMPACT: None — admin-tool UX refinement; no SKU/schema/pricing/scope change.
