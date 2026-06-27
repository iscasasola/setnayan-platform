## 2026-06-28 · feat(vendors): Lock-too respects date-lock gate + milestones

The cross-category "Lock too" shortcut (`addRecommendedVendorToCategory`) was the
last lock path that chained into `finalizeVendor` but swallowed the result — so it
silently skipped the force-to-one date-lock confirmation and the pick milestone.

Now the action surfaces a `date_will_lock` result (with the freshly-inserted
`eventVendorId`) and a `milestone` on a successful lock. `recommended-vendor-row.tsx`
shows the shared date-lock confirmation modal; on confirm it calls `finalizeVendor`
DIRECTLY with the inserted vendor id + `confirm_date_lock=1` (re-running the
add action would hit `already_picked` on the now-existing row), then pops the
congrats toast. All other lock entry points (accordion, single-pick, compare
drawer) were wired in the smart-date-picker PR; this closes the last one.

SPEC IMPACT: None (additive; no schema changes)
