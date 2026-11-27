## 2026-11-25 · fix(admin): final check area 8, batch 6: money desks read honestly (display only)

Final check, area 8 fixer, batch 6 (lane A, money desks). Only how a value shows changes: a failed read says
"Couldn't read" instead of ₱0, "none", "live" or a code default, and a save that would write from an unread value
is held back. No amount, fee, plan, payer or price read changes.

- **A8·A-9 / B-7 / F-3 / D-6**: the catalogue reads keep their outcome (`fetchV2CustomerCatalogRead`,
  `fetchV2BundleCatalogRead`, same queries). The discount-code form, the free-window and deal pickers and the
  comp-grant picker say "Couldn't read" and hold Create/Save back; the supplier invite says its plan prices were not read.
- **A8·F-1**: Gifts shows "Couldn't read the gift limit" instead of pre-filling the default as the live setting.
- **A8·A-3**: approving with "Also mark order as paid" when the payments list can't be read says so, names no peso
  figure, and does not promote (same as a shortfall).
- **A8·A-11**: with no pending payments, the "From your BDO" pile, its failure line and its drop tile still show.
- **A8·H-1**: Insights › Overview's sales card says "Couldn't read the sales figures" and leaves the leaderboard.
- **A8·H-3**: the entity map draws "—" and "couldn't read" for a refused count, and a refused table says so.
- **A8·E-3**: a booking-fee dispute never shows "Fee ₱0" or a confident "no chat / no save" on a refused read.
- **A8·E-4**: dispute evidence (policy, handovers, receipt, supplier and opener names) says when it couldn't be read.
- **A8·B-1**: an unread sign-up discount locks the AI and Papic price saves (they would have erased sign-up prices).
- **A8·B-4**: an unread booking-fee settings row shows "Couldn't read" with no Save, not the code schedule.
- **A8·B-8**: under a failed catalogue read the catalogue browser and the other-Papic editor are not drawn empty.

🟠 Skipped: **B-4's** `minPhp={BOOKING_FEE.minPhp}` (a minimum typed in `lib/booking-fee.ts`): moving it to a read
changes which number is read, so it waits for the owner. **A-1** moved to the launch batch A1 (#guards PR).

Guard: `apps/web/app/admin/batch-6-money-desks-read-honestly.test.ts` (9 mutations, all red).

SPEC IMPACT: None.
