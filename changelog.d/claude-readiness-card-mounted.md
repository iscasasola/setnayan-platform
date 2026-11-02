## 2026-09-19 · fix(live-studio): mount the orphaned Broadcast readiness card in the control room

The Wave 9 `BroadcastReadiness` card (§ 4h) shipped self-contained and was never mounted. It now renders in the control room's Setup sheet, Connect section — where the channel status already lives — decided by `decideBroadcastReadiness` over the same `fetchReadinessFacts` object the page already reads for `poolRouteToAir` (no second query; the Go live button and the card cannot disagree). Inside the sheet it adds zero height to the scroll-free surface (measured: no page scroll at 1280×800, 1440×900, 1024×768, 390×844 across all nine decision states). Guard: `app/panood/control/[eventId]/readiness-card-is-mounted.test.ts` (mount count 1, condition parsed, one read two readers, placement), sabotage-proven.

SPEC IMPACT: None — implements `Live_Studio_Unified_Spec_2026-07-25.md` § 4h as written.
