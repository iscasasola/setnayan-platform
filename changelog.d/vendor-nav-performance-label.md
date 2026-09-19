## 2026-09-18 · fix(vendor-nav): "Performance" tab label truncated in the bottom bar

The vendor bottom nav's `label: 'Performance'` (11 chars) truncated inside the
bar's `truncate whitespace-nowrap text-[10px]` label row with no dynamic
shrink. Renamed to "Insights" — short enough to render fully at the same font
size, so nothing shrinks below the legibility bar. Updated both the hardcoded
fallback in `vendor-bottom-nav.tsx` and its nav-registry default
(`vendor.bottom-nav.performance`) so an admin who hasn't customized the tab
sees the same fixed label. The desktop rail's own caption and the
`/vendor-dashboard/performance` page title are untouched — they render at a
different width and were not the reported defect.

SPEC IMPACT: None.
