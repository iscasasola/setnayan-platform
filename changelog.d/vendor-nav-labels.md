## 2026-07-01 · fix(vendor-nav): correct two mis-seeded sidebar labels

The vendor-dashboard 6-menu sidebar rendered its 4th and 5th flat destinations
as "Overview" (duplicating the 1st item) and "Services" instead of the intended
"My Performance" and "My Services". The flat-destination array
(`VENDOR_SIDEBAR_DESTINATIONS`) had the right labels, but `applyVendorRegistry`
overlays each one with its `vendor.sidebar.<key>` admin slot, and two slot
DEFAULTS in `nav-registry-defaults.ts` were seeded from the wrong source — the
group-tree sub-item labels ("Overview" for the performance group's overview
page, "Services" for the services page) rather than the flat-destination labels.

- `vendor.sidebar.performance` default label "Overview" → "My Performance"
- `vendor.sidebar.services` default label "Services" → "My Services"

No admin override rows exist for these slots (label resolves `override ?? default`),
so the corrected defaults take effect on deploy — no migration needed. The shared
slots also govern the /more landing + mobile bottom-nav renders of the same
destinations, which now read consistently.

SPEC IMPACT: None — nav-label copy fix, no schema/SKU/pricing/route/flow change.
