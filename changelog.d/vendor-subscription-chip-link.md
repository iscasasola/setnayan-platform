## 2026-07-01 · fix(vendor-dashboard): whole subscription chip links to plan page

The vendor sidebar's subscription chip (tier pill + "Subscription" label +
separate "Manage" link) now wraps the entire row in one `Link` to
`/vendor-dashboard/subscription`, dropping the redundant "Manage" text button.
Chevron kept as a visual affordance.

SPEC IMPACT: None.
