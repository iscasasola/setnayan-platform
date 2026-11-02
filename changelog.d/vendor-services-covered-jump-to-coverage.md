## 2026-07-03 · refactor(vendor): My Shop "Services covered" jumps to the taxonomy Coverage flow

Owner: "place it at the last and make it jump to the create service coverage.
this should all be dependent from the admin taxonomy."

The My Shop profile checklist had a "Services covered" row that opened an inline
picker built from the hardcoded legacy category list — a second, divergent
"what you serve" surface next to the real admin-taxonomy-driven Coverage tab
(`/vendor-dashboard/services`). Unified onto the taxonomy:

- The **"Services covered" row is now LAST** in the checklist and renders as a
  jump (`ServiceCoverageRow`) into the Coverage flow instead of an inline
  picker. Same collapsed chrome (status chip · label · preview), an
  "Add / Manage →" link out.
- Completeness is unchanged: the Coverage flow's `createCoverage` already writes
  the covered canonical leaves back into `vendor_profiles.services[]`, which is
  exactly what this row's `ok` reads — so building coverage still ticks the
  checklist item and satisfies the publish gate.
- Removed the inline `ServicesPicker` (+ its `case 'services'`) from the My Shop
  editable-row. The picker stays on the legacy `/profile` form; the taxonomy
  Coverage tab is now the single place a vendor edits what they serve.

No schema or data change — coverage↔services[] bridge already existed. Verified
vendors already managed coverage on the Coverage tab, so no verified-lock
behavior changes.

SPEC IMPACT: DECISION_LOG.md row — "what a vendor serves" is admin-taxonomy-
driven end to end; the My Shop hardcoded picker is retired in favor of the
Coverage flow.
