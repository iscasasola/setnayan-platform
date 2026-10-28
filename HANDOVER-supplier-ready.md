# HANDOVER — claude/supplier-ready-tomorrow (builder, 29 Oct 2026)

Worktree: ~/Documents/Claude/Projects/wt-supplier-ready · branch claude/supplier-ready-tomorrow · base origin/main cd137db2ee

## Done
- S1 · Events you run for a live co-host seat (lib/events-you-run.ts, .server.ts, -words.ts lede, customer card pill,
  supplier-lab `?s=coord-today|coord-events|coord-customer&cohost=1`). Tests green; two sabotages red (rule, read).

- S2 · name/address by request for a shop Setnayan set up (lib/vendor-corrections.ts identityLockOf /
  identityLockRefusal / rowAsks; actions.ts updateVendorProfileField; RequestOnlyRow in editable-row.tsx; ask card
  requestOnly; lab `?s=details&invited=1&asked=1`). Guard lib/a-shop-setnayan-set-up-asks-to-rename.test.ts green,
  two sabotages red.
- S3 · basic setup first (lib/basic-setup-gate.ts + app/vendor-dashboard/_components/basic-setup-hold.tsx, one mount
  in layout.tsx). Guard lib/basic-setup-gate.test.ts green, three sabotages red.

- S4 · offerProgress counts each real service once (lib/supplier-setup.ts coarse param; vendor-first-steps.server.ts
  passes VENDOR_CATEGORIES). Guard lib/what-you-offer-counts-each-service-once.test.ts; sabotages red.
- S2 row asks in place now (RequestOnlyRow has its own Send).

## Next
- S5 report (stylist taxonomy) · lints + check-ugat-screens · walk · DECISION_LOG · draft PR basic-setup gate · S4 offerProgress · S5 stylist check
- Then lints, walk, draft PR (+ do-not-auto-merge label).
