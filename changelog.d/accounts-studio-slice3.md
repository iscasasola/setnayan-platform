## 2026-07-04 · feat(admin): Accounts Studio slice 3 — Vendors tab

- Wires the Vendors LIST as a tab in /admin/accounts (byte-identical body → _surfaces/vendors-surface.tsx; actions + invite-vendor-form imported from existing locations). Legacy /admin/vendors redirects in forwarding q/status (+ invite banners). vendors/[vendorProfileId]/edit + /tokens stay standalone (linked out). Sidebar 'vendors' item → ?tab=vendors (matchPrefix '/admin/vendors'); mobile card follows via ADMIN_NAV_GROUPS. Stacks on slices 1–2.

SPEC IMPACT: None.
